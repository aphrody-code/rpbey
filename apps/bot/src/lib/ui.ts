/**
 * ui.ts — Centralized UI factory for RPB Bot
 *
 * Re-exports and wraps embed helpers from utils.ts, plus:
 * - infoEmbed
 * - confirmRow / paginationRow / linkButton / actionButton
 * - Components V2 helpers (v2Container)
 *
 * RULE: A V2 message CANNOT have embeds/content alongside components.
 * Images must use MediaGalleryItemBuilder.setURL('attachment://file.png') + files.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  type AttachmentBuilder,
  type EmbedBuilder,
} from "discord.js";

import { Colors, RPB } from "./constants.js";
import { createEmbed, errorEmbed, successEmbed, warningEmbed } from "./utils.js";

// ─── Re-exports from utils.ts ────────────────────────────────────────────────

export { createEmbed, errorEmbed, successEmbed, warningEmbed };

// ─── infoEmbed ───────────────────────────────────────────────────────────────

/**
 * Create an info-styled embed (blue).
 */
export function infoEmbed(title: string, description?: string): EmbedBuilder {
  return createEmbed({
    title: `ℹ️ ${title}`,
    description,
    color: Colors.Info,
  });
}

// ─── Button factories ─────────────────────────────────────────────────────────

/**
 * Build a confirm/cancel action row.
 * @param idYes  customId for the confirm button
 * @param idNo   customId for the cancel button
 * @param labels override default labels (first = confirm, second = cancel)
 */
export function confirmRow(
  idYes: string,
  idNo: string,
  labels: [string, string] = ["✅ Confirmer", "❌ Annuler"],
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(idYes).setLabel(labels[0]).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(idNo).setLabel(labels[1]).setStyle(ButtonStyle.Secondary),
  );
}

/**
 * Build a pagination row with prev/next buttons.
 * Buttons are disabled when at the boundary.
 * @param prefix     customId prefix — IDs will be `<prefix>-prev-<page>` / `<prefix>-next-<page>`
 * @param page       current 0-based page
 * @param totalPages total number of pages
 */
export function paginationRow(
  prefix: string,
  page: number,
  totalPages: number,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}-prev-${page}`)
      .setLabel("◀")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`${prefix}-page-${page}`)
      .setLabel(`${page + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${prefix}-next-${page}`)
      .setLabel("▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );
}

/**
 * Build a link button (URL).
 */
export function linkButton(label: string, url: string): ButtonBuilder {
  return new ButtonBuilder().setLabel(label).setURL(url).setStyle(ButtonStyle.Link);
}

/**
 * Build an action row with a single link button.
 */
export function linkButtonRow(label: string, url: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(linkButton(label, url));
}

/**
 * Build an action button (with optional emoji).
 */
export function actionButton(
  id: string,
  label: string,
  style: ButtonStyle = ButtonStyle.Primary,
  emoji?: string,
): ButtonBuilder {
  const btn = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
  if (emoji) btn.setEmoji(emoji);
  return btn;
}

// ─── Components V2 ───────────────────────────────────────────────────────────

/**
 * Options for v2Container helper.
 */
export interface V2ContainerOptions {
  /** Accent color as 0xRRGGBB integer */
  accentColor?: number;
  /** Text sections to render inside the container */
  sections: Array<{
    /** Markdown content rendered as TextDisplay */
    content: string;
    /** Optional single action button to attach to this section */
    button?: ButtonBuilder;
  }>;
  /**
   * Optional image attachment filename (e.g. 'profile.png').
   * The file must be supplied in the `files` array of the reply.
   * Renders as a MediaGallery at the bottom of the container.
   */
  imageFilename?: string;
  /** Insert a separator before the image gallery */
  imageSeparator?: boolean;
}

/**
 * Build a Components V2 container payload.
 *
 * Usage:
 * ```ts
 * const { components, flags } = v2Container({ accentColor: 0xdc2626, sections: [...], imageFilename: 'card.png' });
 * await interaction.editReply({ components, flags, files: [attachment] });
 * ```
 *
 * IMPORTANT: Do not add `embeds` or `content` to a V2 message — Discord ignores/errors them.
 */
export function v2Container(options: V2ContainerOptions): {
  components: ContainerBuilder[];
  flags: number;
} {
  const container = new ContainerBuilder();

  if (options.accentColor !== undefined) {
    container.setAccentColor(options.accentColor);
  }

  for (const section of options.sections) {
    if (section.button) {
      const sec = new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(section.content))
        .setButtonAccessory(section.button);
      container.addSectionComponents(sec);
    } else {
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(section.content));
    }
  }

  if (options.imageFilename) {
    if (options.imageSeparator !== false) {
      container.addSeparatorComponents(new SeparatorBuilder());
    }
    const gallery = new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(`attachment://${options.imageFilename}`),
    );
    container.addMediaGalleryComponents(gallery);
  }

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

/**
 * Build a minimal Components V2 text-only message payload.
 * Convenience wrapper over v2Container for single-text panels.
 */
export function v2Text(
  content: string,
  accentColor?: number,
): {
  components: ContainerBuilder[];
  flags: number;
} {
  return v2Container({ accentColor, sections: [{ content }] });
}

/**
 * Build a Components V2 image card payload.
 * The canvas attachment filename is embedded via MediaGallery.
 *
 * @param header     markdown text shown above the image
 * @param filename   attachment filename (e.g. 'profile.png')
 * @param accentColor optional hex color for the container accent
 */
export function v2ImageCard(
  header: string,
  filename: string,
  accentColor?: number,
): {
  components: ContainerBuilder[];
  flags: number;
} {
  return v2Container({
    accentColor,
    sections: [{ content: header }],
    imageFilename: filename,
    imageSeparator: false,
  });
}

/**
 * Build a V2 battle result panel.
 * Displays a header text block + canvas battle card image.
 */
export function v2BattlePanel(
  headerLines: string[],
  imageFilename: string,
  accentColor: number = Colors.Primary,
  revengeButton?: ButtonBuilder,
): {
  components: ContainerBuilder[];
  flags: number;
} {
  const content = headerLines.join("\n");
  const sections: V2ContainerOptions["sections"] = revengeButton
    ? [{ content, button: revengeButton }]
    : [{ content }];

  return v2Container({
    accentColor,
    sections,
    imageFilename,
    imageSeparator: false,
  });
}

// ─── Helpers for common error/success V2 responses ───────────────────────────

/**
 * A Components V2 error panel (red accent, ❌ prefix).
 */
export function v2Error(message: string): {
  components: ContainerBuilder[];
  flags: number;
} {
  return v2Text(`❌ **Erreur**\n${message}`, Colors.Error);
}

/**
 * A Components V2 success panel (green accent, ✅ prefix).
 */
export function v2Success(message: string): {
  components: ContainerBuilder[];
  flags: number;
} {
  return v2Text(`✅ ${message}`, Colors.Success);
}

/**
 * A Components V2 warning panel (orange accent, ⚠️ prefix).
 */
export function v2Warning(message: string): {
  components: ContainerBuilder[];
  flags: number;
} {
  return v2Text(`⚠️ ${message}`, Colors.Warning);
}

// ─── Profile V2 panel ────────────────────────────────────────────────────────

/**
 * Build a V2 profile panel with canvas card image.
 * @param displayName Discord display name
 * @param rankTitle   rank label (e.g. "Expert")
 * @param rank        global rank number
 * @param points      ranking points
 * @param wins        wins count
 * @param losses      losses count
 * @param winRate     win rate string (e.g. "72%")
 * @param imageFilename attachment filename (e.g. 'profile.png')
 */
export function v2ProfilePanel(
  displayName: string,
  rankTitle: string,
  rank: number,
  points: number,
  wins: number,
  losses: number,
  winRate: string,
  imageFilename: string,
): {
  components: ContainerBuilder[];
  flags: number;
} {
  const header =
    `## 👤 ${displayName}\n` +
    `**${rankTitle}** · Rang #${rank} · ${points} pts\n` +
    `⚔️ ${wins}V / ${losses}D · ${winRate}\n` +
    `\n*${RPB.FullName}*`;

  return v2Container({
    accentColor: Colors.Primary,
    sections: [
      {
        content: header,
        button: new ButtonBuilder()
          .setLabel("Voir en ligne")
          .setURL("https://rpbey.fr/dashboard")
          .setStyle(ButtonStyle.Link),
      },
    ],
    imageFilename,
    imageSeparator: false,
  });
}

/**
 * Build a V2 gacha card pull panel.
 * @param title        card title / rarity label
 * @param description  card description markdown
 * @param imageFilename attachment filename (e.g. 'card.png') or undefined for embed fallback
 * @param accentColor  rarity color
 */
export function v2GachaPullPanel(
  title: string,
  description: string,
  imageFilename: string | undefined,
  accentColor: number,
  _attachments?: AttachmentBuilder[],
): {
  components: ContainerBuilder[];
  flags: number;
} | null {
  // Only produce V2 panel when we have a canvas image
  if (!imageFilename) return null;
  const content = `## ${title}\n${description}`;
  return v2Container({
    accentColor,
    sections: [{ content }],
    imageFilename,
    imageSeparator: false,
  });
}

/**
 * Build a V2 duel result panel.
 */
export function v2DuelResultPanel(
  winnerName: string,
  loserName: string,
  score: string,
  finishMsg: string,
  eloLine: string,
  summaryLines: string[],
  imageFilename: string,
  accentColor: number,
  revengeButton?: ButtonBuilder,
): {
  components: ContainerBuilder[];
  flags: number;
} {
  const content =
    `## ${finishMsg}\n` +
    `🏆 **${winnerName}** bat **${loserName}** (**${score}**)\n\n` +
    summaryLines.join("\n") +
    `\n\n${eloLine}`;

  const sections: V2ContainerOptions["sections"] = revengeButton
    ? [{ content, button: revengeButton }]
    : [{ content }];

  return v2Container({
    accentColor,
    sections,
    imageFilename,
    imageSeparator: false,
  });
}

/**
 * Build a V2 deck panel with canvas card image.
 */
export function v2DeckPanel(
  deckName: string,
  isActive: boolean,
  imageFilename: string,
): {
  components: ContainerBuilder[];
  flags: number;
} {
  const activeLabel = isActive ? "⭐ Deck actif" : "Deck";
  const content = `## ${activeLabel}: ${deckName}`;
  return v2Container({
    accentColor: isActive ? Colors.Primary : Colors.Secondary,
    sections: [{ content }],
    imageFilename,
    imageSeparator: false,
  });
}
