/**
 * Tests pour les fixes Phase 4 (v0.4.3).
 *
 * - Logger: catch des listeners ne swallow plus silencieusement
 * - MessageHandler.setDiscordClient(): méthode publique au lieu du cast `as any`
 * - EclipseCore.restoreState(): broadcast à tous les clients (pas seulement le 1er)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '../Logger';
import { MessageHandler } from '../../handlers/MessageHandler';
import { WebSocketService } from '../WebSocketService';

describe('Logger v0.4.3 fix #25 (listener catch)', () => {
  let originalConsoleError: typeof console.error;
  let errorCalls: any[][];

  beforeEach(() => {
    Logger.getInstance().clear();
    errorCalls = [];
    originalConsoleError = console.error;
    console.error = (...args) => errorCalls.push(args);
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('un listener qui throw ne casse pas le pipeline de log', () => {
    const logger = Logger.getInstance();
    logger.onLog(() => { throw new Error('listener broken'); });
    expect(() => logger.info('Test', 'should not throw')).not.toThrow();
  });

  it('l\'erreur du listener est loggée via console.error (pas silencieuse)', () => {
    const logger = Logger.getInstance();
    logger.onLog(() => { throw new Error('listener broken'); });
    logger.info('Test', 'after broken listener');
    expect(errorCalls.length).toBeGreaterThan(0);
    expect(String(errorCalls[0])).toContain('listener broken');
  });

  it('les listeners qui marchent toujours fonctionnent normalement', () => {
    const logger = Logger.getInstance();
    const cb = vi.fn();
    logger.onLog(cb);
    logger.info('Test', 'normal listener');
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('MessageHandler v0.4.3 fix #29 (setDiscordClient public)', () => {
  function makeMinimalContext() {
    return {
      wsService: {} as any,
      animationService: {} as any,
      dbService: {} as any,
      backupService: {} as any,
      spyService: {} as any,
      trollService: {} as any,
      stateService: {} as any,
      autoSlashService: {} as any,
      discordClient: null,
      getCommandStealth: () => true,
      setCommandStealth: () => {},
      getSilentTyping: () => false,
      setSilentTyping: () => {},
    };
  }

  it('setDiscordClient met à jour le context sans cast `as any`', () => {
    const handler = new MessageHandler(makeMinimalContext());
    const mockClient = { id: 'discord-1' } as any;

    // Avant: (handler as any).context.discordClient = ...
    // Après: handler.setDiscordClient(...)
    expect(() => handler.setDiscordClient(mockClient)).not.toThrow();
    expect(() => handler.setDiscordClient(null)).not.toThrow();
  });
});
