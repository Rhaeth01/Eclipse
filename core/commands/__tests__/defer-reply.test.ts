/**
 * Tests d'intégration pour les commandes dont le REST call peut dépasser
 * le timeout 3s de Discord — vérifie qu'elles utilisent bien
 * `deferReply()` au lieu d'un `reply()` direct.
 *
 * Bug historique : `/troll mimic` (createWebhook + send + delete) et
 * `/admin lock`/`/admin unlock` (permissionOverwrites.edit) pouvaient
 * dépasser 3s, ce qui faisait apparaître "L'application ne répond plus"
 * côté client Discord.
 */

import { describe, it, expect, vi } from 'vitest';
import { CommandRegistry, type CommandContext } from '../CommandRegistry';
import type { ChatInputCommandInteraction } from 'discord.js';
import { registerTroll } from '../categories/troll';
import { registerAdmin } from '../categories/admin';

function makeMockCtx(): CommandContext {
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
  };
}

function makeChatInputWithOptions(opts: {
  commandName: string;
  subcommand: string;
  user?: { id: string; tag: string; username: string; displayAvatarURL: () => string };
  channel?: any;
  guild?: any;
}): ChatInputCommandInteraction {
  const getUser = vi.fn().mockReturnValue(opts.user);
  const getString = vi.fn().mockReturnValue('hello');
  return {
    commandName: opts.commandName,
    options: {
      getSubcommand: (_required = true) => opts.subcommand,
      getSubcommandGroup: () => null,
      getUser: getUser as any,
      getString: getString as any,
    },
    channel: opts.channel,
    guild: opts.guild,
    user: { id: 'self-1' },
    replied: false,
    deferred: false,
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('Anti-régression — deferReply sur les commandes REST-lentes', () => {
  describe('/troll mimic', () => {
    it('appelle deferReply() avant le REST call webhook (évite timeout 3s)', async () => {
      const r = new CommandRegistry();
      registerTroll(r);
      const ctx = makeMockCtx();

      const fakeUser = {
        id: 'u1',
        tag: 'TestUser#0001',
        username: 'TestUser',
        displayAvatarURL: () => 'http://avatar',
      };
      const fakeChannel = {
        isTextBased: () => true,
        isThread: () => false,
        createWebhook: vi.fn().mockImplementation(async (name: string) => ({
          send: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
        })),
      };

      const i = makeChatInputWithOptions({
        commandName: 'troll',
        subcommand: 'mimic',
        user: fakeUser,
        channel: fakeChannel,
      });

      await r.dispatch(i, ctx);
      expect(i.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    });

    it('refuse les arguments manquants avec reply() (pas deferReply)', async () => {
      const r = new CommandRegistry();
      registerTroll(r);
      const ctx = makeMockCtx();

      const i = makeChatInputWithOptions({
        commandName: 'troll',
        subcommand: 'mimic',
      });
      // Pas de user ni de string fournis → la validation rapide doit reply() immédiatement
      (i.options.getUser as any) = vi.fn().mockReturnValue(null);
      (i.options.getString as any) = vi.fn().mockReturnValue(null);

      await r.dispatch(i, ctx);
      expect(i.reply).toHaveBeenCalledWith({ content: '❌ Arguments manquants.', ephemeral: true });
      expect(i.deferReply).not.toHaveBeenCalled();
    });

    it("refuse un salon non textuel avec 'Canal invalide' (pas de crash)", async () => {
      const r = new CommandRegistry();
      registerTroll(r);
      const ctx = makeMockCtx();

      const fakeUser = {
        id: 'u1',
        tag: 'TestUser#0001',
        username: 'TestUser',
        displayAvatarURL: () => 'http://avatar',
      };
      const i = makeChatInputWithOptions({
        commandName: 'troll',
        subcommand: 'mimic',
        user: fakeUser,
        channel: { isTextBased: () => false },
      });

      await r.dispatch(i, ctx);
      expect(i.reply).toHaveBeenCalledWith({ content: '❌ Canal invalide.', ephemeral: true });
      expect(i.deferReply).not.toHaveBeenCalled();
    });
  });

  describe('/admin lock & /admin unlock', () => {
    it('/admin lock appelle deferReply() avant permissionOverwrites.edit', async () => {
      const r = new CommandRegistry();
      registerAdmin(r);
      const ctx = makeMockCtx();

      const fakeChannel = {
        permissionOverwrites: {
          edit: vi.fn().mockResolvedValue(undefined),
        },
      };
      const fakeGuild = { id: 'g1' };

      const i = makeChatInputWithOptions({
        commandName: 'admin',
        subcommand: 'lock',
        channel: fakeChannel,
        guild: fakeGuild,
      });

      await r.dispatch(i, ctx);
      expect(i.deferReply).toHaveBeenCalledWith({ ephemeral: true });
      expect(fakeChannel.permissionOverwrites.edit).toHaveBeenCalledWith('g1', { SendMessages: false });
      expect(i.editReply).toHaveBeenCalledWith({ content: '🔒 Salon verrouillé.' });
    });

    it('/admin unlock appelle deferReply() avant permissionOverwrites.edit', async () => {
      const r = new CommandRegistry();
      registerAdmin(r);
      const ctx = makeMockCtx();

      const fakeChannel = {
        permissionOverwrites: {
          edit: vi.fn().mockResolvedValue(undefined),
        },
      };
      const fakeGuild = { id: 'g1' };

      const i = makeChatInputWithOptions({
        commandName: 'admin',
        subcommand: 'unlock',
        channel: fakeChannel,
        guild: fakeGuild,
      });

      await r.dispatch(i, ctx);
      expect(i.deferReply).toHaveBeenCalledWith({ ephemeral: true });
      expect(fakeChannel.permissionOverwrites.edit).toHaveBeenCalledWith('g1', { SendMessages: null });
      expect(i.editReply).toHaveBeenCalledWith({ content: '🔓 Salon déverrouillé.' });
    });

    it("/admin lock rejette un salon invalide avec 'Canal invalide' (pas de deferReply)", async () => {
      const r = new CommandRegistry();
      registerAdmin(r);
      const ctx = makeMockCtx();

      const i = makeChatInputWithOptions({
        commandName: 'admin',
        subcommand: 'lock',
        channel: { permissionOverwrites: null },
      });

      await r.dispatch(i, ctx);
      expect(i.reply).toHaveBeenCalledWith({ content: '❌ Canal invalide.', ephemeral: true });
      expect(i.deferReply).not.toHaveBeenCalled();
    });
  });
});
