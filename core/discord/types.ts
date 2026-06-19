/**
 * Types compatibles avec l'API discord.js-selfbot-v13
 * Permet un drop-in replacement de la bibliothèque abandonnée.
 */

import { EventEmitter } from "events";

// ============================================================================
// PERMISSIONS
// ============================================================================

export const PermissionsFlags = {
  SEND_MESSAGES: BigInt(2048),
} as const;

export class Permissions {
  private bitfield: bigint;
  constructor(bitfield: bigint) {
    this.bitfield = bitfield;
  }
  has(permission: bigint): boolean {
    return (this.bitfield & permission) === permission;
  }
  static get FLAGS() {
    return PermissionsFlags;
  }
}

// ============================================================================
// USER
// ============================================================================

export interface IUser {
  id: string;
  username: string;
  tag: string;
  bot: boolean;
  createdTimestamp: number;
  displayAvatarURL(options?: { size?: number }): string;
  send(content: string): Promise<IMessage>;
}

// ============================================================================
// GUILD MEMBER
// ============================================================================

export interface IGuildMember {
  id: string;
  joinedTimestamp: number | null;
  displayAvatarURL(options?: { size?: number }): string;
  kick(reason?: string): Promise<void>;
  roles: { cache: Map<string, { id: string; name: string; color: number }> };
}

// ============================================================================
// MESSAGE MENTIONS
// ============================================================================

export interface IMessageMentions {
  users: {
    first(): IUser | undefined;
    has(userId: string): boolean;
    size: number;
    at(index: number): IUser | undefined;
  };
}

// ============================================================================
// MESSAGE
// ============================================================================

export interface IMessage {
  id: string;
  content: string;
  author: IUser;
  channel: IChannel;
  guild: IGuild | null;
  guildId?: string;
  channelId: string;
  mentions: IMessageMentions;
  deletable: boolean;
  createdTimestamp: number;
  embeds: Array<{ title?: string; description?: string; url?: string }>;
  components?: Array<{
    components: Array<{
      custom_id?: string;
      label?: string;
      type: number;
    }>;
  }>;
  interaction?: {
    id: string;
    token: string;
    commandName: string;
    user: IUser;
    guildId?: string;
  };
  attachments: Map<string, { url: string; name: string }>;
  stickers: Map<string, { name: string; id: string }>;
  client: { user: { id: string } } | null;
  delete(): Promise<void>;
  edit(content: string): Promise<IMessage>;
  react(emoji: string): Promise<void>;
  reply(content: string): Promise<IMessage>;
}

// ============================================================================
// CHANNEL
// ============================================================================

export interface IChannel {
  id: string;
  name?: string;
  type: string;
  isText(): boolean;
  isTextBased(): boolean;
  isThread(): boolean;
  parent: IChannel | null;
  recipients?: Array<{ id: string }>;
  guild?: IGuild;
  send(content: string | {
    content?: string;
    tts?: boolean;
    embeds?: any[];
    components?: any[];
    message_reference?: { message_id: string };
    allowed_mentions?: { parse?: string[]; users?: string[]; roles?: string[]; replied_user?: boolean };
    flags?: number;
  }): Promise<IMessage>;
  sendTyping(): Promise<void>;
  permissionsFor(userId: string): Permissions | null;
  messages: {
    fetch(options: { limit?: number } | string): Promise<Map<string, IMessage> | IMessage | undefined>;
  };
  createWebhook(name: string, options: { avatar: string }): Promise<{
    send(options: { content: string; threadId?: string }): Promise<void>;
    delete(): Promise<void>;
  }>;
}

// ============================================================================
// GUILD
// ============================================================================

export interface IGuild {
  id: string;
  name: string;
  createdTimestamp: number;
  iconURL(): string | undefined;
  ownerId: string;
  memberCount: number;
  members: {
    cache: Map<string, IGuildMember>;
    // v0.4.1: signature union pour matcher le vrai discord.js :
    // - fetch() sans args → Map de tous les membres
    // - fetch(userId) → IGuildMember unique
    // On type comme `any` ici car l'union discriminated est trop complexe
    // pour notre interface custom; le code appelant doit caster.
    fetch(userId?: string): any;
    ban(userId: string, options?: { reason?: string }): Promise<void>;
    unban(userId: string, reason?: string): Promise<void>;
  };
  roles: {
    cache: Map<string, { id: string; name: string; color: number }>;
  };
  channels: {
    cache: Map<string, IChannel>;
  };
}

// ============================================================================
// VOICE STATE
// ============================================================================

export interface IVoiceState {
  member: { user: IUser; id: string } | null;
  channel: { id: string; name?: string; guild: { id: string } } | null;
  channelId?: string;
  guild: { id: string };
}

// ============================================================================
// RELATIONSHIP
// ============================================================================

export interface IRelationship {
  type: number;
  id: string;
  user?: IUser;
}

// ============================================================================
// CLIENT USER (user connected to selfbot)
// ============================================================================

export interface IClientUser {
  id: string;
  tag: string;
  username: string;
  bot: false;
  createdTimestamp: number;
  displayAvatarURL(options?: { size?: number }): string;
  setPresence(data: {
    activities?: Array<{
      name?: string;
      type?: string | number;
      state?: string;
      emoji?: { name: string };
      application_id?: string;
      details?: string;
      assets?: Record<string, string>;
      timestamps?: { start?: number; end?: number };
      buttons?: string[];
      metadata?: { button_urls?: string[] };
      url?: string;
    }>;
    status?: string;
    since?: number;
    afk?: boolean;
  }): void;
  setActivity(name?: string | null): void;
}

// ============================================================================
// GATEWAY PROPERTIES (identify payload)
// ============================================================================

export interface GatewayProperties {
  os: string;
  browser: string;
  device: string;
  release_channel?: string;
  client_version?: string;
  os_version?: string;
  os_arch?: string;
  app_arch?: string;
  system_locale?: string;
  has_client_mods?: boolean;
  client_launch_id?: string;
  browser_user_agent?: string;
  browser_version?: string;
  os_sdk_version?: string;
  client_build_number?: number;
  native_build_number?: number;
  client_event_source?: null;
  launch_signature?: string;
  client_heartbeat_session_id?: string;
  client_app_state?: string;
}

// ============================================================================
// CLIENT EVENTS (matching discord.js-selfbot-v13)
// ============================================================================

export interface SelfbotClientEvents {
  ready: () => void;
  relationshipAdd: (friend: IRelationship) => void;
  relationshipRemove: (friend: IRelationship) => void;
  guildCreate: (guild: IGuild) => void;
  guildDelete: (guild: IGuild) => void;
  guildMemberUpdate: (oldMember: IGuildMember, newMember: IGuildMember) => void;
  messageDelete: (msg: IMessage) => void;
  messageUpdate: (oldMsg: IMessage, newMsg: IMessage) => void;
  messageCreate: (msg: IMessage) => void;
  voiceStateUpdate: (oldState: IVoiceState, newState: IVoiceState) => void;
}

// ============================================================================
// MAIN CLIENT INTERFACE (what DiscordManager expects)
// ============================================================================

export interface IDiscordUserClient extends EventEmitter {
  user: IClientUser | null;
  guilds: {
    cache: Map<string, IGuild>;
    fetch(guildId: string): Promise<IGuild>;
  };
  channels: { cache: Map<string, IChannel>; fetch(id: string): Promise<IChannel | undefined> };
  relationships: {
    friendCache: Map<string, any>;
    cache: Map<string, IRelationship>;
    friendCount: number;
  };
  users: { cache: Map<string, IUser> };
  sessionId: string | null;
  options: { ws: { properties: GatewayProperties } };
  isReady(): boolean;
  login(token: string): Promise<void>;
  destroy(): void;

  on<K extends keyof SelfbotClientEvents>(event: K, listener: SelfbotClientEvents[K]): this;
  emit<K extends keyof SelfbotClientEvents>(event: K, ...args: Parameters<SelfbotClientEvents[K]>): boolean;
}
