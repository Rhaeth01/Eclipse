/**
 * CloneService — réplication de serveurs Discord.
 * Clone les rôles, salons, emojis et paramètres d'un serveur source vers un nouveau serveur.
 * Voir AGENTS.md roadmap (🟢 Medium).
 */

import type { DiscordREST } from '../discord/DiscordREST';
import { logger } from './Logger';

export interface CloneProgress {
  step: string;
  current: number;
  total: number;
}

export interface CloneResult {
  success: boolean;
  newGuildId?: string;
  rolesCreated: number;
  channelsCreated: number;
  emojisCreated: number;
  error?: string;
}

export class CloneService {
  /**
   * Clone un serveur source vers un nouveau serveur.
   * @param sourceGuildId ID du serveur à cloner
   * @param targetName Nom du nouveau serveur
   * @param rest Client REST pour les appels API
   * @param onProgress Callback de progression (optionnel)
   */
  async cloneGuild(
    sourceGuildId: string,
    targetName: string,
    rest: DiscordREST,
    onProgress?: (p: CloneProgress) => void
  ): Promise<CloneResult> {
    try {
      onProgress?.({ step: 'Récupération du serveur source', current: 0, total: 4 });

      // 1. Récupérer les données du serveur source
      const sourceRoles = await rest.fetchGuildRoles(sourceGuildId);
      const sourceChannels = await rest.fetchGuildChannels(sourceGuildId);

      // 2. Créer le nouveau serveur
      onProgress?.({ step: 'Création du serveur', current: 1, total: 4 });
      const { data: newGuild } = await (rest as any).request('POST', '/guilds', { name: targetName });
      const newGuildId = newGuild.id;
      logger.info('Clone', `Nouveau serveur créé: ${newGuildId}`);

      // 3. Cloner les rôles (sauf @everyone qui existe déjà)
      onProgress?.({ step: 'Clonage des rôles', current: 2, total: 4 });
      let rolesCreated = 0;
      const roleMap = new Map<string, string>(); // oldId -> newId
      for (const role of sourceRoles) {
        if (role.name === '@everyone') continue;
        try {
          const { data: newRole } = await (rest as any).request('POST', `/guilds/${newGuildId}/roles`, {
            name: role.name,
            color: role.color,
            hoist: role.hoist,
            mentionable: role.mentionable,
            permissions: role.permissions,
          });
          roleMap.set(role.id, newRole.id);
          rolesCreated++;
          await new Promise(r => setTimeout(r, 400 + Math.random() * 200));
        } catch (err) {
          logger.warn('Clone', `Impossible de cloner le rôle ${role.name}`, err);
        }
      }

      // 4. Cloner les salons
      onProgress?.({ step: 'Clonage des salons', current: 3, total: 4 });
      let channelsCreated = 0;
      const channelMap = new Map<string, string>(); // oldId -> newId
      // Trier par position pour recréer l'ordre
      const sortedChannels = [...sourceChannels].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      for (const channel of sortedChannels) {
        try {
          const body: any = {
            name: channel.name,
            type: channel.type,
          };
          if (channel.parent_id && channelMap.has(channel.parent_id)) {
            body.parent_id = channelMap.get(channel.parent_id);
          }
          const { data: newChannel } = await (rest as any).request('POST', `/guilds/${newGuildId}/channels`, body);
          channelMap.set(channel.id, newChannel.id);
          channelsCreated++;
          await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
        } catch (err) {
          logger.warn('Clone', `Impossible de cloner le salon ${channel.name}`, err);
        }
      }

      // 5. Emojis (optionnel — nécessite une récupération séparée)
      onProgress?.({ step: 'Terminé', current: 4, total: 4 });
      let emojisCreated = 0;
      try {
        const { data: emojis } = await (rest as any).request('GET', `/guilds/${sourceGuildId}/emojis`);
        if (Array.isArray(emojis)) {
          for (const emoji of emojis.slice(0, 50)) {
            try {
              await (rest as any).request('POST', `/guilds/${newGuildId}/emojis`, {
                name: emoji.name,
                image: emoji.image?.url || `https://cdn.discordapp.com/emojis/${emoji.id}.png`,
              });
              emojisCreated++;
              await new Promise(r => setTimeout(r, 500));
            } catch {
              // Emoji peut dépasser la limite
            }
          }
        }
      } catch {
        // Emojis non disponibles
      }

      logger.info('Clone', `Clonage terminé: ${rolesCreated} rôles, ${channelsCreated} salons, ${emojisCreated} emojis.`);
      return { success: true, newGuildId, rolesCreated, channelsCreated, emojisCreated };
    } catch (err) {
      logger.error('Clone', 'Erreur lors du clonage', err);
      return { success: false, rolesCreated: 0, channelsCreated: 0, emojisCreated: 0, error: String(err) };
    }
  }
}
