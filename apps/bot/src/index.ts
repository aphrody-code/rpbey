import "reflect-metadata";
import { tsyringeDependencyRegistryEngine } from "@rpbey/di";
import { DIService } from "@rpbey/discordx";
import { MessageFlags, PermissionsBitField } from "discord.js";
import { container } from "tsyringe";

import { startApiServer } from "./lib/api-server.js";
import { bot } from "./lib/bot.js";
import { setupEventBridge } from "./lib/event-bridge.js";
import { setupLogCapture } from "./lib/log-capture.js";
import { logger } from "./lib/logger.js";
import { client as dbClient } from "@rpbey/db";
import { prisma } from "./lib/prisma.js";
import { claimSingletonOrExit } from "./lib/singleton-guard.js";

// Refuse to start a second instance — exit(11) if another PID owns the lock.
const releaseLock = claimSingletonOrExit();

// Preconnect to hot hosts to reduce first-request latency (Bun-native)
// Wrapped in try/catch: Bun 1.3.13-canary throws "Invalid port" on bare hostnames.
if (typeof fetch.preconnect === "function") {
  for (const url of ["https://discord.com", "https://api.twitch.tv", "https://api.challonge.com"]) {
    try {
      fetch.preconnect(url);
    } catch {
      // preconnect not supported — ignore
    }
  }
}

// Capture logs to in-memory buffer for API access
setupLogCapture();

/**
 * Wire discord.js Client-level error/warn/shard events to the logger.
 * Called once, before login. Keeps telemetry in the structured log stream
 * rather than relying solely on the WebSocket pub/sub (event-bridge).
 */
function setupClientErrorHandlers() {
  // Client-level error — emitted when the gateway WebSocket encounters an error.
  // Must be listened; unhandled 'error' events crash the process in Node.
  bot.on("error", (err) => {
    logger.error("[Client] error:", err);
  });

  // Warnings emitted by discord.js itself (rate-limit approach, deprecated usage…).
  bot.on("warn", (msg) => {
    logger.warn("[Client] warn:", msg);
  });

  // Shard-level WebSocket error (fired per-shard when the WS errors).
  bot.on("shardError", (err, shardId) => {
    logger.error(`[Shard ${shardId}] error:`, err);
  });

  // Shard disconnected — the CloseEvent carries the WS close code.
  // Note: CloseEvent.reason is @deprecated (unused by @discordjs/ws internally);
  // only .code is reliably populated.
  bot.on("shardDisconnect", (event, shardId) => {
    logger.warn(`[Shard ${shardId}] disconnected — code ${event.code}`);
  });

  // Token was invalidated by Discord — the bot can no longer reconnect.
  bot.on("invalidated", () => {
    logger.fatal("[Client] session invalidated — token revoked or application deleted. Exiting.");
    // Give the logger a tick to flush before terminating.
    setTimeout(() => process.exit(1), 500);
  });
}

setupClientErrorHandlers();

/**
 * Graceful shutdown — called on SIGTERM (systemd stop) or SIGINT (Ctrl-C).
 * Drains the Discord gateway cleanly, closes the DB pool, releases the PID
 * lock, then exits with the conventional signal exit code.
 */
async function gracefulShutdown(signal: "SIGTERM" | "SIGINT" | "SIGHUP"): Promise<never> {
  const exitCode = signal === "SIGINT" ? 130 : 143;
  logger.info(`[Bot] ${signal} received — shutting down gracefully…`);

  // 1. Destroy the Discord gateway connection (sends WS close frame).
  try {
    bot.destroy();
  } catch (err) {
    logger.warn("[Bot] bot.destroy() error:", err);
  }

  // 2. End the shared postgres-js connection pool.
  try {
    await dbClient.end({ timeout: 5 });
  } catch (err) {
    logger.warn("[Bot] DB pool close error:", err);
  }

  // 3. Release the PID lock file.
  releaseLock();

  process.exit(exitCode);
}

// Start the bot HTTP API server.
// Sur Cloud Run, écouter sur le port imposé par la plateforme (`$PORT`) ;
// sinon le port API local (`BOT_API_PORT`, défaut 3001).
startApiServer(parseInt(process.env.PORT ?? process.env.BOT_API_PORT ?? "3001", 10));

// Wire Discord events to WebSocket pub/sub topics
setupEventBridge();

// Check Discord session availability via REST API
async function waitForSessions(token: string): Promise<void> {
  const { REST, Routes } = await import("discord.js");
  const rest = new REST().setToken(token);
  const CHECK_INTERVAL = 5 * 60_000; // Re-check every 5 minutes

  while (true) {
    try {
      const gateway = (await rest.get(Routes.gatewayBot())) as {
        session_start_limit: {
          total: number;
          remaining: number;
          reset_after: number;
        };
      };
      const { remaining, reset_after } = gateway.session_start_limit;
      logger.info(
        `[Bot] Sessions: ${remaining} remaining (resets in ${Math.round(reset_after / 60000)}min)`,
      );

      if (remaining > 0) {
        logger.info("[Bot] Sessions available, proceeding to login...");
        return;
      }

      const waitMs = Math.min(reset_after + 5000, CHECK_INTERVAL);
      logger.warn(
        `[Bot] No sessions remaining. Re-checking in ${Math.round(waitMs / 60000)}min...`,
      );
      await new Promise((r) => setTimeout(r, waitMs));
    } catch (e) {
      logger.warn("[Bot] Could not check session limit, retrying in 5min:", e);
      await new Promise((r) => setTimeout(r, CHECK_INTERVAL));
    }
  }
}

async function run() {
  // Config DI
  DIService.engine = tsyringeDependencyRegistryEngine.setInjector(container);

  // Enregistre ConfigService dans le container AVANT l'import des modules décorés
  // (les commandes/events qui l'injectent doivent trouver le singleton déjà résolu).
  const { ConfigService } = await import("./lib/config-service.js");
  container.registerSingleton(ConfigService);

  // Import Commands/Events/Components
  // Static side-effect import — the bundler needs to see every decorated file
  // as a direct dependency so `bun build --compile` packs them into the binary.
  // The file is generated by `scripts/gen-entry-imports.ts` (prebuild hook).
  await import("./_entry-imports.generated.js");

  // Login
  if (!process.env.DISCORD_TOKEN) throw Error("Could not find DISCORD_TOKEN in environment");

  // Wait for sessions to be available before connecting
  await waitForSessions(process.env.DISCORD_TOKEN);

  // Music (discord-player) retiré — aucune slash command ne l'utilisait.
  // Peer deps (@discordjs/voice, @discordjs/opus, prism-media, play-dl,
  // ffmpeg-static, libsodium-wrappers) ne sont plus installées.

  await bot.login(process.env.DISCORD_TOKEN);

  // Replace singleton-guard's synchronous signal handlers with proper async
  // graceful shutdown that first drains Discord + DB before exiting.
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.removeAllListeners(sig);
    process.once(sig, () => void gracefulShutdown(sig));
  }

  bot.once("clientReady", async () => {
    try {
      const guildId = process.env.GUILD_ID || process.env.DISCORD_GUILD_ID;

      // Clear global commands to avoid duplicates
      await bot.clearApplicationCommands();
      logger.info("[Bot] Global commands cleared.");

      if (guildId) {
        logger.info(`[Bot] Syncing commands for guild: ${guildId}`);
      }

      // Register commands via discordx (handles guild registration automatically)
      await bot.initApplicationCommands();

      logger.info(
        `[Bot] Logged in as ${bot.user?.tag} — ${bot.applicationCommands.length} commands registered.`,
      );

      // Start scheduled tasks
      const { setupCronJobs } = await import("./cron/index.js");
      setupCronJobs();

      // Seed la config DB depuis les constantes si absente : le dashboard reflète
      // l'état réel (canaux/rôles/économie) dès le boot, sans attendre un event.
      if (guildId) {
        await container.resolve(ConfigService).ensureSeed(guildId);
      }
    } catch (e) {
      logger.error("[Bot] Failed to init application commands:", e);
    }
  });

  // Cache bot settings to avoid DB query on every interaction
  let cachedSettings: {
    maintenanceMode?: boolean;
    disabledCommands?: string[];
  } | null = null;
  let settingsCacheTime = 0;
  const SETTINGS_CACHE_TTL = 30_000; // 30 seconds

  async function getBotSettings() {
    const now = Date.now();
    if (cachedSettings && now - settingsCacheTime < SETTINGS_CACHE_TTL) {
      return cachedSettings;
    }
    try {
      const block = await prisma.contentBlock.findUnique({
        where: { slug: "bot-settings" },
      });
      cachedSettings = block?.content ? JSON.parse(block.content) : null;
    } catch {
      cachedSettings = null;
    }
    settingsCacheTime = now;
    return cachedSettings;
  }

  bot.on("interactionCreate", async (interaction) => {
    try {
      // Skip settings check for autocomplete (must respond in < 3s)
      if (interaction.isAutocomplete()) {
        return void bot.executeInteraction(interaction);
      }

      // Only check settings for commands
      if (interaction.isCommand()) {
        const settings = await getBotSettings();
        if (settings) {
          if (settings.maintenanceMode) {
            const perms = interaction.member?.permissions;
            const isAdmin =
              perms instanceof PermissionsBitField ? perms.has("Administrator") : false;
            if (!isAdmin) {
              return interaction.reply({
                content:
                  "🛠️ **Le bot est actuellement en maintenance.**\nNous revenons très vite ! Suivez les annonces pour plus d'infos.",
                flags: MessageFlags.Ephemeral,
              });
            }
          }

          const { disabledCommands = [] } = settings;
          if (disabledCommands.includes(interaction.commandName)) {
            return interaction.reply({
              content: "⚠️ Cette commande est temporairement désactivée par un administrateur.",
              flags: MessageFlags.Ephemeral,
            });
          }
        }
      }

      void bot.executeInteraction(interaction);
    } catch (e) {
      logger.error("[Bot] Interaction error:", e);
      // Best-effort ephemeral fallback so the user doesn't see a stuck spinner.
      if (interaction.isRepliable()) {
        const content = "Une erreur est survenue. Veuillez réessayer.";
        try {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content, flags: MessageFlags.Ephemeral });
          } else if (interaction.deferred) {
            await interaction.editReply(content);
          }
        } catch {
          // Already replied or timed out — ignore.
        }
      }
    }
  });

  bot.on("messageCreate", async (message) => {
    try {
      // Global Disabled Commands Check
      const prefix = "!";
      if (message.content.startsWith(prefix)) {
        const cmdName = message.content.slice(prefix.length).split(" ")[0];
        const settingsBlock = await prisma.contentBlock.findUnique({
          where: { slug: "bot-settings" },
        });
        if (settingsBlock?.content) {
          const { disabledCommands = [] } = JSON.parse(settingsBlock.content);
          if (disabledCommands.includes(cmdName)) {
            return message.reply("⚠️ Cette commande est temporairement désactivée.");
          }
        }
      }
      void bot.executeCommand(message);
    } catch (e) {
      logger.error("[Bot] Message command error:", e);
    }
  });
}

// Global error handlers
// unhandledRejection: log and keep running (discord.js may reject promises on
// reconnect races; crashing the process would be worse than the leak).
process.on("unhandledRejection", (err) => {
  logger.error("[Process] unhandledRejection:", err);
});
// uncaughtException: singleton-guard already registered a process.once handler
// that releases the PID lock and calls process.exit(1). We add a second handler
// here only to log the error to the structured logger before that exit fires.
process.on("uncaughtException", (err) => {
  logger.fatal("[Process] uncaughtException:", err);
});

void run().catch(async (err) => {
  logger.error("Fatal Startup Error:", err);
  // Wait 60s before exiting to avoid rapid restart loops burning Discord sessions
  logger.info("[Bot] Waiting 60s before exit to prevent session burn...");
  await new Promise((r) => setTimeout(r, 60_000));
  process.exit(1);
});
