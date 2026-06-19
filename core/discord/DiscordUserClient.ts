/**
 * Client utilisateur Discord unifié.
 * Remplace discord.js-selfbot-v13 : Gateway + REST + caches + events.
 */

import { EventEmitter } from "events";
import { logger } from "../services/Logger";
import { DiscordGateway } from "./DiscordGateway";
import { DiscordREST } from "./DiscordREST";
import {
  IClientUser,
  IChannel,
  IMessage,
  IGuild,
  IGuildMember,
  IUser,
  IRelationship,
  IVoiceState,
  IMessageMentions,
  GatewayProperties,
  Permissions,
  IDiscordUserClient,
  SelfbotClientEvents,
} from "./types";

// Discord bot account discriminator is "0000"
function makeTag(username: string, discriminator: string): string {
  return discriminator === "0" || discriminator === "0000"
    ? username
    : `${username}#${discriminator}`;
}

export class DiscordUserClient
  extends EventEmitter
  implements IDiscordUserClient
{
  public user: IClientUser | null = null;
  public guilds: {
    cache: Map<string, IGuild>;
    fetch: (guildId: string) => Promise<IGuild>;
  };
  public channels: {
    cache: Map<string, IChannel>;
    fetch(id: string): Promise<IChannel | undefined>;
  };
  public relationships: {
    friendCache: Map<string, any>;
    cache: Map<string, IRelationship>;
    friendCount: number;
  };
  public users: { cache: Map<string, IUser> };
  public sessionId: string | null = null;
  public options: { ws: { properties: GatewayProperties } };

  private gateway: DiscordGateway;
  private rest: DiscordREST;
  private token: string | null = null;
  private ready = false;

  // Caches locaux pour factory
  private guildCache = new Map<string, IGuild>();
  private channelCache = new Map<string, IChannel>();
  private userCache = new Map<string, IUser>();
  private relationshipCache = new Map<string, IRelationship>();
  private friendCache = new Map<string, any>();
  private memberCache = new Map<string, Map<string, IGuildMember>>();
  private channelPermissions = new Map<string, number>();

  constructor(properties: GatewayProperties) {
    super();
    this.options = { ws: { properties } };
    this.rest = new DiscordREST(properties);
    this.gateway = new DiscordGateway(properties);

    this.guilds = {
      cache: this.guildCache,
      fetch: (guildId: string) => this.fetchGuild(guildId),
    };
    this.users = { cache: this.userCache };
    this.relationships = {
      friendCache: this.friendCache,
      cache: this.relationshipCache,
      friendCount: 0,
    };

    this.channels = {
      cache: this.channelCache,
      fetch: (id: string) => this.fetchChannel(id),
    };

    this.setupGatewayListeners();
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  getRest(): DiscordREST {
    return this.rest;
  }

  isReady(): boolean {
    return this.ready;
  }

  async login(token: string): Promise<void> {
    this.token = token;
    this.rest.setToken(token);

    logger.info("DiscordUserClient", "Connexion en cours...");
    await this.gateway.connect(token);
  }

  destroy(): void {
    this.ready = false;
    this.gateway.destroy();
    this.removeAllListeners();
    logger.info("DiscordUserClient", "Détruit");
  }

  // ==========================================================================
  // GATEWAY LISTENERS
  // ==========================================================================

  private setupGatewayListeners(): void {
    this.gateway.on("gateway:ready", async (data: any) => {
      await this.handleReady(data);
    });

    this.gateway.on(
      "gateway:messageCreate",
      (data: any) => this.handleMessageCreate(data)
    );
    this.gateway.on(
      "gateway:messageUpdate",
      (data: any) => this.handleMessageUpdate(data)
    );
    this.gateway.on(
      "gateway:messageDelete",
      (data: any) => this.handleMessageDelete(data)
    );
    this.gateway.on(
      "gateway:voiceStateUpdate",
      (data: any) => this.handleVoiceStateUpdate(data)
    );
    this.gateway.on(
      "gateway:guildCreate",
      (data: any) => this.handleGuildCreate(data)
    );
    this.gateway.on(
      "gateway:guildDelete",
      (data: any) => this.handleGuildDelete(data)
    );
    this.gateway.on(
      "gateway:guildMemberUpdate",
      (data: any) => this.handleGuildMemberUpdate(data)
    );
    this.gateway.on(
      "gateway:relationshipAdd",
      (data: any) => this.handleRelationshipAdd(data)
    );
    this.gateway.on(
      "gateway:relationshipRemove",
      (data: any) => this.handleRelationshipRemove(data)
    );
  }

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  private async handleReady(data: any): Promise<void> {
    const profile = data.user;

    this.sessionId = data.session_id;

    this.user = {
      id: profile.id,
      username: profile.username,
      bot: false as const,
      tag: makeTag(profile.username, profile.discriminator || "0"),
      createdTimestamp: 0,
      displayAvatarURL: (options?: any) => {
        const avatar = profile.avatar;
        if (!avatar) {
          const idx =
            (parseInt(profile.discriminator) || parseInt(profile.id) >> 22) % 5;
          return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
        }
        const ext = avatar.startsWith("a_") ? "gif" : "png";
        return `https://cdn.discordapp.com/avatars/${profile.id}/${avatar}.${ext}?size=${options?.size || 128}`;
      },
      setPresence: (presenceData) => {
        const activities = presenceData.activities
          ? presenceData.activities.map((a: any) => ({
              name: a.name || "Custom Status",
              type: typeof a.type === "string"
                ? ({ PLAYING: 0, STREAMING: 1, LISTENING: 2, WATCHING: 3, CUSTOM: 4, COMPETING: 5 } as any)[a.type] ?? 4
                : a.type,
              state: a.state,
              emoji: a.emoji,
              application_id: a.application_id,
              details: a.details,
              assets: a.assets,
              timestamps: a.timestamps,
              buttons: a.buttons,
              metadata: a.metadata,
              url: a.url,
            }))
          : [];
        this.gateway.sendPresenceUpdate(
          activities,
          presenceData.status || "online",
          presenceData.since
        );
      },
      setActivity: (name?: string | null) => {
        if (!name) {
          this.gateway.sendPresenceUpdate([], "online");
        } else {
          this.gateway.sendPresenceUpdate(
            [{ name, type: 0 }],
            "online"
          );
        }
      },
    };

    // Populate guilds
    if (data.guilds) {
      for (const g of data.guilds) {
        this.cacheGuild(g);
      }
    }

    // Fetch relationships and channels
    try {
      const [relationships, dmChannels] = await Promise.all([
        this.rest.fetchRelationships(),
        this.rest.fetchChannels(),
      ]);
      this.populateRelationships(relationships);
      this.populateChannels(dmChannels);
    } catch (err) {
      logger.warn("DiscordUserClient", "Erreur fetch initial relationships");
    }

    this.ready = true;
    logger.info("DiscordUserClient", `Prêt: ${this.user.tag}`);
    this.emit("ready");
  }

  private handleMessageCreate(data: any): void {
    const msg = this.buildMessage(data);
    if (!msg) return;

    // Mise en cache des infos auteur pour le sniper
    if (msg.author) {
      this.userCache.set(msg.author.id, msg.author);
    }

    this.emit("messageCreate", msg);
  }

  private handleMessageUpdate(data: any): void {
    // Discord envoie le message complet comme MESSAGE_UPDATE (pas juste delta)
    // On simule le comportement discord.js: on passe le meme objet comme old et new
    const msg = this.buildMessage(data);
    if (!msg) return;
    this.emit("messageUpdate", msg, msg);
  }

  private handleMessageDelete(data: any): void {
    const msg = this.buildMessage(data);
    if (!msg) return;
    this.emit("messageDelete", msg);
  }

  private handleVoiceStateUpdate(data: any): void {
    const member = data.member
      ? {
          user: this.buildUser(data.member.user),
          id: data.member.user?.id || data.user_id,
        }
      : null;

    const channel = data.channel_id
      ? {
          id: data.channel_id,
          name: undefined,
          guild: { id: data.guild_id || "0" },
        }
      : null;

    const state: IVoiceState = {
      member,
      channel,
      channelId: data.channel_id,
      guild: { id: data.guild_id || "0" },
    };

    this.emit("voiceStateUpdate", state, state);
  }

  private handleGuildCreate(data: any): void {
    const guild = this.cacheGuild(data);
    this.emit("guildCreate", guild);
  }

  private handleGuildDelete(data: any): void {
    const guild = this.guildCache.get(data.id) || this.buildMinimalGuild(data);
    this.guildCache.delete(data.id);
    this.emit("guildDelete", guild);
  }

  private handleGuildMemberUpdate(data: any): void {
    if (!this.user || data.user?.id !== this.user.id) return;

    const guild = this.guildCache.get(data.guild_id);
    if (!guild) return;

    const oldMember = this.buildGuildMember(data, guild);
    const newMember = this.buildGuildMember(data, guild);
    this.emit("guildMemberUpdate", oldMember, newMember);
  }

  private handleRelationshipAdd(data: any): void {
    const rel: IRelationship = { type: data.type, id: data.id, user: data.user ? this.buildUser(data.user) : undefined };
    this.relationshipCache.set(data.id, rel);
    if (data.type === 1) {
      this.friendCache.set(data.id, data);
      this.relationships.friendCount = this.friendCache.size;
    }
    this.emit("relationshipAdd", rel);
  }

  private handleRelationshipRemove(data: any): void {
    const rel: IRelationship = { type: data.type ?? 1, id: data.id, user: data.user ? this.buildUser(data.user) : undefined };
    this.relationshipCache.delete(data.id);
    this.friendCache.delete(data.id);
    this.relationships.friendCount = this.friendCache.size;
    this.emit("relationshipRemove", rel);
  }

  // ==========================================================================
  // CACHE BUILDERS
  // ==========================================================================

  private cacheGuild(data: any): IGuild {
    const guild = this.buildGuild(data);
    this.guildCache.set(guild.id, guild);
    return guild;
  }

  private populateRelationships(rels: any[]): void {
    this.friendCache.clear();
    this.relationshipCache.clear();
    for (const rel of rels) {
      const r: IRelationship = {
        type: rel.type,
        id: rel.id,
        user: rel.user ? this.buildUser(rel.user) : undefined,
      };
      this.relationshipCache.set(rel.id, r);
      if (rel.type === 1) {
        this.friendCache.set(rel.id, rel);
      }
    }
    this.relationships.friendCount = this.friendCache.size;
  }

  private populateChannels(channels: any[]): void {
    for (const ch of channels) {
      const channel = this.buildChannel(ch);
      this.channelCache.set(channel.id, channel);
    }
  }

  // ==========================================================================
  // FETCH
  // ==========================================================================

  async fetchChannel(channelId: string): Promise<IChannel | undefined> {
    if (this.channelCache.has(channelId)) {
      return this.channelCache.get(channelId);
    }
    try {
      const data = await this.rest.fetchChannel(channelId);
      const channel = this.buildChannel(data);
      this.channelCache.set(channelId, channel);
      return channel;
    } catch {
      return undefined;
    }
  }

  async fetchGuild(guildId: string): Promise<IGuild> {
    if (this.guildCache.has(guildId)) {
      return this.guildCache.get(guildId)!;
    }
    const guilds = await this.rest.fetchGuilds();
    const found = guilds.find((g: any) => g.id === guildId);
    if (!found) throw new Error(`Guild ${guildId} not found`);
    const guild = this.buildGuild(found);
    this.guildCache.set(guildId, guild);
    return guild;
  }

  // ==========================================================================
  // OBJECT BUILDERS
  // ==========================================================================

  private buildUser(raw: any): IUser {
    if (!raw) return { id: "0", username: "Unknown", tag: "Unknown#0000", bot: false, createdTimestamp: 0, displayAvatarURL: () => "", send: async () => { throw new Error("not implemented"); } };

    const user: IUser = {
      id: raw.id,
      username: raw.username || "Unknown",
      tag: makeTag(raw.username || "Unknown", raw.discriminator || "0"),
      bot: raw.bot || false,
      createdTimestamp: raw.id
        ? Math.floor(((parseInt(raw.id) >> 22) + 1420070400000) / 4194304)
        : 0,
      displayAvatarURL: (options?: any) => {
        const avatar = raw.avatar;
        if (!avatar) {
          const idx = (parseInt(raw.discriminator) || parseInt(raw.id) >> 22) % 5;
          return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
        }
        const ext = avatar.startsWith("a_") ? "gif" : "png";
        return `https://cdn.discordapp.com/avatars/${raw.id}/${avatar}.${ext}?size=${options?.size || 128}`;
      },
      send: async (content: string) => {
        const ch = await this.rest.sendMessage(raw.id, content);
        return this.buildMessage({ ...ch, channel_id: raw.id });
      },
    };
    return user;
  }

  private buildChannel(raw: any): IChannel {
    const rest = this.rest;
    const channelCache = this.channelCache;
    const guildCache = this.guildCache;
    const userCache = this.userCache;

    const channel: IChannel = {
      id: raw.id,
      name: raw.name || raw.recipients?.map((r: any) => r.username || r.global_name || "Unknown").join(", "),
      type: raw.type !== undefined ? String(raw.type) : "GUILD_TEXT",
      isText: () => {
        const t = raw.type;
        return t === 0 || t === 5 || t === 11 || t === 12 || t === 15;
      },
      isTextBased: () => {
        const t = raw.type;
        return [0, 1, 3, 5, 11, 12, 15].includes(t);
      },
      isThread: () => [11, 12].includes(raw.type),
      parent: raw.parent_id ? channelCache.get(raw.parent_id) || null : null,
      recipients: raw.recipients?.map((r: any) => ({ id: r.id })),
      guild: raw.guild_id ? guildCache.get(raw.guild_id) : undefined,
      send: async (content: any) => {
        const data = await rest.sendMessage(raw.id, content);
        return this.buildMessage({ ...data, channel_id: raw.id, guild_id: raw.guild_id });
      },
      sendTyping: async () => {
        await rest.sendTyping(raw.id);
      },
      permissionsFor: (userId: string) => {
        const perm = raw.permission_overwrites
          ? BigInt(0)
          : BigInt(1024);
        return new Permissions(perm);
      },
      messages: {
        fetch: async (options: any) => {
          if (typeof options === "string") {
            const data = await rest.fetchMessage(raw.id, options);
            return this.buildMessage({ ...data, channel_id: raw.id, guild_id: raw.guild_id });
          }
          const limit = options?.limit || 50;
          const datas = await rest.fetchMessages(raw.id, limit);
          const map = new Map<string, IMessage>();
          for (const d of datas) {
            const msg = this.buildMessage({ ...d, channel_id: raw.id, guild_id: raw.guild_id });
            map.set(msg.id, msg);
          }
          return map;
        },
      },
      createWebhook: async (name: string, opts: { avatar: string }) => {
        const wh = await rest.createWebhook(raw.id, name, opts.avatar);
        return {
          send: async (sendOpts: { content: string; threadId?: string }) => {
            await rest.sendWebhook(wh.id, wh.token, sendOpts.content, sendOpts.threadId);
          },
          delete: async () => {
            await rest.deleteWebhook(wh.id, wh.token);
          },
        };
      },
    };
    return channel;
  }

  private buildGuild(raw: any): IGuild {
    const rest = this.rest;
    const guildCache = this.guildCache;

    const guild: IGuild = {
      id: raw.id,
      name: raw.name || "Unknown",
      createdTimestamp: raw.id
        ? Math.floor(((parseInt(raw.id) >> 22) + 1420070400000) / 4194304)
        : 0,
      iconURL: () => {
        if (!raw.icon) return undefined;
        const ext = raw.icon.startsWith("a_") ? "gif" : "png";
        return `https://cdn.discordapp.com/icons/${raw.id}/${raw.icon}.${ext}`;
      },
      ownerId: raw.owner_id || raw.ownerId || "0",
      memberCount: raw.member_count ?? raw.memberCount ?? 0,
      members: {
        cache: this.getMemberStore(raw.id),
        fetch: async (userId: string) => {
          const data = await rest.fetchMember(raw.id, userId);
          const member = this.buildGuildMember(data, guild);
          const store = this.getMemberStore(raw.id);
          store.set(member.id, member);
          return member;
        },
        ban: async (userId: string, options?: { reason?: string }) => {
          await rest.banMember(raw.id, userId, options?.reason);
        },
        unban: async (userId: string, reason?: string) => {
          await rest.unbanMember(raw.id, userId, reason);
        },
      },
      roles: { cache: new Map() },
      channels: { cache: new Map() },
    };
    return guild;
  }

  private buildMinimalGuild(raw: any): IGuild {
    return this.buildGuild(raw);
  }

  private buildGuildMember(raw: any, guild: IGuild): IGuildMember {
    const rest = this.rest;
    const member: IGuildMember = {
      id: raw.user?.id || raw.id,
      joinedTimestamp: raw.joined_at ? Date.parse(raw.joined_at) : null,
      displayAvatarURL: (options?: any) => {
        const avatar = raw.avatar || raw.user?.avatar;
        if (!avatar) return "";
        const ext = avatar.startsWith("a_") ? "gif" : "png";
        return `https://cdn.discordapp.com/guilds/${guild.id}/users/${member.id}/avatars/${avatar}.${ext}?size=${options?.size || 128}`;
      },
      kick: async (reason?: string) => {
        await rest.kickMember(guild.id, member.id, reason);
      },
      roles: { cache: new Map() },
    };
    return member;
  }

  private buildMessage(raw: any): IMessage {
    const author = raw.author ? this.buildUser(raw.author) : this.buildUser({ id: raw.author_id || "0", username: "Unknown" });
    const channel = raw.channel_id
      ? (this.channelCache.get(raw.channel_id) || this.buildChannel({ id: raw.channel_id, type: raw.guild_id != null ? 0 : 1 }))
      : this.buildChannel({ id: "0", type: 0 });
    const guild = raw.guild_id ? (this.guildCache.get(raw.guild_id) || this.buildMinimalGuild({ id: raw.guild_id, name: "Unknown" })) : null;

    const rest = this.rest;
    const buildMsg = this.buildMessage.bind(this);

    const msg: IMessage = {
      id: raw.id,
      content: raw.content || "",
      author,
      channel,
      guild,
      guildId: raw.guild_id,
      channelId: raw.channel_id || "",
      mentions: {
        users: {
          first: () => {
            const m = raw.mentions?.[0];
            return m ? author : undefined;
          },
          has: (userId: string) => {
            return raw.mentions?.some((m: any) => m.id === userId) || false;
          },
          size: (raw.mentions || []).length,
          at: (index: number) => {
            const m = raw.mentions?.[index];
            return m ? { id: m.id, username: m.username || "Unknown", tag: m.username || "Unknown#0000", bot: m.bot || false, createdTimestamp: 0, displayAvatarURL: () => "", send: async () => { throw new Error("not implemented"); } } as IUser : undefined;
          },
        },
      },
      deletable: raw.author?.id === this.user?.id || false,
      createdTimestamp: raw.id
        ? Math.floor(((parseInt(raw.id) >> 22) + 1420070400000) / 4194304)
        : Date.now(),
      embeds: raw.embeds || [],
      components: raw.components || [],
      interaction: raw.interaction
        ? {
            id: raw.interaction.id,
            token: raw.interaction.token,
            commandName: raw.interaction.name || "",
            user: this.buildUser(raw.interaction.user),
            guildId: raw.interaction.guild_id,
          }
        : undefined,
      attachments: new Map(
        (raw.attachments || []).map((a: any) => [a.id, a])
      ),
      stickers: new Map(),
      client: this.user ? { user: { id: this.user.id } } : null,
      delete: async () => {
        if (raw.channel_id?.includes("@me") || typeof raw.channel_id === "string" && raw.channel_id.length < 10) {
          return;
        }
        await rest.deleteMessage(raw.channel_id || msg.channelId, raw.id);
      },
      edit: async (content: string) => {
        const data = await rest.editMessage(raw.channel_id || msg.channelId, raw.id, content);
        return buildMsg({ ...data, channel_id: raw.channel_id, guild_id: raw.guild_id });
      },
      react: async (emoji: string) => {
        await rest.reactMessage(raw.channel_id || msg.channelId, raw.id, emoji);
      },
      reply: async (content: string) => {
        const data = await rest.sendMessage(raw.channel_id || msg.channelId, {
          content,
          message_reference: { message_id: raw.id },
        });
        return buildMsg({ ...data, channel_id: raw.channel_id, guild_id: raw.guild_id });
      },
    };
    return msg;
  }

  private getMemberStore(guildId: string): Map<string, IGuildMember> {
    if (!this.memberCache.has(guildId)) {
      this.memberCache.set(guildId, new Map());
    }
    return this.memberCache.get(guildId)!;
  }
}
