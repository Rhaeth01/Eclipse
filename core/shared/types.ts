/**
 * Types partagés entre le Core (Node.js) et le Frontend (Next.js)
 * Définit le protocole WebSocket strict typé
 */

// ============================================================================
// BASE MESSAGE TYPES
// ============================================================================

export type WsMessageType = 
  // Connection & Auth
  | 'init' | 'discord_ready' | 'error'
  // Status & Notifications  
  | 'status' | 'toast' | 'notification'
  // Settings
  | 'set_stealth_mode' | 'set_silent_typing'
  // Animations
  | 'start_animation' | 'stop_animation'
  | 'start_rpc_animation' | 'stop_rpc_animation' | 'set_rich_presence' | 'clear_rich_presence'
  // Backup
  | 'create_backup' | 'backup_success'
  // Status queries
  | 'get_ratelimit_status'
  // Commands
  | 'command_used'
  // Quests
  | 'get_quests' | 'start_quest' | 'stop_quest' | 'claim_quest_reward' | 'create_mock_quests'
  | 'quests_update' | 'quest_progress' | 'quest_status'
  // Logs
  | 'core_log'
  // Sniper
  | 'update_sniper_config'
  // AutoSlash
  | 'enable_autobump' | 'disable_autobump' | 'get_autobump_status' | 'autobump_status'
  // Bot token management
  | 'save_bot_token' | 'bot_token_saved';

export interface WsBaseMessage {
  type: WsMessageType;
  timestamp?: number;
}

// ============================================================================
// CLIENT -> CORE MESSAGES
// ============================================================================

export interface InitMessage extends WsBaseMessage {
  type: 'init';
  token: string;
  appToken?: string;
}

export interface SetStealthModeMessage extends WsBaseMessage {
  type: 'set_stealth_mode';
  value: boolean;
}

export interface SetSilentTypingMessage extends WsBaseMessage {
  type: 'set_silent_typing';
  value: boolean;
}

export interface StartAnimationMessage extends WsBaseMessage {
  type: 'start_animation';
  frames: AnimationFrame[];
  delay: number;
}

export interface StopAnimationMessage extends WsBaseMessage {
  type: 'stop_animation';
}

export interface StartRpcAnimationMessage extends WsBaseMessage {
  type: 'start_rpc_animation';
  frames: RpcFrame[];
  delay: number;
}

export interface StopRpcAnimationMessage extends WsBaseMessage {
  type: 'stop_rpc_animation';
}

export interface SetRichPresenceMessage extends WsBaseMessage {
  type: 'set_rich_presence';
  name: string;
  appId: string;
  activityType: ActivityType;
  details?: string;
  state?: string;
  largeImage?: string;
  largeText?: string;
  smallImage?: string;
  smallText?: string;
  buttons?: RpcButton[];
  startTimestamp?: number;
  endTimestamp?: number;
}

export interface ClearRichPresenceMessage extends WsBaseMessage {
  type: 'clear_rich_presence';
}

export interface CreateBackupMessage extends WsBaseMessage {
  type: 'create_backup';
}

export interface GetRateLimitStatusMessage extends WsBaseMessage {
  type: 'get_ratelimit_status';
}

// ============================================================================
// CORE -> CLIENT MESSAGES
// ============================================================================

export interface DiscordReadyMessage extends WsBaseMessage {
  type: 'discord_ready';
  user: DiscordUserInfo;
}

export interface StatusMessage extends WsBaseMessage {
  type: 'status';
  message: string;
}

export interface ToastMessage extends WsBaseMessage {
  type: 'toast';
  title: string;
  content?: string;
}

export interface NotificationMessage extends WsBaseMessage {
  type: 'notification';
  action: NotificationAction;
  title?: string;
  content: string;
}

export interface ErrorMessage extends WsBaseMessage {
  type: 'error';
  message: string;
  code?: string;
}

export interface BackupSuccessMessage extends WsBaseMessage {
  type: 'backup_success';
  action: 'backup_success';
  title: string;
  content: string;
}

// Quest Messages
export interface GetQuestsMessage extends WsBaseMessage {
  type: 'get_quests';
}

export interface StartQuestMessage extends WsBaseMessage {
  type: 'start_quest';
  questId: string;
}

export interface StopQuestMessage extends WsBaseMessage {
  type: 'stop_quest';
  questId: string;
}

export interface ClaimQuestRewardMessage extends WsBaseMessage {
  type: 'claim_quest_reward';
  questId: string;
}

export interface CreateMockQuestsMessage extends WsBaseMessage {
  type: 'create_mock_quests';
}

export interface QuestsUpdateMessage extends WsBaseMessage {
  type: 'quests_update';
  quests: QuestInfo[];
}

export interface QuestProgressMessage extends WsBaseMessage {
  type: 'quest_progress';
  questId: string;
  current: number;
  target: number;
  percent: number;
}

export interface QuestStatusMessage extends WsBaseMessage {
  type: 'quest_status';
  questId: string;
  status: 'running' | 'stopped' | 'completed' | 'claimed';
}

export interface CoreLogMessage extends WsBaseMessage {
  type: 'core_log';
  level: 'info' | 'error' | 'warn' | 'debug';
  module: string;
  message: string;
  logTimestamp: string;
}

export interface UpdateSniperConfigMessage extends WsBaseMessage {
  type: 'update_sniper_config';
  config: {
    nitroSniper?: boolean;
    giveawayJoiner?: boolean;
    blockDetection?: boolean;
    pingDetection?: boolean;
    whitelistUsers?: string[];
    blacklistGuilds?: string[];
  };
}

export interface EnableAutobumpMessage extends WsBaseMessage {
  type: 'enable_autobump';
  guildId: string;
  channelId: string;
  interval?: number;
}

export interface DisableAutobumpMessage extends WsBaseMessage {
  type: 'disable_autobump';
  guildId: string;
}

export interface GetAutobumpStatusMessage extends WsBaseMessage {
  type: 'get_autobump_status';
  guildId: string;
}

export interface AutobumpStatusMessage extends WsBaseMessage {
  type: 'autobump_status';
  guildId: string;
  enabled?: boolean;
  status?: {
    channelId: string;
    guildId: string;
    interval: number;
    enabled: boolean;
    lastBump?: number;
    nextBump?: number;
  };
}

export interface SaveBotTokenMessage extends WsBaseMessage {
  type: 'save_bot_token';
  appToken: string;
}

export interface BotTokenSavedMessage extends WsBaseMessage {
  type: 'bot_token_saved';
  success: boolean;
  message: string;
}

export interface QuestInfo {
  id: string;
  title: string;
  description: string;
  type: 'VIDEO' | 'PLAY' | 'STREAM' | 'PLAY_ACTIVITY';
  targetGame?: {
    id: string;
    name: string;
    executables: string[];
  };
  targetVideo?: {
    id: string;
    durationSeconds: number;
  };
  reward: {
    type: 'NITRO' | 'ORBS' | 'DECORATION' | 'BADGE';
    name: string;
  };
  expiresAt: string;
  progress: {
    current: number;
    target: number;
    completed: boolean;
  };
}

// ============================================================================
// DATA TYPES
// ============================================================================

export interface DiscordUserInfo {
  id: string;
  tag: string;
  avatarURL: string | null;
  guildsCount: number;
  friendsCount: number;
}

export interface AnimationFrame {
  text: string;
  emoji?: string;
}

export type ActivityType = 'PLAYING' | 'WATCHING' | 'LISTENING' | 'STREAMING' | 'COMPETING' | 'CUSTOM';

export interface RpcButton {
  label: string;
  url: string;
}

export interface RpcFrame {
  name: string;
  appId: string;
  activityType: ActivityType;
  state?: string;
  details?: string;
  largeImage?: string;
  largeText?: string;
  smallImage?: string;
  smallText?: string;
  buttons?: RpcButton[];
  startTimestamp?: number;
  endTimestamp?: number;
}

export type NotificationAction = 
  | 'friend_removed_offline' | 'guild_removed_offline'
  | 'role_add' | 'role_remove'
  | 'direct_message' | 'keyword_ping'
  | 'spy_message' | 'spy_voice_join' | 'spy_voice_leave' | 'spy_voice_move'
  | 'ghostping' | 'spy_deleted'
  | 'command_used' | 'clone_start' | 'clone_success' | 'backup_success';

// ============================================================================
// UNION TYPE - All WebSocket Messages
// ============================================================================

export type WsMessage =
  // Client -> Core
  | InitMessage
  | SetStealthModeMessage
  | SetSilentTypingMessage
  | StartAnimationMessage
  | StopAnimationMessage
  | StartRpcAnimationMessage
  | StopRpcAnimationMessage
  | SetRichPresenceMessage
  | ClearRichPresenceMessage
  | CreateBackupMessage
  | GetRateLimitStatusMessage
  | GetQuestsMessage
  | StartQuestMessage
  | StopQuestMessage
  | ClaimQuestRewardMessage
  | CreateMockQuestsMessage
  | UpdateSniperConfigMessage
  | EnableAutobumpMessage
  | DisableAutobumpMessage
  | GetAutobumpStatusMessage
  | AutobumpStatusMessage
  | SaveBotTokenMessage
  // Core -> Client
  | DiscordReadyMessage
  | StatusMessage
  | ToastMessage
  | NotificationMessage
  | ErrorMessage
  | BackupSuccessMessage
  | QuestsUpdateMessage
  | QuestProgressMessage
  | QuestStatusMessage
  | CoreLogMessage
  | BotTokenSavedMessage;

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isWsMessage(data: unknown): data is WsMessage {
  if (typeof data !== 'object' || data === null) return false;
  const msg = data as Record<string, unknown>;
  return typeof msg.type === 'string' && 
    ['init', 'discord_ready', 'error', 'status', 'toast', 'notification',
     'set_stealth_mode', 'set_silent_typing', 'start_animation', 'stop_animation',
     'start_rpc_animation', 'stop_rpc_animation', 'set_rich_presence', 'clear_rich_presence',
     'create_backup', 'backup_success', 'command_used',
     'get_quests', 'start_quest', 'stop_quest', 'claim_quest_reward', 'create_mock_quests',
     'quests_update', 'quest_progress', 'quest_status', 'core_log', 'update_sniper_config',
     'enable_autobump', 'disable_autobump', 'get_autobump_status', 'autobump_status',
     'save_bot_token', 'bot_token_saved'].includes(msg.type);
}

// Type guard spécifiques
export function isInitMessage(msg: WsMessage): msg is InitMessage {
  return msg.type === 'init';
}

export function isStartAnimationMessage(msg: WsMessage): msg is StartAnimationMessage {
  return msg.type === 'start_animation';
}

export function isStartRpcAnimationMessage(msg: WsMessage): msg is StartRpcAnimationMessage {
  return msg.type === 'start_rpc_animation';
}

export function isSetRichPresenceMessage(msg: WsMessage): msg is SetRichPresenceMessage {
  return msg.type === 'set_rich_presence';
}
