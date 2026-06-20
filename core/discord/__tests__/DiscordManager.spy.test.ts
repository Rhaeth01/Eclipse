/**
 * Tests pour DiscordManager.handleMessageUpdate — focus sur le path spy_edited.
 *
 * Contexte : avant ce fix, handleMessageUpdate :
 * 1. Émettait toujours early return (oldMsg === newMsg → oldMsg.content === newMsg.content)
 * 2. Ne checkait JAMAIS le spyService → pas de notification spy_edited
 *
 * Ce fix :
 * - Utilise le vrai oldMsg depuis le message cache (géré par DiscordUserClient)
 * - Check spyService et broadcast 'spy_edited' si l'auteur est surveillé
 * - Peuple editsnipeCache avec le VRAI old content
 *
 * On teste handleMessageUpdate directement via un mock spyService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscordManager } from '../DiscordManager';
import type { IMessage } from '../types';

function makeManager(): { mgr: DiscordManager; broadcastSpy: ReturnType<typeof vi.fn> } {
  const broadcastSpy = vi.fn();
  const wsService: any = { broadcast: vi.fn() };
  const dbService: any = {};
  const spyService: any = {
    isTargetActive: vi.fn().mockReturnValue(false),
    getUserGuilds: vi.fn().mockReturnValue(undefined),
    addTarget: vi.fn(),
    removeTarget: vi.fn(),
    getTargets: vi.fn().mockReturnValue(new Map()),
  };
  const trollService: any = {
    setMessageHandler: vi.fn(),
    setEditHandler: vi.fn(),
    setBulkDeleteHandler: vi.fn(),
  };
  const mgr = new DiscordManager(wsService, dbService, spyService, trollService);
  // Inject le selfbot pour que broadcastNotification ne crash pas
  (mgr as any).selfbot = { user: { id: 'self-1' } };
  // Spy broadcastNotification
  vi.spyOn(mgr as any, 'broadcastNotification').mockImplementation(broadcastSpy);
  return { mgr, broadcastSpy };
}

function makeMessage(overrides: any = {}): IMessage {
  return {
    id: 'msg-1',
    content: 'contenu',
    author: {
      id: 'user-1',
      username: 'Alice',
      tag: 'Alice#0000',
      bot: false,
      createdTimestamp: 0,
      displayAvatarURL: () => '',
      send: async () => { throw new Error('not implemented'); },
    },
    channel: {
      id: 'ch-1',
      name: 'general',
      isText: () => true,
      isTextBased: () => true,
      isThread: () => false,
      parent: null,
      guild: { id: 'g-1', name: 'Test' } as any,
      send: async () => null as any,
      sendTyping: async () => {},
      permissionsFor: () => null,
      messages: { fetch: async () => new Map() },
      createWebhook: async () => ({ send: async () => {}, delete: async () => {} }),
    },
    guild: { id: 'g-1', name: 'Test' } as any,
    guildId: 'g-1',
    channelId: 'ch-1',
    mentions: { users: { first: () => undefined, has: () => false, size: 0, at: () => undefined } },
    deletable: true,
    createdTimestamp: 0,
    embeds: [],
    components: [],
    attachments: new Map(),
    stickers: new Map(),
    client: null,
    delete: async () => {},
    edit: async () => null as any,
    react: async () => {},
    reply: async () => null as any,
    ...overrides,
  } as any;
}

describe('DiscordManager.handleMessageUpdate — editsnipe', () => {
  it("peuple l'editsnipeCache avec le VRAI old content (pas oldMsg === newMsg)", () => {
    const { mgr } = makeManager();
    const oldMsg = makeMessage({ content: 'AVANT' });
    const newMsg = makeMessage({ content: 'APRÈS' });

    (mgr as any).handleMessageUpdate(oldMsg, newMsg);

    const cache = (mgr as any).editsnipeCache;
    expect(cache.has('ch-1')).toBe(true);
    const entry = cache.get('ch-1');
    expect(entry.oldContent).toBe('AVANT');
    expect(entry.author).toBe('Alice#0000');
  });

  it("early return si old.content === new.content (pas un vrai edit)", () => {
    const { mgr } = makeManager();
    const oldMsg = makeMessage({ content: 'identique' });
    const newMsg = makeMessage({ content: 'identique' });

    (mgr as any).handleMessageUpdate(oldMsg, newMsg);

    const cache = (mgr as any).editsnipeCache;
    expect(cache.has('ch-1')).toBe(false);
  });

  it("early return si l'auteur est un bot", () => {
    const { mgr } = makeManager();
    const oldMsg = makeMessage({
      content: 'AVANT',
      author: { ...makeMessage().author, bot: true },
    });
    const newMsg = makeMessage({ content: 'APRÈS' });

    (mgr as any).handleMessageUpdate(oldMsg, newMsg);

    const cache = (mgr as any).editsnipeCache;
    expect(cache.has('ch-1')).toBe(false);
  });
});

describe('DiscordManager.handleMessageUpdate — spy_edited path', () => {
  it("broadcast 'spy_edited' si l'auteur est surveillé dans le guild", () => {
    const { mgr, broadcastSpy } = makeManager();
    (mgr as any).spyService.getUserGuilds = vi.fn().mockReturnValue(new Set(['g-1']));

    const oldMsg = makeMessage({ content: 'message original long' });
    const newMsg = makeMessage({ content: 'message édité' });

    (mgr as any).handleMessageUpdate(oldMsg, newMsg);

    expect(broadcastSpy).toHaveBeenCalledWith(
      'spy_edited',
      expect.stringContaining('Alice#0000'),
      '✏️ Message édité (Cible)',
    );
    // Le contenu de l'edit doit apparaître dans la notification
    const call = broadcastSpy.mock.calls[0];
    expect(call[1]).toContain('message original long');
    expect(call[1]).toContain('message édité');
  });

  it("ne broadcast PAS si l'auteur n'est pas surveillé", () => {
    const { mgr, broadcastSpy } = makeManager();
    // getUserGuilds retourne undefined (pas surveillé)
    (mgr as any).spyService.getUserGuilds = vi.fn().mockReturnValue(undefined);

    const oldMsg = makeMessage({ content: 'AVANT' });
    const newMsg = makeMessage({ content: 'APRÈS' });

    (mgr as any).handleMessageUpdate(oldMsg, newMsg);

    expect(broadcastSpy).not.toHaveBeenCalled();
  });

  it("ne broadcast PAS si l'auteur est surveillé mais dans un AUTRE guild", () => {
    const { mgr, broadcastSpy } = makeManager();
    // Surveillé dans g-99, mais le message est dans g-1
    (mgr as any).spyService.getUserGuilds = vi.fn().mockReturnValue(new Set(['g-99']));

    const oldMsg = makeMessage({ content: 'AVANT' });
    const newMsg = makeMessage({ content: 'APRÈS' });

    (mgr as any).handleMessageUpdate(oldMsg, newMsg);

    expect(broadcastSpy).not.toHaveBeenCalled();
  });
});
