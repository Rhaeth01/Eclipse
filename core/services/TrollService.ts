/**
 * Service de trolls et features diverses
 * Centralise reactroll, deletesend, autoreply, typing, etc.
 */

import { EventEmitter } from 'events';
import { logger } from './Logger';
import { rateLimiter } from './RateLimiter';

export interface AutoReplyConfig {
  response: string;
  typingDelay?: boolean;
}

export interface TypingConfig {
  channelId: string;
  interval?: NodeJS.Timeout;
}

export class TrollService extends EventEmitter {
  // ReactRoll: userId -> emoji
  private reactrollTargets = new Map<string, string>();
  
  // DeleteSend: Set de userIds
  private deletesendTargets = new Set<string>();
  
  // AutoReply: userId -> réponse
  private autoreplyTargets = new Map<string, AutoReplyConfig>();
  
  // Typing: channelId -> interval
  private typingChannels = new Map<string, NodeJS.Timeout>();

  // Callback pour réagir aux messages (delete, react, reply)
  private messageHandler?: {
    deleteMessage: (msg: any) => Promise<void>;
    reactToMessage: (msg: any, emoji: string) => Promise<void>;
    sendReply: (msg: any, content: string) => Promise<void>;
    sendTyping: (channelId: string) => Promise<void>;
  };

  // ============================================================================
  // SETUP
  // ============================================================================

  setMessageHandler(handler: {
    deleteMessage: (msg: any) => Promise<void>;
    reactToMessage: (msg: any, emoji: string) => Promise<void>;
    sendReply: (msg: any, content: string) => Promise<void>;
    sendTyping: (channelId: string) => Promise<void>;
  }): void {
    this.messageHandler = handler;
  }

  // ============================================================================
  // REACTROLL
  // ============================================================================

  setReactroll(userId: string, emoji: string): void {
    this.reactrollTargets.set(userId, emoji);
    logger.info('Troll', `Reactroll activé: ${userId} -> ${emoji}`);
  }

  removeReactroll(userId: string): boolean {
    const result = this.reactrollTargets.delete(userId);
    if (result) logger.info('Troll', `Reactroll désactivé: ${userId}`);
    return result;
  }

  toggleReactroll(userId: string, emoji: string): boolean {
    if (this.reactrollTargets.has(userId)) {
      this.removeReactroll(userId);
      return false;
    } else {
      this.setReactroll(userId, emoji);
      return true;
    }
  }

  getReactrollEmoji(userId: string): string | undefined {
    return this.reactrollTargets.get(userId);
  }

  isReactrollActive(userId: string): boolean {
    return this.reactrollTargets.has(userId);
  }

  // ============================================================================
  // DELETESEND
  // ============================================================================

  addDeleteSend(userId: string): void {
    this.deletesendTargets.add(userId);
    logger.info('Troll', `DeleteSend activé: ${userId}`);
  }

  removeDeleteSend(userId: string): boolean {
    const result = this.deletesendTargets.delete(userId);
    if (result) logger.info('Troll', `DeleteSend désactivé: ${userId}`);
    return result;
  }

  toggleDeleteSend(userId: string): boolean {
    if (this.deletesendTargets.has(userId)) {
      this.removeDeleteSend(userId);
      return false;
    } else {
      this.addDeleteSend(userId);
      return true;
    }
  }

  isDeleteSendActive(userId: string): boolean {
    return this.deletesendTargets.has(userId);
  }

  // ============================================================================
  // AUTOREPLY
  // ============================================================================

  setAutoreply(userId: string, response: string, typingDelay = true): void {
    this.autoreplyTargets.set(userId, { response, typingDelay });
    logger.info('Troll', `Autoreply activé: ${userId} -> "${response}"`);
  }

  removeAutoreply(userId: string): boolean {
    const result = this.autoreplyTargets.delete(userId);
    if (result) logger.info('Troll', `Autoreply désactivé: ${userId}`);
    return result;
  }

  toggleAutoreply(userId: string, response: string, typingDelay = true): boolean {
    if (this.autoreplyTargets.has(userId)) {
      this.removeAutoreply(userId);
      return false;
    } else {
      this.setAutoreply(userId, response, typingDelay);
      return true;
    }
  }

  getAutoreply(userId: string): AutoReplyConfig | undefined {
    return this.autoreplyTargets.get(userId);
  }

  isAutoreplyActive(userId: string): boolean {
    return this.autoreplyTargets.has(userId);
  }

  // ============================================================================
  // TYPING INDICATOR
  // ============================================================================

  startTyping(channelId: string, sendTypingFn: () => Promise<void>): void {
    if (this.typingChannels.has(channelId)) {
      return; // Déjà actif
    }

    const interval = setInterval(async () => {
      try {
        await sendTypingFn();
      } catch {
        this.stopTyping(channelId);
      }
    }, 7000 + Math.random() * 2000); // Discord reset l'indicateur toutes les 8-10s, on varie

    this.typingChannels.set(channelId, interval);
    
    // Premier envoi immédiat
    sendTypingFn().catch(() => this.stopTyping(channelId));
    
    logger.info('Troll', `Typing activé: ${channelId}`);
  }

  stopTyping(channelId: string): boolean {
    const interval = this.typingChannels.get(channelId);
    if (!interval) return false;

    clearInterval(interval);
    this.typingChannels.delete(channelId);
    logger.info('Troll', `Typing désactivé: ${channelId}`);
    return true;
  }

  toggleTyping(channelId: string, sendTypingFn: () => Promise<void>): boolean {
    if (this.typingChannels.has(channelId)) {
      this.stopTyping(channelId);
      return false;
    } else {
      this.startTyping(channelId, sendTypingFn);
      return true;
    }
  }

  isTypingActive(channelId: string): boolean {
    return this.typingChannels.has(channelId);
  }

  stopAllTyping(): void {
    for (const [channelId, interval] of this.typingChannels) {
      clearInterval(interval);
      logger.info('Troll', `Typing arrêté: ${channelId}`);
    }
    this.typingChannels.clear();
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  clear(): void {
    this.stopAllTyping();
    this.reactrollTargets.clear();
    this.deletesendTargets.clear();
    this.autoreplyTargets.clear();
    logger.info('Troll', 'Tous les trolls ont été effacés');
  }
}
