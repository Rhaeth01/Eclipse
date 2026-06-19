/**
 * Tests pour /troll invisibleping (slash) + context menu USER 'Invisible Ping'.
 *
 * Mécanisme Discord visé (technique "ghost mention" / ZWSP) :
 *   - `content: '<@\u200B!USERID>'` — un zero-width space (U+200B) est inséré
 *     entre `@` et l'ID. Discord parse la mention, ajoute la cible au tableau
 *     `mentions` côté backend, ET envoie la notification (push/badge/son).
 *   - Le renderer client de la cible n'affiche PAS le pseudo cliquable à
 *     cause du caractère invisible — le message apparaît en surbrillance
 *     jaune (parce que la cible est dans `mentions`) mais le texte visible
 *     ne montre aucun pseudo.
 *   - Aucun `flags: 4096` (SUPPRESS_NOTIFICATIONS) → on VEUT la notification.
 *   - Aucun `allowed_mentions` restrictif → on laisse Discord parser.
 *
 * Résultat observable pour la victime :
 *   - ✓ Notification reçue (push, badge, son)
 *   - ✓ Message surligné en jaune (bandeau latéral, fond de la ligne)
 *   - ✗ Aucun pseudo visible dans le texte du message
 */

import { describe, it, expect, vi } from 'vitest';
import { CommandRegistry, type CommandContext } from '../CommandRegistry';
import type {
  ChatInputCommandInteraction,
  UserContextMenuCommandInteraction,
  MessageContextMenuCommandInteraction,
} from 'discord.js';
import { registerTroll } from '../categories/troll';
import { registerSpy } from '../categories/spy';

function makeMockCtx(overrides?: Partial<CommandContext>): CommandContext {
  return {
    dm: {} as any,
    spyService: {} as any,
    trollService: {} as any,
    sniperService: {} as any,
    animationService: {} as any,
    questService: {} as any,
    autoSlashService: {} as any,
    backupService: {} as any,
    stateService: {} as any,
    dbService: {} as any,
    getCommandStealth: () => true,
    setCommandStealth: () => {},
    getSilentTyping: () => false,
    setSilentTyping: () => {},
    ...overrides,
  };
}

function makeChatInputWithOptions(opts: {
  commandName: string;
  subcommand: string;
  cible?: { id: string; tag: string; username: string; displayAvatarURL: () => string };
  channel?: any;
  message?: string;
  channelId?: string;
}): ChatInputCommandInteraction {
  return {
    commandName: opts.commandName,
    channelId: opts.channelId ?? 'ch-1',
    options: {
      getSubcommand: () => opts.subcommand,
      getSubcommandGroup: () => null,
      getUser: vi.fn().mockReturnValue(opts.cible) as any,
      getMentionable: vi.fn().mockReturnValue(opts.cible) as any,
      getString: vi.fn().mockReturnValue(opts.message ?? null) as any,
    },
    channel: opts.channel,
    user: { id: 'self-1' },
    replied: false,
    deferred: false,
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    deleteReply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function makeUserContextMenu(opts: {
  targetUser: { id: string; tag: string };
  channelId: string;
  channel?: any;
}): UserContextMenuCommandInteraction {
  return {
    commandName: 'Invisible Ping',
    targetUser: opts.targetUser,
    channelId: opts.channelId,
    channel: opts.channel,
    user: { id: 'self-1' },
    guild: { id: 'g-1' },
    replied: false,
    deferred: false,
    deferReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    deleteReply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('Invisible ping — /troll invisibleping (slash)', () => {
  it('envoie le payload avec ZWSP (U+200B) entre @ et l\'ID, SANS flags:4096, SANS allowed_mentions restrictif', async () => {
    const r = new CommandRegistry();
    registerTroll(r);

    const sendSpy = vi.fn().mockResolvedValue(undefined);
    const fakeSelfbot = {
      channels: {
        fetch: vi.fn().mockResolvedValue({
          isText: () => true,
          send: sendSpy,
        }),
      },
    };
    const ctx = makeMockCtx({
      dm: {
        selfbot: fakeSelfbot,
        safeEphemeralReply: vi.fn().mockResolvedValue(undefined),
      } as any,
    });

    const target = { id: 'victim-1', tag: 'Victim#0001', username: 'Victim', displayAvatarURL: () => 'http://avatar' };
    const i = makeChatInputWithOptions({
      commandName: 'troll',
      subcommand: 'invisibleping',
      cible: target,
      channelId: 'ch-1',
    });

    await r.dispatch(i, ctx);

    // Le payload doit contenir la mention avec ZWSP
    // ET ne doit PAS contenir flags:4096 (on veut la notification)
    // ET ne doit PAS contenir allowed_mentions restrictif
    expect(sendSpy).toHaveBeenCalledWith({
      content: '<@\u200B!victim-1>',
    });

    // Anti-régression : pas de flag SUPPRESS_NOTIFICATIONS
    const callArgs = sendSpy.mock.calls[0][0];
    expect(callArgs.flags).toBeUndefined();

    // Anti-régression : pas d'allowed_mentions restrictif
    expect(callArgs.allowed_mentions).toBeUndefined();

    // Anti-régression : pas de spoiler wrapping
    expect(callArgs.content).not.toMatch(/^\s*\|/);
    expect(callArgs.content).not.toMatch(/\|\|\s*$/);
  });

  it("concatène le suffixe de message optionnel après la mention (toujours hors spoiler)", async () => {
    const r = new CommandRegistry();
    registerTroll(r);

    const sendSpy = vi.fn().mockResolvedValue(undefined);
    const ctx = makeMockCtx({
      dm: {
        selfbot: { channels: { fetch: vi.fn().mockResolvedValue({ isText: () => true, send: sendSpy }) } },
        safeEphemeralReply: vi.fn().mockResolvedValue(undefined),
      } as any,
    });

    const target = { id: 'v-1', tag: 'V#1', username: 'V', displayAvatarURL: () => 'http://a' };
    const i = makeChatInputWithOptions({
      commandName: 'troll',
      subcommand: 'invisibleping',
      cible: target,
      channelId: 'ch-1',
      message: 'tu me vois pas',
    });

    await r.dispatch(i, ctx);

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '<@\u200B!v-1> tu me vois pas',
      })
    );
  });

  it("utilise le format role <@&\\u200BID> si la cible est un Role", async () => {
    const r = new CommandRegistry();
    registerTroll(r);

    const sendSpy = vi.fn().mockResolvedValue(undefined);
    const ctx = makeMockCtx({
      dm: {
        selfbot: { channels: { fetch: vi.fn().mockResolvedValue({ isText: () => true, send: sendSpy }) } },
        safeEphemeralReply: vi.fn().mockResolvedValue(undefined),
      } as any,
    });

    // Mock Role : getMentionable retourne un objet qui ressemble à un Role
    const fakeRole: any = { id: 'role-1', color: 0xff0000, position: 5 };
    Object.setPrototypeOf(fakeRole, (await import('discord.js')).Role.prototype);

    const i = makeChatInputWithOptions({
      commandName: 'troll',
      subcommand: 'invisibleping',
      cible: fakeRole,
      channelId: 'ch-1',
    });

    await r.dispatch(i, ctx);

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '<@&\u200Brole-1>',
      })
    );
  });

  it('appelle deferReply({ephemeral:true}) AVANT le REST call (anti timeout 3s)', async () => {
    const r = new CommandRegistry();
    registerTroll(r);

    const order: string[] = [];
    const sendSpy = vi.fn().mockImplementation(async () => {
      order.push('send');
    });
    const ctx = makeMockCtx({
      dm: {
        selfbot: { channels: { fetch: vi.fn().mockResolvedValue({ isText: () => true, send: sendSpy }) } },
        safeEphemeralReply: vi.fn().mockResolvedValue(undefined),
      } as any,
    });

    const target = { id: 'v-1', tag: 'V#1', username: 'V', displayAvatarURL: () => 'http://a' };
    const i = makeChatInputWithOptions({
      commandName: 'troll',
      subcommand: 'invisibleping',
      cible: target,
      channelId: 'ch-1',
    });
    (i.deferReply as any) = vi.fn().mockImplementation(async () => {
      order.push('defer');
    });

    await r.dispatch(i, ctx);

    expect(i.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(order).toEqual(['defer', 'send']);
  });

  it('appelle deleteReply() après envoi (pas de trace éphémère)', async () => {
    const r = new CommandRegistry();
    registerTroll(r);

    const sendSpy = vi.fn().mockResolvedValue(undefined);
    const ctx = makeMockCtx({
      dm: {
        selfbot: { channels: { fetch: vi.fn().mockResolvedValue({ isText: () => true, send: sendSpy }) } },
        safeEphemeralReply: vi.fn().mockResolvedValue(undefined),
      } as any,
    });

    const target = { id: 'v-1', tag: 'V#1', username: 'V', displayAvatarURL: () => 'http://a' };
    const i = makeChatInputWithOptions({
      commandName: 'troll',
      subcommand: 'invisibleping',
      cible: target,
      channelId: 'ch-1',
    });

    await r.dispatch(i, ctx);

    expect(i.deleteReply).toHaveBeenCalled();
  });

  it('utilise safeEphemeralReply sans defer quand la cible est manquante', async () => {
    const r = new CommandRegistry();
    registerTroll(r);

    const safeEphemeralReply = vi.fn().mockResolvedValue(undefined);
    const ctx = makeMockCtx({
      dm: { selfbot: null, safeEphemeralReply } as any,
    });

    const i = makeChatInputWithOptions({
      commandName: 'troll',
      subcommand: 'invisibleping',
    });
    (i.options.getMentionable as any) = vi.fn().mockReturnValue(null);

    await r.dispatch(i, ctx);

    expect(safeEphemeralReply).toHaveBeenCalledWith(i, '❌ Cible invalide.');
    expect(i.deferReply).not.toHaveBeenCalled();
  });

  it("safeEphemeralReply en cas de canal invalide (pas de crash)", async () => {
    const r = new CommandRegistry();
    registerTroll(r);

    const safeEphemeralReply = vi.fn().mockResolvedValue(undefined);
    const ctx = makeMockCtx({
      dm: {
        selfbot: { channels: { fetch: vi.fn().mockResolvedValue(null) } },
        safeEphemeralReply,
      } as any,
    });

    const target = { id: 'v-1', tag: 'V#1', username: 'V', displayAvatarURL: () => 'http://a' };
    const i = makeChatInputWithOptions({
      commandName: 'troll',
      subcommand: 'invisibleping',
      cible: target,
      channelId: 'ch-1',
    });

    await r.dispatch(i, ctx);

    expect(safeEphemeralReply).toHaveBeenCalledWith(
      i,
      "❌ Impossible d'envoyer la mention fantôme via le compte utilisateur."
    );
  });

  it("safeEphemeralReply si la channel n'est pas textuel", async () => {
    const r = new CommandRegistry();
    registerTroll(r);

    const safeEphemeralReply = vi.fn().mockResolvedValue(undefined);
    const ctx = makeMockCtx({
      dm: {
        selfbot: { channels: { fetch: vi.fn().mockResolvedValue({ isText: () => false, send: vi.fn() }) } },
        safeEphemeralReply,
      } as any,
    });

    const target = { id: 'v-1', tag: 'V#1', username: 'V', displayAvatarURL: () => 'http://a' };
    const i = makeChatInputWithOptions({
      commandName: 'troll',
      subcommand: 'invisibleping',
      cible: target,
      channelId: 'ch-1',
    });

    await r.dispatch(i, ctx);

    expect(safeEphemeralReply).toHaveBeenCalledWith(
      i,
      "❌ Impossible d'envoyer la mention fantôme via le compte utilisateur."
    );
  });
});

describe('Invisible ping — context menu USER "Invisible Ping"', () => {
  it('envoie le payload ZWSP via le selfbot (pas App Bot), SANS spoiler, SANS flags:4096', async () => {
    const r = new CommandRegistry();
    registerSpy(r);

    const sendSpy = vi.fn().mockResolvedValue(undefined);
    const fakeSelfbot = {
      channels: {
        fetch: vi.fn().mockResolvedValue({
          isText: () => true,
          send: sendSpy,
        }),
      },
    };
    const ctx = makeMockCtx({
      dm: { selfbot: fakeSelfbot } as any,
    });

    const i = makeUserContextMenu({
      targetUser: { id: 'victim-1', tag: 'Victim#0001' },
      channelId: 'ch-1',
    });

    await r.dispatchUserContextMenu(i, ctx);

    expect(sendSpy).toHaveBeenCalledWith({
      content: '<@\u200B!victim-1>',
    });

    const callArgs = sendSpy.mock.calls[0][0];
    expect(callArgs.flags).toBeUndefined();
    expect(callArgs.allowed_mentions).toBeUndefined();
    expect(callArgs.content).not.toMatch(/^\|/);
    expect(callArgs.content).not.toMatch(/\|\|$/);
  });

  it('confirme éphémèrement le succès (réponse visible à l\'owner)', async () => {
    const r = new CommandRegistry();
    registerSpy(r);

    const sendSpy = vi.fn().mockResolvedValue(undefined);
    const ctx = makeMockCtx({
      dm: {
        selfbot: { channels: { fetch: vi.fn().mockResolvedValue({ isText: () => true, send: sendSpy }) } },
      } as any,
    });

    const i = makeUserContextMenu({
      targetUser: { id: 'victim-1', tag: 'Victim#0001' },
      channelId: 'ch-1',
    });

    await r.dispatchUserContextMenu(i, ctx);

    expect(i.reply).toHaveBeenCalledWith({
      content: '👻 Mention fantôme envoyée à Victim#0001',
      ephemeral: true,
    });
  });

  it('safeEphemeralReply si le selfbot est déconnecté', async () => {
    const r = new CommandRegistry();
    registerSpy(r);

    const ctx = makeMockCtx({
      dm: { selfbot: null } as any,
    });

    const i = makeUserContextMenu({
      targetUser: { id: 'victim-1', tag: 'Victim#0001' },
      channelId: 'ch-1',
    });

    await r.dispatchUserContextMenu(i, ctx);

    expect(i.reply).toHaveBeenCalledWith({
      content: '❌ Selfbot non connecté.',
      ephemeral: true,
    });
  });

  it('safeEphemeralReply en cas d\'erreur canal/perm', async () => {
    const r = new CommandRegistry();
    registerSpy(r);

    const ctx = makeMockCtx({
      dm: {
        selfbot: { channels: { fetch: vi.fn().mockResolvedValue(null) } },
      } as any,
    });

    const i = makeUserContextMenu({
      targetUser: { id: 'victim-1', tag: 'Victim#0001' },
      channelId: 'ch-1',
    });

    await r.dispatchUserContextMenu(i, ctx);

    expect(i.reply).toHaveBeenCalledWith({
      content: "❌ Impossible d'envoyer la mention fantôme.",
      ephemeral: true,
    });
  });

  it('ne déclenche PAS un menu MESSAGE avec le même nom', async () => {
    const r = new CommandRegistry();
    registerSpy(r);

    const sendSpy = vi.fn();
    const ctx = makeMockCtx({
      dm: { selfbot: { channels: { fetch: vi.fn().mockResolvedValue({ isText: () => true, send: sendSpy }) } } } as any,
    });

    const i = {
      commandName: 'Invisible Ping',
      targetMessage: { content: 'yo' },
      channelId: 'ch-1',
      user: { id: 'self-1' },
      guild: { id: 'g-1' },
      reply: vi.fn().mockResolvedValue(undefined),
    } as unknown as MessageContextMenuCommandInteraction;

    await r.dispatchMessageContextMenu(i, ctx);

    expect(sendSpy).not.toHaveBeenCalled();
    expect(i.reply).toHaveBeenCalledWith({ content: '❌ Action inconnue.', ephemeral: true });
  });
});
