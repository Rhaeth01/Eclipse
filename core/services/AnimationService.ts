/**
 * Service de gestion des animations (Custom Status et Rich Presence)
 * Évite la duplication de code entre les animations simples et RPC
 */

import { DiscordUserClient } from '../discord/DiscordUserClient';
import { logger } from './Logger';
import { AnimationFrame, RpcFrame } from '../shared/types';

interface AnimationState {
  interval: NodeJS.Timeout;
  frames: unknown[];
  currentIndex: number;
  delay: number;
}

export class AnimationService {
  private client: DiscordUserClient | null = null;
  private customStatusAnimation: AnimationState | null = null;
  private rpcAnimation: AnimationState | null = null;

  setClient(client: DiscordUserClient | null): void {
    this.client = client;
  }

  // ============================================================================
  // CUSTOM STATUS ANIMATION
  // ============================================================================

  startCustomStatusAnimation(frames: AnimationFrame[], delayMs: number): void {
    if (!this.client?.user) {
      throw new Error('Client Discord non connecté');
    }

    this.stopCustomStatusAnimation();

    logger.info('Animation', `Démarrage Custom Status (${frames.length} frames, ${delayMs}ms)`);

    let index = 0;
    const interval = setInterval(() => {
      const frame = frames[index];
      try {
        this.client!.user!.setPresence({
          activities: [{
            name: 'Custom Status',
            type: 'CUSTOM' as const,
            state: frame.text,
            ...(frame.emoji && { emoji: { name: frame.emoji } })
          }],
          status: 'online'
        });
      } catch (err) {
        logger.error('Animation', 'Erreur tick Custom Status', err);
      }
      index = (index + 1) % frames.length;
    }, delayMs);

    // Premier tick immédiat
    const firstFrame = frames[0];
    this.client.user.setPresence({
      activities: [{
        name: 'Custom Status',
        type: 'CUSTOM' as const,
        state: firstFrame.text,
        ...(firstFrame.emoji && { emoji: { name: firstFrame.emoji } })
      }],
      status: 'online'
    });

    this.customStatusAnimation = {
      interval,
      frames,
      currentIndex: 0,
      delay: delayMs
    };
  }

  stopCustomStatusAnimation(): void {
    if (this.customStatusAnimation) {
      clearInterval(this.customStatusAnimation.interval);
      this.customStatusAnimation = null;

      if (this.client?.user) {
        this.client.user.setPresence({ activities: [] });
      }

      logger.info('Animation', 'Custom Status arrêté');
    }
  }

  isCustomStatusAnimating(): boolean {
    return this.customStatusAnimation !== null;
  }

  // ============================================================================
  // RICH PRESENCE ANIMATION
  // ============================================================================

  async startRpcAnimation(frames: RpcFrame[], delayMs: number): Promise<void> {
    if (!this.client?.user) {
      throw new Error('Client Discord non connecté');
    }

    this.stopRpcAnimation();

    logger.info('Animation', `Démarrage RPC Rotator (${frames.length} frames, ${delayMs}ms)`);

    let index = 0;

    const tick = async () => {
      const rpcData = frames[index];
      try {
        await this.applyRpcFrame(rpcData);
      } catch (err) {
        logger.error('Animation', 'Erreur tick RPC', err);
      }
      index = (index + 1) % frames.length;
    };

    // Premier tick immédiat
    await tick();

    const interval = setInterval(tick, delayMs);

    this.rpcAnimation = {
      interval,
      frames,
      currentIndex: 0,
      delay: delayMs
    };
  }

  stopRpcAnimation(): void {
    if (this.rpcAnimation) {
      clearInterval(this.rpcAnimation.interval);
      this.rpcAnimation = null;

      if (this.client?.user) {
        this.client.user.setActivity('');
      }

      logger.info('Animation', 'RPC Rotator arrêté');
    }
  }

  isRpcAnimating(): boolean {
    return this.rpcAnimation !== null;
  }

  // ============================================================================
  // SINGLE RPC FRAME
  // ============================================================================

  async setRichPresence(frame: RpcFrame): Promise<void> {
    if (!this.client?.user) {
      throw new Error('Client Discord non connecté');
    }

    await this.applyRpcFrame(frame);

    logger.info('Animation', 'Rich Presence mise à jour');
  }

  async clearRichPresence(): Promise<void> {
    if (!this.client?.user) {
      throw new Error('Client Discord non connecté');
    }

    // Arrêter l'animation RPC si elle est en cours
    this.stopRpcAnimation();

    // Clear la présence
    this.client.user.setActivity(undefined);
    this.client.user.setPresence({ activities: [], status: 'online' });

    logger.info('Animation', 'Rich Presence désactivée');
  }

  private async applyRpcFrame(data: RpcFrame): Promise<void> {
    if (!this.client?.user) return;

    // Mode Custom Status simple
    if (data.activityType === 'CUSTOM') {
      this.client.user.setPresence({
        activities: [{
          name: 'Custom Status',
          type: 'CUSTOM' as const,
          state: data.state || data.name || 'Custom Status'
        }],
        status: 'online'
      });
      return;
    }

    // Convert Activity Type directly
    let acType = 0; // PLAYING
    if (data.activityType === 'LISTENING') acType = 2;
    if (data.activityType === 'WATCHING') acType = 3;
    if (data.activityType === 'COMPETING') acType = 5;

    const activityPayload: any = {
      application_id: data.appId || '383226320970055681',
      name: data.name || 'Visual Studio Code',
      type: acType,
      assets: {}
    };

    if (data.state) activityPayload.state = data.state;
    if (data.details) activityPayload.details = data.details;

    // Direct assignment to bypass discord.js INVALID_URL throw.
    // The Discord Desktop Client will natively proxy http/https urls on render.
    if (data.largeImage) activityPayload.assets.large_image = data.largeImage;
    if (data.largeText) activityPayload.assets.large_text = data.largeText;
    if (data.smallImage) activityPayload.assets.small_image = data.smallImage;
    if (data.smallText) activityPayload.assets.small_text = data.smallText;

    // Timestamps
    if (data.startTimestamp || data.endTimestamp) {
      activityPayload.timestamps = {};
      if (data.startTimestamp) activityPayload.timestamps.start = data.startTimestamp;
      if (data.endTimestamp) activityPayload.timestamps.end = data.endTimestamp;
    }

    // Buttons (max 2)
    if (data.buttons && data.buttons.length > 0) {
      activityPayload.buttons = data.buttons
        .slice(0, 2)
        .map(b => b.label);
      activityPayload.metadata = {
        button_urls: data.buttons.slice(0, 2).map(b => b.url)
      };
    }

    // Assign directly via setPresence (Gateway bypass)
    this.client.user.setPresence({
      activities: [activityPayload],
      status: 'online'
    });
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  stopAll(): void {
    this.stopCustomStatusAnimation();
    this.stopRpcAnimation();
  }
}
