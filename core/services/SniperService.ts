/**
 * Service Sniper - Détecte et agit automatiquement sur certains événements
 * Nitro Sniper, Giveaway Joiner, Block Detection, etc.
 */

import { EventEmitter } from 'events';
import { logger } from './Logger';
import { rateLimiter } from './RateLimiter';

export interface SniperConfig {
  nitroSniper: boolean;
  giveawayJoiner: boolean;
  blockDetection: boolean;
  pingDetection: boolean;
  whitelistUsers: string[]; // IDs d'utilisateurs à ignorer
  blacklistGuilds: string[]; // IDs de serveurs à ignorer
}

export interface GiveawayInfo {
  messageId: string;
  channelId: string;
  guildId?: string;
  hostId: string;
  prize: string;
  duration?: number;
  reacted: boolean;
}

export class SniperService extends EventEmitter {
  private config: SniperConfig = {
    nitroSniper: false,
    giveawayJoiner: false,
    blockDetection: false,
    pingDetection: false,
    whitelistUsers: [],
    blacklistGuilds: []
  };

  // Track les giveaways détectés pour éviter double join
  private activeGiveaways = new Map<string, GiveawayInfo>();
  
  // Track les derniers codes Nitro tentés (éviter spam)
  private recentNitroCodes = new Set<string>();

  // Callbacks pour actions
  private messageHandler?: {
    sendMessage: (channelId: string, content: string) => Promise<void>;
    addReaction: (messageId: string, channelId: string, emoji: string) => Promise<void>;
    redeemNitro: (code: string) => Promise<{ success: boolean; message?: string }>;
  };

  setMessageHandler(handler: {
    sendMessage: (channelId: string, content: string) => Promise<void>;
    addReaction: (messageId: string, channelId: string, emoji: string) => Promise<void>;
    redeemNitro: (code: string) => Promise<{ success: boolean; message?: string }>;
  }): void {
    this.messageHandler = handler;
  }

  updateConfig(newConfig: Partial<SniperConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Sniper', `Config updated - Nitro: ${this.config.nitroSniper}, Giveaway: ${this.config.giveawayJoiner}`);
  }

  getConfig(): SniperConfig {
    return { ...this.config };
  }

  // ============================================================================
  // NITRO SNIPER
  // ============================================================================

  async handleMessage(message: any): Promise<void> {
    if (!this.messageHandler) return;

    // Ignore les messages du bot lui-même
    if (message.author?.id === message.client?.user?.id) return;

    // Check whitelist/blacklist
    if (this.config.whitelistUsers.includes(message.author?.id)) return;
    if (message.guild?.id && this.config.blacklistGuilds.includes(message.guild.id)) return;

    const content = message.content || '';

    // Nitro Sniper
    if (this.config.nitroSniper) {
      await this.checkNitroCode(content, message);
    }

    // Giveaway Joiner
    if (this.config.giveawayJoiner) {
      await this.checkGiveaway(message);
    }

    // Ping Detection
    if (this.config.pingDetection && message.mentions?.users?.has(message.client?.user?.id)) {
      this.emit('pingDetected', {
        userId: message.author?.id,
        userTag: message.author?.tag,
        content: content,
        channelId: message.channel?.id,
        guildId: message.guild?.id
      });
    }
  }

  private async checkNitroCode(content: string, message: any): Promise<void> {
    // Regex pour détecter les codes Discord Nitro
    const nitroRegex = /(discord\.gift\/|discordapp\.com\/gifts\/|discord\.com\/gifts\/)([a-zA-Z0-9]{16,24})/gi;
    const matches = [...content.matchAll(nitroRegex)];

    for (const match of matches) {
      const code = match[2];
      
      // Évite de spammer le même code
      if (this.recentNitroCodes.has(code)) continue;
      this.recentNitroCodes.add(code);
      setTimeout(() => this.recentNitroCodes.delete(code), 60000); // Cleanup après 1min

      logger.info('Sniper', `Nitro code detected: ${code}`);
      
      try {
        // Redeem le code
        const result = await this.messageHandler!.redeemNitro(code);
        
        if (result.success) {
          logger.info('Sniper', `Nitro redeemed successfully!`);
          this.emit('nitroRedeemed', {
            code,
            message: result.message,
            source: {
              channelId: message.channel?.id,
              guildId: message.guild?.id,
              authorId: message.author?.id
            }
          });
        } else {
          logger.warn('Sniper', `Failed to redeem Nitro: ${result.message}`);
        }
      } catch (err) {
        logger.error('Sniper', 'Error redeeming Nitro', err);
      }
    }
  }

  // ============================================================================
  // GIVEAWAY JOINER
  // ============================================================================

  private async checkGiveaway(message: any): Promise<void> {
    // Détection des bots de giveaway connus
    const giveawayBots = ['GiveawayBot', 'Carl-bot', 'Dyno', 'MEE6', 'GAwesomeBot'];
    const isGiveawayBot = giveawayBots.some(botName => 
      message.author?.username?.includes(botName) || 
      message.author?.bot
    );

    if (!isGiveawayBot) return;

    const content = message.content?.toLowerCase() || '';
    const embeds = message.embeds || [];

    // Check si c'est un giveaway
    const isGiveaway = 
      content.includes('giveaway') || 
      content.includes('🎉') ||
      embeds.some((e: any) => 
        e.title?.toLowerCase().includes('giveaway') ||
        e.description?.toLowerCase().includes('react with') ||
        e.description?.toLowerCase().includes('click the button')
      );

    if (!isGiveaway) return;

    // Évite les doublons
    if (this.activeGiveaways.has(message.id)) return;

    const giveaway: GiveawayInfo = {
      messageId: message.id,
      channelId: message.channel?.id,
      guildId: message.guild?.id,
      hostId: message.author?.id,
      prize: this.extractPrize(message),
      reacted: false
    };

    this.activeGiveaways.set(message.id, giveaway);
    logger.info('Sniper', `Giveaway detected: ${giveaway.prize}`);

    // Rejoins le giveaway
    await this.joinGiveaway(message, giveaway);
  }

  private extractPrize(message: any): string {
    const embed = message.embeds?.[0];
    if (embed) {
      // Cherche le prix dans le titre ou description
      const text = (embed.title || '') + ' ' + (embed.description || '');
      const match = text.match(/prize[:\s]+([^\n]+)/i) || 
                    text.match(/giveaway[:\s]+([^\n]+)/i) ||
                    text.match(/🎉\s*([^\n]+)/);
      if (match) return match[1].trim();
    }
    return 'Unknown Prize';
  }

  private async joinGiveaway(message: any, giveaway: GiveawayInfo): Promise<void> {
    try {
      // Essaie de réagir avec l'emoji 🎉 (le plus commun)
      await rateLimiter.schedule(
        `channels/${giveaway.channelId}/messages/${giveaway.messageId}/reactions`,
        async () => {
          await this.messageHandler!.addReaction(
            giveaway.messageId,
            giveaway.channelId,
            '🎉'
          );
        },
        8
      );

      giveaway.reacted = true;
      this.activeGiveaways.set(message.id, giveaway);

      logger.info('Sniper', `Joined giveaway: ${giveaway.prize}`);
      this.emit('giveawayJoined', giveaway);
    } catch (err) {
      logger.error('Sniper', 'Error joining giveaway', err);
    }
  }

  // ============================================================================
  // BLOCK DETECTION
  // ============================================================================

  handleRelationshipUpdate(oldRelationship: any, newRelationship: any): void {
    if (!this.config.blockDetection) return;

    // Type 0 = aucune relation, vérifier si c'était un ami avant
    const wasFriend = oldRelationship?.type === 1 || oldRelationship?.type === 'friend';
    const isNowBlocked = newRelationship?.type === 2 || newRelationship?.type === 'blocked';
    const isNowNone = newRelationship?.type === 0 || newRelationship?.type === 'none';

    if (wasFriend && (isNowBlocked || isNowNone)) {
      const userId = newRelationship.id || newRelationship.user?.id;
      const userTag = newRelationship.user?.tag || 'Unknown';

      // Si le type est none mais qu'on était amis avant, c'est soit unfriend soit block
      // On ne peut pas différencier précisément sans plus d'infos
      logger.info('Sniper', `Relationship ended with ${userTag}`);
      
      this.emit('relationshipEnded', {
        userId,
        userTag,
        wasBlocked: isNowBlocked,
        timestamp: Date.now()
      });
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  cleanupOldGiveaways(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (const [id, giveaway] of this.activeGiveaways) {
      // Supprime les giveaways vieux de plus d'1 heure
      // Note: On n'a pas la date de création, donc on utilise une méthode alternative
      // ou on pourrait ajouter un timestamp dans GiveawayInfo
    }
  }

  getActiveGiveaways(): GiveawayInfo[] {
    return Array.from(this.activeGiveaways.values());
  }
}
