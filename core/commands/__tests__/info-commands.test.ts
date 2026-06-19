/**
 * Tests runtime pour les commandes /info (userinfo, serverinfo, channelinfo,
 * roleinfo, avatar, banner, emoteinfo, stats, servericon). Vérifie qu'elles
 * construisent le bon embed et appellent reply() avec les bons champs.
 */

import { describe, it, expect, vi } from 'vitest';
import { CommandRegistry, type CommandContext } from '../CommandRegistry';
import type { ChatInputCommandInteraction, GuildMember, Role, Guild, User } from 'discord.js';
import { registerInfo } from '../categories/info';

function makeMockCtx(overrides?: Partial<CommandContext>): CommandContext {
  return {
    dm: { selfbot: { user: { id: 'self-1' } } as any } as any,
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

function makeChatInput(opts: {
  commandName: string;
  subcommand: string;
  user?: any;
  guild?: any;
  channelArg?: any;
  roleArg?: any;
  stringArg?: string;
  invokerId?: string;
  userInGuild?: boolean;
}): ChatInputCommandInteraction {
  return {
    commandName: opts.commandName,
    options: {
      getSubcommand: () => opts.subcommand,
      getSubcommandGroup: () => null,
      getUser: vi.fn().mockReturnValue(opts.user) as any,
      getRole: vi.fn().mockReturnValue(opts.roleArg) as any,
      getChannel: vi.fn().mockReturnValue(opts.channelArg) as any,
      getString: vi.fn().mockReturnValue(opts.stringArg ?? null) as any,
    },
    guild: opts.guild,
    channel: opts.channelArg,
    user: { id: opts.invokerId ?? 'self-1' },
    replied: false,
    deferred: false,
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function makeUser(overrides?: Partial<{ id: string; tag: string; bot: boolean; createdTimestamp: number }>): User {
  return {
    id: overrides?.id ?? 'user-1',
    tag: overrides?.tag ?? 'TestUser#0001',
    username: 'TestUser',
    bot: overrides?.bot ?? false,
    createdTimestamp: overrides?.createdTimestamp ?? Date.parse('2020-01-01T00:00:00Z'),
    displayAvatarURL: vi.fn().mockReturnValue('http://avatar/abc.png'),
    bannerURL: vi.fn().mockReturnValue('http://banner/abc.png'),
  } as any as User;
}

function makeGuild(overrides?: Partial<{ id: string; name: string; ownerId: string; memberCount: number; createdTimestamp: number; iconURL: string | null }>): Guild {
  const g: any = {
    id: overrides?.id ?? 'g-1',
    name: overrides?.name ?? 'Test Guild',
    ownerId: overrides?.ownerId ?? 'owner-1',
    memberCount: overrides?.memberCount ?? 100,
    createdTimestamp: overrides?.createdTimestamp ?? Date.parse('2020-01-01T00:00:00Z'),
    iconURL: vi.fn().mockReturnValue(overrides?.iconURL ?? 'http://icon/g.png'),
    members: { cache: new Map() },
    channels: { cache: new Map() },
  };
  return g as any as Guild;
}

function makeMember(userId: string, roleCount = 3): GuildMember {
  const roles = new Map();
  for (let i = 0; i < roleCount; i++) roles.set(`r-${i}`, { id: `r-${i}`, name: `Role ${i}` });
  return {
    id: userId,
    joinedTimestamp: Date.parse('2021-06-15T00:00:00Z'),
    roles: { cache: roles },
  } as any as GuildMember;
}

function makeRole(overrides?: Partial<{ id: string; name: string; color: number; position: number }>): Role {
  return {
    id: overrides?.id ?? 'role-1',
    name: overrides?.name ?? 'Admin',
    color: overrides?.color ?? 0xff0000,
    position: overrides?.position ?? 5,
    members: { size: 10 },
  } as any as Role;
}

describe('Info commands — runtime', () => {
  describe('/info userinfo', () => {
    it('construit un embed avec ID, créé le, bot, et rôles', async () => {
      const r = new CommandRegistry();
      registerInfo(r);
      const ctx = makeMockCtx();

      const user = makeUser({ id: 'u-1', tag: 'Alice#0001' });
      const member = makeMember('u-1', 4);
      const guild = makeGuild();
      guild.members.cache.set('u-1', member);

      const i = makeChatInput({
        commandName: 'info',
        subcommand: 'userinfo',
        user,
        guild,
      });

      await r.dispatch(i, ctx);

      expect(i.reply).toHaveBeenCalledTimes(1);
      const arg = (i.reply as any).mock.calls[0][0];
      expect(arg.ephemeral).toBe(true);
      expect(arg.embeds).toHaveLength(1);
      const embed = arg.embeds[0];
      expect(embed.data.title).toContain('Alice#0001');
      const fields = embed.data.fields || [];
      const fieldNames = fields.map((f: any) => f.name);
      expect(fieldNames).toContain('ID');
      expect(fieldNames).toContain('Créé le');
      expect(fieldNames).toContain('Bot');
      expect(fieldNames).toContain('Rejoint le');
      expect(fieldNames).toContain('Rôles');
    });

    it('omit Rejoint le / Rôles si le membre n\'est pas dans le cache du guild', async () => {
      const r = new CommandRegistry();
      registerInfo(r);
      const ctx = makeMockCtx();

      const user = makeUser({ id: 'u-1' });
      const guild = makeGuild();

      const i = makeChatInput({
        commandName: 'info',
        subcommand: 'userinfo',
        user,
        guild,
      });

      await r.dispatch(i, ctx);

      const arg = (i.reply as any).mock.calls[0][0];
      const fieldNames = (arg.embeds[0].data.fields || []).map((f: any) => f.name);
      expect(fieldNames).not.toContain('Rejoint le');
      expect(fieldNames).not.toContain('Rôles');
    });
  });

  describe('/info avatar', () => {
    it('répond avec un embed image pointant vers l\'avatar 4096px', async () => {
      const r = new CommandRegistry();
      registerInfo(r);
      const ctx = makeMockCtx();

      const user = makeUser();
      const i = makeChatInput({ commandName: 'info', subcommand: 'avatar', user });
      await r.dispatch(i, ctx);

      const arg = (i.reply as any).mock.calls[0][0];
      expect(arg.ephemeral).toBe(true);
      expect(arg.embeds[0].data.image?.url).toBe('http://avatar/abc.png');
    });
  });

  describe('/info serverinfo', () => {
    it('construit un embed avec id, membres, créé le, propriétaire, salons', async () => {
      const r = new CommandRegistry();
      registerInfo(r);
      const ctx = makeMockCtx();

      const guild = makeGuild({ memberCount: 250, name: 'MyServer' });
      guild.channels.cache.set('c-1', { id: 'c-1', name: 'general' });
      guild.channels.cache.set('c-2', { id: 'c-2', name: 'memes' });

      const i = makeChatInput({
        commandName: 'info',
        subcommand: 'serverinfo',
        guild,
      });

      await r.dispatch(i, ctx);

      const arg = (i.reply as any).mock.calls[0][0];
      const fieldNames = (arg.embeds[0].data.fields || []).map((f: any) => f.name);
      expect(fieldNames).toEqual(expect.arrayContaining(['ID', 'Membres', 'Créé le', 'Propriétaire', 'Salons']));
    });

    it("rejette sans guild_id en DM (interaction.guildId undefined)", async () => {
      const r = new CommandRegistry();
      registerInfo(r);
      const ctx = makeMockCtx();

      const i = makeChatInput({
        commandName: 'info',
        subcommand: 'serverinfo',
      });
      // Pas de guild, et options.getString('guild_id') retourne null
      (i.options.getString as any) = vi.fn().mockReturnValue(null);

      await r.dispatch(i, ctx);

      const arg = (i.reply as any).mock.calls[0][0];
      expect(arg.content).toContain('ID du serveur requis');
    });
  });

  describe('/info channelinfo', () => {
    it('construit un embed avec ID, type, catégorie, créé le', async () => {
      const r = new CommandRegistry();
      registerInfo(r);
      const ctx = makeMockCtx();

      const channel = {
        id: 'c-1',
        name: 'general',
        type: 0,
        parent: { id: 'cat-1' },
        createdTimestamp: Date.parse('2021-01-01T00:00:00Z'),
      };

      const i = makeChatInput({
        commandName: 'info',
        subcommand: 'channelinfo',
        channelArg: channel,
        guild: makeGuild(),
      });

      await r.dispatch(i, ctx);

      const arg = (i.reply as any).mock.calls[0][0];
      const fieldNames = (arg.embeds[0].data.fields || []).map((f: any) => f.name);
      expect(fieldNames).toEqual(expect.arrayContaining(['ID', 'Type', 'Catégorie', 'Créé le']));
      expect(arg.embeds[0].data.title).toContain('general');
    });
  });

  describe('/info roleinfo', () => {
    it('construit un embed avec ID, couleur, position, membres', async () => {
      const r = new CommandRegistry();
      registerInfo(r);
      const ctx = makeMockCtx();

      const role = makeRole({ name: 'Modérateur', color: 0xff8800, position: 8 });
      const i = makeChatInput({
        commandName: 'info',
        subcommand: 'roleinfo',
        roleArg: role,
        guild: makeGuild(),
      });

      await r.dispatch(i, ctx);

      const arg = (i.reply as any).mock.calls[0][0];
      const fields = arg.embeds[0].data.fields || [];
      const fieldMap = Object.fromEntries(fields.map((f: any) => [f.name, f.value]));
      expect(fieldMap['ID']).toBe('role-1');
      expect(fieldMap['Couleur']).toContain('ff8800');
      expect(fieldMap['Position']).toBe('8');
      expect(arg.embeds[0].data.title).toContain('Modérateur');
    });
  });

  describe('/info banner', () => {
    it('répond avec un embed image pointant vers la bannière', async () => {
      const r = new CommandRegistry();
      registerInfo(r);
      const ctx = makeMockCtx();

      const user = makeUser();
      const i = makeChatInput({ commandName: 'info', subcommand: 'banner', user });
      await r.dispatch(i, ctx);

      const arg = (i.reply as any).mock.calls[0][0];
      expect(arg.embeds[0].data.image?.url).toBe('http://banner/abc.png');
    });

    it('rejette si l\'utilisateur n\'a pas de bannière', async () => {
      const r = new CommandRegistry();
      registerInfo(r);
      const ctx = makeMockCtx();

      const user = makeUser();
      (user as any).bannerURL = vi.fn().mockReturnValue(null);

      const i = makeChatInput({ commandName: 'info', subcommand: 'banner', user });
      await r.dispatch(i, ctx);

      const arg = (i.reply as any).mock.calls[0][0];
      expect(arg.content).toContain("n'a pas de bannière");
    });
  });

  describe('/info emoteinfo', () => {
    it('parse un emoji custom et affiche id + animé', async () => {
      const r = new CommandRegistry();
      registerInfo(r);
      const ctx = makeMockCtx();

      const i = makeChatInput({
        commandName: 'info',
        subcommand: 'emoteinfo',
        stringArg: '<:pepe:123456789>',
        guild: makeGuild(),
      });

      await r.dispatch(i, ctx);

      const arg = (i.reply as any).mock.calls[0][0];
      expect(arg.embeds[0].data.title).toBe('😀 pepe');
      expect(arg.embeds[0].data.image?.url).toContain('cdn.discordapp.com/emojis/123456789.png');
    });

    it('rejette un format invalide', async () => {
      const r = new CommandRegistry();
      registerInfo(r);
      const ctx = makeMockCtx();

      const i = makeChatInput({
        commandName: 'info',
        subcommand: 'emoteinfo',
        stringArg: 'not an emoji',
        guild: makeGuild(),
      });

      await r.dispatch(i, ctx);

      const arg = (i.reply as any).mock.calls[0][0];
      expect(arg.content).toContain('invalide');
    });
  });

  describe('/info stats', () => {
    it('construit un message avec nom, id, créé, serveurs, amis', async () => {
      const r = new CommandRegistry();
      registerInfo(r);

      const selfbot = {
        user: makeUser({ id: 'self-1', tag: 'Me#0001' }),
        guilds: { cache: { size: 25 } },
        relationships: { friendCache: { size: 12 } },
      };
      const ctx = makeMockCtx({ dm: { selfbot } as any });

      const i = makeChatInput({ commandName: 'info', subcommand: 'stats' });
      await r.dispatch(i, ctx);

      const arg = (i.reply as any).mock.calls[0][0];
      expect(arg.ephemeral).toBe(true);
      expect(arg.content).toContain('Me#0001');
      expect(arg.content).toContain('25');
      expect(arg.content).toContain('12');
    });

    it('rejette si le selfbot n\'est pas connecté', async () => {
      const r = new CommandRegistry();
      registerInfo(r);
      const ctx = makeMockCtx({ dm: { selfbot: null } as any });

      const i = makeChatInput({ commandName: 'info', subcommand: 'stats' });
      await r.dispatch(i, ctx);

      const arg = (i.reply as any).mock.calls[0][0];
      expect(arg.content).toContain('non connecté');
    });
  });

  describe('/info servericon', () => {
    it("répond avec un embed image pointant vers l'icône", async () => {
      const r = new CommandRegistry();
      registerInfo(r);
      const ctx = makeMockCtx();

      const guild = makeGuild({ iconURL: 'http://icon/g.png' });
      const i = makeChatInput({ commandName: 'info', subcommand: 'servericon', guild });

      await r.dispatch(i, ctx);

      const arg = (i.reply as any).mock.calls[0][0];
      expect(arg.embeds[0].data.image?.url).toBe('http://icon/g.png');
    });

    it("rejette sans icône", async () => {
      const r = new CommandRegistry();
      registerInfo(r);
      const ctx = makeMockCtx();

      const guild = makeGuild({ iconURL: null });
      (guild as any).iconURL = vi.fn().mockReturnValue(null);
      const i = makeChatInput({ commandName: 'info', subcommand: 'servericon', guild });

      await r.dispatch(i, ctx);

      const arg = (i.reply as any).mock.calls[0][0];
      expect(arg.content).toContain("pas d'icône");
    });
  });
});
