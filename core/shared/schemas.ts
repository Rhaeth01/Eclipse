/**
 * Schémas Zod pour la validation des messages WebSocket
 * Assure l'intégrité des données entre Frontend et Core
 */

import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const ActivityTypeSchema = z.enum(['PLAYING', 'WATCHING', 'LISTENING', 'STREAMING', 'COMPETING', 'CUSTOM']);

export const NotificationActionSchema = z.enum([
  'friend_removed_offline', 'guild_removed_offline',
  'role_add', 'role_remove',
  'direct_message', 'keyword_ping',
  'spy_message', 'spy_voice_join', 'spy_voice_leave', 'spy_voice_move',
  'ghostping', 'spy_deleted',
  'command_used', 'clone_start', 'clone_success', 'backup_success'
]);

// ============================================================================
// BASE SCHEMAS
// ============================================================================

export const AnimationFrameSchema = z.object({
  text: z.string().min(1).max(128),
  emoji: z.string().max(2).optional()
});

export const RpcButtonSchema = z.object({
  label: z.string().min(1).max(32),
  url: z.string().url().max(512)
});

export const RpcFrameSchema = z.object({
  name: z.string().min(1).max(128),
  appId: z.string().regex(/^\d+$/).default('383226320970055681'),
  activityType: ActivityTypeSchema.default('PLAYING'),
  state: z.string().max(128).optional(),
  details: z.string().max(128).optional(),
  largeImage: z.string().max(512).optional(),
  largeText: z.string().max(128).optional(),
  smallImage: z.string().max(512).optional(),
  smallText: z.string().max(128).optional(),
  buttons: z.array(RpcButtonSchema).max(2).optional(),
  startTimestamp: z.number().optional(),
  endTimestamp: z.number().optional()
});

export const DiscordUserInfoSchema = z.object({
  id: z.string(),
  tag: z.string(),
  avatarURL: z.string().nullable(),
  guildsCount: z.number().int().min(0),
  friendsCount: z.number().int().min(0)
});

// ============================================================================
// MESSAGE SCHEMAS (Client -> Core)
// ============================================================================

export const InitMessageSchema = z.object({
  type: z.literal('init'),
  token: z.string().min(10),
  appToken: z.string().min(10).optional()
});

export const SetStealthModeSchema = z.object({
  type: z.literal('set_stealth_mode'),
  value: z.boolean()
});

export const SetSilentTypingSchema = z.object({
  type: z.literal('set_silent_typing'),
  value: z.boolean()
});

export const StartAnimationSchema = z.object({
  type: z.literal('start_animation'),
  frames: z.array(AnimationFrameSchema).min(1).max(20),
  delay: z.number().int().min(1000).max(60000).default(3000)
});

export const StopAnimationSchema = z.object({
  type: z.literal('stop_animation')
});

export const StartRpcAnimationSchema = z.object({
  type: z.literal('start_rpc_animation'),
  frames: z.array(RpcFrameSchema).min(1).max(10),
  delay: z.number().int().min(5000).max(300000).default(10000)
});

export const StopRpcAnimationSchema = z.object({
  type: z.literal('stop_rpc_animation')
});

export const SetRichPresenceSchema = z.object({
  type: z.literal('set_rich_presence'),
  name: z.string().min(1).max(128).default('Custom Status'),
  appId: z.string().regex(/^\d+$/).default('383226320970055681'),
  activityType: ActivityTypeSchema.default('PLAYING'),
  details: z.string().max(128).optional(),
  state: z.string().max(128).optional(),
  largeImage: z.string().max(512).optional(),
  largeText: z.string().max(128).optional(),
  smallImage: z.string().max(512).optional(),
  smallText: z.string().max(128).optional(),
  buttons: z.array(RpcButtonSchema).max(2).optional(),
  startTimestamp: z.number().optional(),
  endTimestamp: z.number().optional()
});

export const ClearRichPresenceSchema = z.object({
  type: z.literal('clear_rich_presence')
});

export const CreateBackupSchema = z.object({
  type: z.literal('create_backup')
});

export const GetRateLimitStatusSchema = z.object({
  type: z.literal('get_ratelimit_status')
});

// Quest Schemas
export const GetQuestsSchema = z.object({
  type: z.literal('get_quests')
});

export const StartQuestSchema = z.object({
  type: z.literal('start_quest'),
  questId: z.string()
});

export const StopQuestSchema = z.object({
  type: z.literal('stop_quest'),
  questId: z.string()
});

export const ClaimQuestRewardSchema = z.object({
  type: z.literal('claim_quest_reward'),
  questId: z.string()
});

export const CreateMockQuestsSchema = z.object({
  type: z.literal('create_mock_quests')
});

export const UpdateSniperConfigSchema = z.object({
  type: z.literal('update_sniper_config'),
  config: z.object({
    nitroSniper: z.boolean().optional(),
    giveawayJoiner: z.boolean().optional(),
    blockDetection: z.boolean().optional(),
    pingDetection: z.boolean().optional(),
    whitelistUsers: z.array(z.string()).optional(),
    blacklistGuilds: z.array(z.string()).optional()
  })
});

export const EnableAutobumpSchema = z.object({
  type: z.literal('enable_autobump'),
  guildId: z.string(),
  channelId: z.string(),
  interval: z.number().optional()
});

export const DisableAutobumpSchema = z.object({
  type: z.literal('disable_autobump'),
  guildId: z.string()
});

export const GetAutobumpStatusSchema = z.object({
  type: z.literal('get_autobump_status'),
  guildId: z.string()
});

export const AutobumpStatusSchema = z.object({
  type: z.literal('autobump_status'),
  guildId: z.string(),
  enabled: z.boolean().optional(),
  status: z.any().optional()
});

export const SaveBotTokenSchema = z.object({
  type: z.literal('save_bot_token'),
  appToken: z.string().min(10)
});

export const BotTokenSavedSchema = z.object({
  type: z.literal('bot_token_saved'),
  success: z.boolean(),
  message: z.string()
});

// ============================================================================
// MESSAGE SCHEMAS (Core -> Client)
// ============================================================================

export const DiscordReadySchema = z.object({
  type: z.literal('discord_ready'),
  user: DiscordUserInfoSchema
});

export const StatusSchema = z.object({
  type: z.literal('status'),
  message: z.string()
});

export const ToastSchema = z.object({
  type: z.literal('toast'),
  title: z.string(),
  content: z.string().optional()
});

export const NotificationSchema = z.object({
  type: z.literal('notification'),
  action: NotificationActionSchema,
  title: z.string().optional(),
  content: z.string()
});

export const ErrorSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
  code: z.string().optional()
});

export const BackupSuccessSchema = z.object({
  type: z.literal('backup_success'),
  action: z.literal('backup_success'),
  title: z.string(),
  content: z.string()
});

// Quest Response Schemas
export const QuestsUpdateSchema = z.object({
  type: z.literal('quests_update'),
  quests: z.array(z.any())
});

export const QuestProgressSchema = z.object({
  type: z.literal('quest_progress'),
  questId: z.string(),
  current: z.number(),
  target: z.number(),
  percent: z.number()
});

export const QuestStatusSchema = z.object({
  type: z.literal('quest_status'),
  questId: z.string(),
  status: z.enum(['running', 'stopped', 'completed', 'claimed'])
});

export const CoreLogSchema = z.object({
  type: z.literal('core_log'),
  level: z.enum(['info', 'error', 'warn', 'debug']),
  module: z.string(),
  message: z.string(),
  logTimestamp: z.string()
});

// ============================================================================
// UNION SCHEMA - All Messages
// ============================================================================

export const WsMessageSchema = z.discriminatedUnion('type', [
  // Client -> Core
  InitMessageSchema,
  SetStealthModeSchema,
  SetSilentTypingSchema,
  StartAnimationSchema,
  StopAnimationSchema,
  StartRpcAnimationSchema,
  StopRpcAnimationSchema,
  SetRichPresenceSchema,
  ClearRichPresenceSchema,
  CreateBackupSchema,
  GetRateLimitStatusSchema,
  GetQuestsSchema,
  StartQuestSchema,
  StopQuestSchema,
  ClaimQuestRewardSchema,
  CreateMockQuestsSchema,
  UpdateSniperConfigSchema,
  EnableAutobumpSchema,
  DisableAutobumpSchema,
  GetAutobumpStatusSchema,
  AutobumpStatusSchema,
  SaveBotTokenSchema,
  // Core -> Client
  DiscordReadySchema,
  StatusSchema,
  ToastSchema,
  NotificationSchema,
  ErrorSchema,
  BackupSuccessSchema,
  QuestsUpdateSchema,
  QuestProgressSchema,
  QuestStatusSchema,
  CoreLogSchema,
  BotTokenSavedSchema
]);

// Type inféré du schéma
export type ValidatedWsMessage = z.infer<typeof WsMessageSchema>;

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

export function validateWsMessage(data: unknown): { success: true; data: ValidatedWsMessage } | { success: false; error: string } {
  const result = WsMessageSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
}
