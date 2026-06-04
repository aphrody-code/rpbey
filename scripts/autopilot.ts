import { $ } from "bun";
import { resolve } from "node:path";
import { mkdir, appendFile } from "node:fs/promises";
import { homedir } from "node:os";
import { which } from "bun";

// Parse arguments
let interval = 60;
let maxTicks = 0;
let once = false;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--interval" && args[i + 1]) {
    interval = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === "--max-ticks" && args[i + 1]) {
    maxTicks = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === "--once") {
    once = true;
  }
}

if (once) {
  maxTicks = 1;
}

const root = resolve(import.meta.dir, "..");
const planPath = resolve(root, "docs/PLAN.md");
const heartbeatPath = resolve(root, "ai/heartbeat.txt");
const logPath = resolve(root, "var/log/autopilot.jsonl");
const pidPath = resolve(root, "var/run/autopilot.pid");

// Ensure directories exist
await mkdir(resolve(root, "var/run"), { recursive: true });
await mkdir(resolve(root, "var/log"), { recursive: true });
await mkdir(resolve(root, "ai"), { recursive: true });

// Save PID
await Bun.write(pidPath, process.pid.toString());

console.log(`=== Aphrody Autopilot Started (PID: ${process.pid}) ===`);
console.log(`Logging to: ${logPath}`);

// Ensure CLI bins are in PATH
let claudeBin = await which("claude");
if (!claudeBin) {
  const localBin = resolve(homedir(), ".local/bin");
  process.env.PATH = `${localBin}:${process.env.PATH}`;
  claudeBin = await which("claude");
}

async function getActiveTask(): Promise<string> {
  const f = Bun.file(planPath);
  if (!(await f.exists())) return "Idle";
  const content = await f.text();
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if ((trimmed.startsWith("-") || trimmed.startsWith("*")) && trimmed.includes("⏳")) {
      const parts = trimmed.split("⏳");
      if (parts.length > 1) {
        let task = parts[1].replace(/`/g, "").trim();
        if (task.startsWith("]")) {
          task = task.slice(1).trim();
        }
        return task;
      }
    }
  }
  return "Idle";
}

async function markTaskCompleted() {
  const f = Bun.file(planPath);
  if (!(await f.exists())) return;
  const content = await f.text();
  const newContent = content.replace("⏳", "✅");
  await Bun.write(planPath, newContent);
  console.log("Marked task as completed.");
}

async function runWithTimeout(cmd: string[], timeoutMs: number): Promise<string> {
  try {
    const proc = Bun.spawn(cmd, {
      stdout: "pipe",
      stderr: "pipe",
      stdin: "null",
    });

    const timer = setTimeout(() => {
      proc.kill();
    }, timeoutMs);

    const exitCode = await proc.exited;
    clearTimeout(timer);

    const stdoutText = await new Response(proc.stdout).text();
    const stderrText = await new Response(proc.stderr).text();
    const merged = (stdoutText + "\n" + stderrText).trim();

    return merged;
  } catch (error) {
    return `Error running command: ${error}`;
  }
}

let tick = 0;
while (true) {
  tick++;
  if (maxTicks > 0 && tick > maxTicks) {
    console.log(`Reached max ticks (${maxTicks}). Stopping.`);
    break;
  }

  console.log(`\n--- Tick ${tick} (Interval: ${interval}s) ---`);

  const task = await getActiveTask();
  const timestamp = new Date().toISOString();
  console.log(`Active Task: ${task}`);

  // Write Heartbeat
  await Bun.write(heartbeatPath, `${timestamp} - Tick ${tick} - ${task}`);

  if (task === "Idle") {
    console.log("No pending tasks in PLAN.md. Resting.");
    const logEntry = {
      ts: timestamp,
      tick,
      task,
      claude: "",
      gemini: "No tasks found",
    };
    await appendFile(logPath, JSON.stringify(logEntry) + "\n");

    if (once) break;
    await Bun.sleep(interval * 1000);
    continue;
  }

  // Claude Lane (Execution)
  console.log("Running Claude Lane...");
  let claudeOutput = "";
  if (claudeBin) {
    const prompt = `You are an autonomous developer agent. Implement this task: '${task}'. Modify files as needed. Do NOT run 'next build', 'bun run build', or 'bun run build:web' locally, as they are known to segfault under Bun (Vercel builds successfully using Node in production). Verify that 'bun run test:all', 'bun run lint', and 'bun run docs:check' pass cleanly. Commit the changes using a French Conventional Commit message. Do not add co-author trailers.`;
    claudeOutput = await runWithTimeout(
      [claudeBin, "--print", "--permission-mode", "bypassPermissions", prompt],
      600 * 1000, // 10 minutes timeout
    );
  } else {
    claudeOutput = "Err: claude binary not found in PATH";
  }

  // Gemini Lane (Audit)
  console.log("Running Gemini Lane...");
  let geminiOutput = "";
  const geminiBin = await which("gemini");
  if (geminiBin) {
    const auditPrompt =
      "Audit the most recent commit in this repository. Verify against the best-stack-2026 guidelines (no GPL licenses, optimal Bun/TypeScript modules, fully cross-platform path handling). Output a strict JSON report summarizing your findings.";
    geminiOutput = await runWithTimeout(
      [geminiBin, "--prompt", auditPrompt],
      60 * 1000, // 1 minute timeout
    );
  } else {
    geminiOutput = "Mock: Gemini binary not found";
  }

  // Log entry
  const logEntry = {
    ts: timestamp,
    tick,
    task,
    claude: claudeOutput.slice(0, 800),
    gemini: geminiOutput.slice(0, 800),
  };
  await appendFile(logPath, JSON.stringify(logEntry) + "\n");

  // Mark completed
  await markTaskCompleted();

  // Update docs index automatically
  try {
    await $`bun run docs`.cwd(root).quiet();
  } catch {
    // Ignore doc generation failure
  }

  if (once) break;
  await Bun.sleep(interval * 1000);
}
