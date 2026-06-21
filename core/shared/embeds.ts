import { EmbedBuilder } from 'discord.js';

export const ECLIPSE_COLOR = 0xe69a00;
export const ECLIPSE_ERROR_COLOR = 0xd4656b;

export interface EclipseEmbedOptions {
  title?: string;
  description?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  color?: number;
  thumbnail?: string | null;
  image?: string;
  footerText?: string;
  footerIconURL?: string | null;
  timestamp?: number | Date | null;
  author?: { name: string; iconURL?: string } | null;
}

export function buildEclipseEmbed(
  opts: EclipseEmbedOptions = {},
  interaction?: { client?: { user?: { displayAvatarURL?: (o?: { size?: number }) => string } } }
): EmbedBuilder {
  let botAvatar: string | undefined;
  let footerIcon: string | undefined;
  try {
    if (interaction?.client?.user?.displayAvatarURL) {
      botAvatar = interaction.client.user.displayAvatarURL({ size: 256 });
      footerIcon = interaction.client.user.displayAvatarURL({ size: 32 });
    }
  } catch {
    // ignore — bot avatar not resolvable
  }

  const embed = new EmbedBuilder().setColor(opts.color ?? ECLIPSE_COLOR);

  if (opts.title) embed.setTitle(opts.title);
  if (opts.description) embed.setDescription(opts.description);
  if (opts.fields?.length) embed.addFields(opts.fields);
  if (opts.image) embed.setImage(opts.image);

  const thumb = opts.thumbnail === null ? null : (opts.thumbnail ?? botAvatar);
  if (thumb) embed.setThumbnail(thumb);

  const footerText = opts.footerText ?? 'Eclipse';
  const footerIconURL = opts.footerIconURL === null ? null : (opts.footerIconURL ?? footerIcon);
  if (footerText || footerIconURL) {
    embed.setFooter({ text: footerText, ...(footerIconURL ? { iconURL: footerIconURL } : {}) });
  }

  if (opts.timestamp !== null) embed.setTimestamp(opts.timestamp ?? Date.now());
  if (opts.author) embed.setAuthor(opts.author);

  return embed;
}

type AnyInteraction = { client?: { user?: { displayAvatarURL?: (o?: { size?: number }) => string } } };

export function eclipseEmbedPayload(opts: EclipseEmbedOptions, interaction?: AnyInteraction) {
  return { embeds: [buildEclipseEmbed(opts, interaction)], ephemeral: true };
}

export function eclipseAck(text: string, interaction?: AnyInteraction, isError = false) {
  return eclipseEmbedPayload(
    { description: text, color: isError ? ECLIPSE_ERROR_COLOR : ECLIPSE_COLOR },
    interaction
  );
}
