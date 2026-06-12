/**
 * Types WebSocket partagés (Frontend)
 * Mirror de core/shared/types.ts
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
  // Commands
  | 'command_used'
  // Logs
  | 'core_log'
  // Autobump
  | 'enable_autobump' | 'disable_autobump' | 'get_autobump_status' | 'autobump_status'
  // Bot token management
  | 'save_bot_token' | 'bot_token_saved'
  // Auto setup
  | 'auto_setup_bot' | 'setup_progress';

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
  smallImage?: string;
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

export interface CoreLogMessage extends WsBaseMessage {
  type: 'core_log';
  level: 'info' | 'error' | 'warn' | 'debug';
  module: string;
  message: string;
  logTimestamp: string;
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

export interface AutoSetupBotMessage extends WsBaseMessage {
  type: 'auto_setup_bot';
  appName?: string;
}

export interface SetupProgressMessage extends WsBaseMessage {
  type: 'setup_progress';
  step: string;
  message: string;
  appId?: string;
  token?: string;
  authorizeUrl?: string;
  error?: string;
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
  details?: string;
  state?: string;
  largeImage?: string;
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
  | DiscordReadyMessage
  | StatusMessage
  | ToastMessage
  | NotificationMessage
  | ErrorMessage
  | BackupSuccessMessage
  | CoreLogMessage
  | EnableAutobumpMessage
  | DisableAutobumpMessage
  | GetAutobumpStatusMessage
  | AutobumpStatusMessage
  | SaveBotTokenMessage
  | BotTokenSavedMessage
  | AutoSetupBotMessage
  | SetupProgressMessage;
