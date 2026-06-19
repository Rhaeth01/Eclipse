/**
 * Gestionnaire des clients Discord
 * Gère le selfbot (compte utilisateur) et le bot application (slash commands)
 */

import {
  DiscordUserClient,
  IMessage,
  IChannel,
  IGuildMember,
  IVoiceState,
} from '.';
import { DiscordREST } from './DiscordREST';
import {
  Client as BotClient,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  EmbedBuilder,
  Interaction
} from 'discord.js';
import { EventEmitter } from 'events';
import { logger } from '../services/Logger';
import { DatabaseService } from '../services/DatabaseService';
import { SpyService } from '../services/SpyService';
import { TrollService } from '../services/TrollService';
import { createCommandRegistry, type CommandContext, type CommandRegistry } from '../commands';
import { WebSocketService } from '../services/WebSocketService';
import { rateLimiter } from '../services/RateLimiter';
import { isRateLimitError, getRetryAfterFromError } from '../utils/rateLimitHeaders';

export interface DiscordConfig {
  userToken: string;
  appToken?: string;
}

export interface DiscordManagerContext {
  getCommandStealth: () => boolean;
}

export interface DiscordEvents {
  ready: { tag: string; id: string };
  friendAdd: { id: string; tag: string; type: number };
  friendRemove: { id: string; tag: string };
  guildCreate: { id: string; name: string };
  guildDelete: { id: string; name: string };
  roleAdd: { roleName: string; guildName: string };
  roleRemove: { roleName: string; guildName: string };
  messageDelete: {
    authorId: string;
    authorTag: string;
    content: string;
    channelId: string;
    channelName: string;
    guildId?: string;
    isMentioned: boolean;
  };
  messageUpdate: {
    authorId: string;
    authorTag: string;
    oldContent: string;
    channelId: string;
  };
  directMessage: { authorTag: string; content: string };
  keywordPing: { authorTag: string; keyword: string };
}

export class DiscordManager extends EventEmitter {
  public selfbot: DiscordUserClient | null = null;
  private appBot: BotClient | null = null;
  private config: DiscordConfig | null = null;
  private wsService: WebSocketService;
  private dbService: DatabaseService;
  private spyService: SpyService;
  private trollService: TrollService;
  private commandRegistry: CommandRegistry;
  private commandCtx: CommandContext | null = null;
  private context: DiscordManagerContext;

  // Caches — publics pour que le registre y accède via CommandContext.dm
  public snipeCache = new Map<string, { content: string; author: string; timestamp: number }>();
  public editsnipeCache = new Map<string, { oldContent: string; author: string; timestamp: number }>();
  public globalAfkMessage: string | null = null;

  constructor(
    wsService: WebSocketService,
    dbService: DatabaseService,
    spyService: SpyService,
    trollService: TrollService,
    context: DiscordManagerContext = { getCommandStealth: () => true }
  ) {
    super();
    this.wsService = wsService;
    this.dbService = dbService;
    this.spyService = spyService;
    this.trollService = trollService;
    this.context = context;
    this.commandRegistry = createCommandRegistry();

    // Configure le TrollService avec les handlers rate-limités
    this.setupTrollServiceHandlers();
  }

  /**
   * Injecte le contexte complet (services) une fois qu'EclipseCore a tout créé.
   * Requis avant que les slash commands puissent être dispatchées.
   */
  setCommandContext(ctx: CommandContext): void {
    this.commandCtx = ctx;
  }

  /** Accès au registre (pour /help, UI, introspection). */
  getCommandRegistry(): CommandRegistry {
    return this.commandRegistry;
  }

  /** Setter pour l'AFK (utilisé par /misc afk via CommandContext.dm). */
  setGlobalAfkMessage(msg: string | null): void {
    this.globalAfkMessage = msg;
  }

  // ============================================================================
  // CONNECTION
  // ============================================================================

  async connect(config: DiscordConfig): Promise<void> {
    this.config = config;

    // Détruire les anciennes instances si existantes
    await this.disconnect();

    // Initialiser le selfbot (compte utilisateur principal)
    await this.initSelfbot(config.userToken);

    // Initialiser le bot application (pour les slash commands)
    if (config.appToken) {
      logger.info('DiscordManager', '🔑 App Token fourni, connexion du App Bot...');
      await this.initAppBot(config.appToken);
    } else {
      logger.warn('DiscordManager', '⚠️ App Token non fourni - les slash commands ne seront pas disponibles');
    }
  }

  async disconnect(): Promise<void> {
    this.selfbot?.destroy();
    this.appBot?.destroy();
    this.selfbot = null;
    this.appBot = null;
    logger.info('DiscordManager', 'Déconnecté');
  }

  /**
   * Redéploie les commandes slash (utile si elles n'apparaissent pas)
   */
  async redeployCommands(): Promise<string> {
    if (!this.config?.appToken) {
      return '❌ App Token non configuré';
    }

    if (!this.appBot?.user) {
      try {
        await this.initAppBot(this.config.appToken);
        return '✅ App Bot connecté, commandes en cours d\'enregistrement...';
      } catch (err) {
        return `❌ Erreur connexion App Bot: ${err}`;
      }
    }

    try {
      await this.registerSlashCommands(this.config.appToken);
      return '✅ Commandes redéployées avec succès!';
    } catch (err) {
      return `❌ Erreur: ${err}`;
    }
  }

  async saveAndConnectBotToken(appToken: string): Promise<{ success: boolean; message: string }> {
    if (!this.config) {
      return { success: false, message: 'Discord non configuré. Veuillez vous connecter d\'abord.' };
    }

    this.config.appToken = appToken;

    if (this.appBot?.isReady()) {
      return { success: true, message: 'App Bot déjà connecté avec succès.' };
    }

    try {
      logger.info('DiscordManager', '🔑 Sauvegarde et connexion du App Bot...');
      await this.initAppBot(appToken);
      return { success: true, message: 'App Bot connecté avec succès! Slash Commands disponibles.' };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      logger.error('DiscordManager', `❌ Échec connexion App Bot: ${errorMessage}`);
      return { success: false, message: `Échec connexion App Bot: ${errorMessage}` };
    }
  }

  // ============================================================================
  // SELFBOT INITIALIZATION
  // ============================================================================

  private async initSelfbot(token: string): Promise<void> {
    this.selfbot = new DiscordUserClient({
          os: 'Windows',
          browser: 'Discord Client',
          device: 'desktop'
    });

    this.setupSelfbotEvents();

    await this.selfbot.login(token);
    logger.info('DiscordManager', 'Selfbot connecté');
  }

  private setupTrollServiceHandlers(): void {
    this.trollService.setMessageHandler({
      deleteMessage: async (msg: any) => {
        await rateLimiter.schedule(
          `channels/${msg.channel.id}/messages`,
          async () => {
            if (msg.deletable) {
              await msg.delete();
            }
          },
          8
        );
      },
      reactToMessage: async (msg: any, emoji: string) => {
        await rateLimiter.schedule(
          `channels/${msg.channel.id}/messages/reactions`,
          async () => {
            await msg.react(emoji);
          },
          3 // Priorité basse pour les réactions
        );
      },
      sendReply: async (msg: any, content: string) => {
        await rateLimiter.schedule(
          `channels/${msg.channel.id}/messages`,
          async () => {
            await msg.reply(content);
          },
          5
        );
      },
      sendTyping: async (channelId: string) => {
        if (this.commandCtx?.getSilentTyping?.()) return;
        await rateLimiter.schedule(
          `channels/${channelId}/typing`,
          async () => {
            const channel = await this.selfbot?.channels.fetch(channelId);
            if (channel?.isText()) {
              await (channel as any).sendTyping();
            }
          },
          2 // Très basse priorité pour le typing
        );
      }
    });
  }

  private setupSelfbotEvents(): void {
    if (!this.selfbot) return;

    // Ready
    this.selfbot.on('ready', async () => {
      const user = this.selfbot!.user!;
      logger.info('DiscordManager', `Selfbot prêt: ${user.tag}`);

      // Envoyer les infos utilisateur via WebSocket
      this.broadcastToClients({
        type: 'discord_ready',
        user: {
          id: user.id,
          tag: user.tag,
          avatarURL: user.displayAvatarURL(),
          guildsCount: this.selfbot!.guilds.cache.size,
          friendsCount: this.getFriendCount()
        }
      });

      this.emit('ready', { tag: user.tag, id: user.id });

      // Delay pour laisser le cache se remplir
      setTimeout(() => this.performInitialSync(), 6000);
    });

    // Relations (Amis)
    this.selfbot.on('relationshipAdd', (friend: any) => {
      const typeLib = friend.type === 3 ? "Nouvelle demande d'ami" : "Nouvel ami";
      this.broadcastToast(typeLib, `${friend.user?.tag || 'Un utilisateur'} vient de vous ajouter.`);

      if (friend.type === 1) {
        this.dbService.addFriend({
          id: friend.id || friend.user?.id,
          username: friend.user?.tag || 'Inconnu'
        });
      }
    });

    this.selfbot.on('relationshipRemove', (friend: any) => {
      this.broadcastToast('Ami supprimé', `${friend.user?.tag || 'Quelqu\'un'} a été retiré de vos amis.`);
      this.dbService.removeFriend(friend.id || friend.user?.id);
    });

    // Serveurs
    this.selfbot.on('guildCreate', (guild: any) => {
      this.dbService.addGuild({ id: guild.id, name: guild.name });
    });

    this.selfbot.on('guildDelete', (guild: any) => {
      this.broadcastToast('Serveur retiré', `Vous n'êtes plus membre du serveur "${guild.name}".`);
      this.dbService.removeGuild(guild.id);
    });

    // Rôles
    this.selfbot.on('guildMemberUpdate', (oldMember: any, newMember: any) => {
      if (newMember.user.id !== this.selfbot?.user?.id) return;

      const oldRoles = oldMember.roles.cache;
      const newRoles = newMember.roles.cache;

      newRoles.forEach((role: any) => {
        if (!oldRoles.has(role.id)) {
          this.broadcastNotification('role_add', `🛡️ Rôle Ajouté : "${role.name}" sur "${newMember.guild.name}"`, 'Rôle Ajouté 🛡️');
        }
      });

      oldRoles.forEach((role: any) => {
        if (!newRoles.has(role.id)) {
          this.broadcastNotification('role_remove', `⚠️ Rôle Retiré : "${role.name}" sur "${newMember.guild.name}"`, 'Rôle Retiré ⚠️');
        }
      });
    });

    // Messages
    this.selfbot.on('messageDelete', (msg: any) => {
      this.handleMessageDelete(msg);
    });

    this.selfbot.on('messageUpdate', (oldMsg: any, newMsg: any) => {
      this.handleMessageUpdate(oldMsg, newMsg);
    });

    this.selfbot.on('messageCreate', (msg: IMessage) => {
      this.handleMessageCreate(msg);
    });

    // Vocal
    this.selfbot.on('voiceStateUpdate', (oldState: IVoiceState, newState: IVoiceState) => {
      this.handleVoiceStateUpdate(oldState, newState);
    });
  }

  // ============================================================================
  // APP BOT INITIALIZATION (Slash Commands)
  // ============================================================================

  private async initAppBot(token: string): Promise<void> {
    this.appBot = new BotClient({
      intents: [GatewayIntentBits.Guilds]
    });

    this.appBot.on('ready', async () => {
      logger.info('DiscordManager', `✅ App Bot connecté: ${this.appBot?.user?.tag} (ID: ${this.appBot?.user?.id})`);
      logger.info('DiscordManager', '📝 Enregistrement des slash commands en cours...');
      await this.registerSlashCommands(token);
    });

    this.appBot.on('interactionCreate', (interaction) => {
      this.handleInteraction(interaction);
    });

    await this.appBot.login(token);
  }

  private async registerSlashCommands(token: string): Promise<void> {
    if (!this.appBot?.user) {
      logger.error('DiscordManager', 'App Bot not ready, cannot register commands');
      return;
    }

    const commands = this.buildSlashCommands().map(c => c.toJSON());
    logger.info('DiscordManager', `Registering ${commands.length} slash commands...`);

    const appId = this.appBot.user?.id;
    if (!appId) {
      logger.error('DiscordManager', 'App Bot user ID not available');
      return;
    }

    // Log des commandes pour debug
    logger.debug('DiscordManager', `Commandes à enregistrer: ${commands.map((c: any) => c.name).join(', ')}`);

    try {
      const rest = new REST({ version: '10' }).setToken(token);

      // PUT est idempotent : il met à jour les commandes existantes sans les supprimer
      // Ne PAS purger avec body: [] avant — cela invalide les IDs et cause "intégration inconnue"
      // pendant la propagation (jusqu'à 1h pour les commandes globales)
      logger.info('DiscordManager', '📝 Enregistrement des commandes (mise à jour idempotente)...');
      const response = await rest.put(
        Routes.applicationCommands(appId),
        { body: commands }
      );

      logger.info('DiscordManager', `✅ ${commands.length} Slash Commands enregistrées avec succès`);

      // Log la réponse pour debug
      if (Array.isArray(response)) {
        logger.info('DiscordManager', `📋 Commandes enregistrées: ${response.map((c: any) => c.name).join(', ')}`);
      }
    } catch (err: any) {
      logger.error('DiscordManager', '❌ Erreur enregistrement Slash Commands');
      logger.error('DiscordManager', `Message: ${err.message}`);
      logger.error('DiscordManager', `Code: ${err.code}`);
      logger.error('DiscordManager', `Status: ${err.status}`);
      if (err.rawError) {
        logger.error('DiscordManager', `Raw Error: ${JSON.stringify(err.rawError)}`);
      }

      // Si c'est un rate limit, on le reporte
      if (isRateLimitError(err)) {
        const retryAfter = getRetryAfterFromError(err);
        rateLimiter.reportRateLimit(`applications/{id}/commands`, retryAfter || undefined);
      }
    }
  }

  private buildSlashCommands(): any[] {
    // Le registre est l'unique source de vérité — voir core/commands/
    return this.commandRegistry.build() as any[];
  }

  /**
   * Envoie un message via le selfbot (compte utilisateur) pour qu'il apparaisse
   * comme venant de l'utilisateur et non de l'App Bot. Utilise deferReply pour
   * éviter l'ACK visible "⌛", puis supprime la réponse éphémère.
   */
  public async sendAsSelfbot(interaction: any, content: string, options: any = {}): Promise<any> {
    if (!this.selfbot || !interaction.channelId) {
      throw new Error('Selfbot non connecté ou canal inconnu');
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    const channel = await this.selfbot.channels.fetch(interaction.channelId);
    if (!channel || !channel.isText()) {
      throw new Error('Canal textuel introuvable');
    }

    const sentMsg = await (channel as any).send({ content, ...options });
    await interaction.deleteReply().catch(() => { });
    return sentMsg;
  }

  /**
   * Réponse éphémère sécurisée : ne plante pas si l'interaction a déjà été
   * traitée. Utilisé pour les messages d'erreur privés.
   */
  public async safeEphemeralReply(interaction: any, content: string): Promise<void> {
    try {
      if (interaction.deferred) {
        await interaction.editReply({ content });
      } else if (!interaction.replied) {
        await interaction.reply({ content, ephemeral: true });
      }
    } catch (e) {
      logger.warn('DiscordManager', 'safeEphemeralReply échoué', e);
    }
  }

  /**
   * Répond de manière stealth (invisible)
   * Envoie le message dans le canal et supprime la trace de la commande.
   * Garde un fallback sur l'App Bot pour les commandes qui ne sont pas
   * explicitement marquées comme "toujours selfbot".
   */
  public async stealthReply(interaction: any, content: string, options: any = {}): Promise<any> {
    try {
      return await this.sendAsSelfbot(interaction, content, options);
    } catch (err: any) {
      logger.error('DiscordManager', 'stealthReply: envoi stealth via selfbot échoué', err);
    }

    // Fallback : si le mode furtif est activé, on reste éphémère.
    // Sinon, le bot répond publiquement pour que la commande reste visible.
    const ephemeral = this.context.getCommandStealth();
    try {
      if (interaction.deferred) {
        const msg = await interaction.editReply({ content, ...options }).catch(() => { });
        return msg;
      }
      if (!interaction.replied) {
        const msg = await interaction.reply({ content, ...options, ephemeral }).catch(() => { });
        return msg;
      }
    } catch (e) {
      logger.warn('DiscordManager', 'stealthReply: fallback échoué', e);
    }
    return null;
  }

  private async handleInteraction(interaction: Interaction): Promise<void> {
    // Vérifier que c'est le propriétaire
    if (this.selfbot?.user && interaction.user.id !== this.selfbot.user.id) {
      if (interaction.isRepliable()) {
        await interaction.reply({ content: '❌ Réservé au propriétaire.', ephemeral: true });
      }
      return;
    }

    // Autocompletion
    if (interaction.isAutocomplete()) {
      if (this.commandCtx) {
        await this.commandRegistry.dispatchAutocomplete(interaction as any, this.commandCtx);
      }
      return;
    }

    // Menus contextuels (user)
    if (interaction.isUserContextMenuCommand()) {
      if (!this.commandCtx) {
        await interaction.reply({ content: '❌ Contexte non initialisé.', ephemeral: true }).catch(() => { });
        return;
      }
      logger.info('DiscordManager', `Context Menu (user): ${interaction.commandName}`);
      try {
        await this.commandRegistry.dispatchUserContextMenu(interaction as any, this.commandCtx);
      } catch (err) {
        logger.error('DiscordManager', `Erreur context menu ${interaction.commandName}`, err);
      }
      return;
    }

    // Menus contextuels (message)
    if (interaction.isMessageContextMenuCommand()) {
      if (!this.commandCtx) {
        await interaction.reply({ content: '❌ Contexte non initialisé.', ephemeral: true }).catch(() => { });
        return;
      }
      logger.info('DiscordManager', `Context Menu (message): ${interaction.commandName}`);
      try {
        await this.commandRegistry.dispatchMessageContextMenu(interaction as any, this.commandCtx);
      } catch (err) {
        logger.error('DiscordManager', `Erreur context menu ${interaction.commandName}`, err);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    logger.info('DiscordManager', `Slash Command: /${commandName}`);

    if (!this.commandCtx) {
      await interaction.reply({ content: '❌ Contexte non initialisé.', ephemeral: true }).catch(() => { });
      return;
    }

    try {
      await this.commandRegistry.dispatch(interaction, this.commandCtx);
    } catch (err) {
      logger.error('DiscordManager', `Erreur commande /${commandName}`, err);
      const errorContent = { content: '❌ Une erreur est survenue.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorContent).catch(() => { });
      } else {
        await interaction.reply(errorContent).catch(() => { });
      }
    }
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  private handleMessageDelete(msg: IMessage): void {
    if (!msg.author || msg.author.bot) return;

    // Snipe cache
    if (msg.channel.id) {
      this.snipeCache.set(msg.channel.id, {
        content: msg.content || '[Contenu illisible ou embed]',
        author: msg.author.tag,
        timestamp: Date.now()
      });
    }

    // Vérifier si c'est une cible spy ou un ghostping
    const userGuilds = this.spyService.getUserGuilds(msg.author.id);
    const isSpiedHere = userGuilds && msg.guild && userGuilds.has(msg.guild.id);
    const isMentioned = msg.mentions.users.has(this.selfbot!.user!.id);

    if (isMentioned || isSpiedHere) {
      const actionType = isMentioned ? 'ghostping' : 'spy_deleted';
      const title = isMentioned ? '👻 Vrai Ghostping détecté' : '👁️ Message supprimé (Cible)';

      this.broadcastNotification(
        actionType,
        `Message de ${msg.author.tag} dans #${msg.channel.name || 'DM'}\n"${msg.content || '[Contenu illisible ou embed]'}"`,
        title
      );
    }
  }

  private handleMessageUpdate(oldMsg: IMessage, newMsg: IMessage): void {
    if (!oldMsg.author || oldMsg.author.bot || oldMsg.content === newMsg.content) return;

    if (oldMsg.channel.id) {
      this.editsnipeCache.set(oldMsg.channel.id, {
        oldContent: oldMsg.content || '[Contenu illisible]',
        author: oldMsg.author.tag,
        timestamp: Date.now()
      });
    }
  }

  private handleMessageCreate(msg: IMessage): void {
    // Ignorer les bots
    if (msg.author.bot) return;

    // Ignore les messages de soi-même
    if (!this.selfbot?.user || msg.author.id === this.selfbot.user.id) return;

    // AFK
    if (this.globalAfkMessage && msg.mentions.users.has(this.selfbot.user.id) && msg.channel.isText()) {
      setTimeout(() => {
        msg.reply(`💤 **AFK** : ${this.globalAfkMessage}`).catch(() => { });
      }, 800 + Math.random() * 1200);
    }

    // Trolls avec Rate Limiting
    // Reactroll - ne pas réagir à ses propres messages
    if (this.trollService.isReactrollActive(msg.author.id)) {
      if (msg.author.id === this.selfbot?.user?.id) {
        this.trollService.removeReactroll(msg.author.id);
        logger.warn('DiscordManager', 'Auto-protection: removes reactroll sur soi-même');
      } else {
        const emoji = this.trollService.getReactrollEmoji(msg.author.id);
        if (emoji && this.trollService['messageHandler']) {
          this.trollService['messageHandler'].reactToMessage(msg, emoji).catch(() => { });
        }
      }
    }

    // Deletesend - ne pas supprimer ses propres messages
    if (this.trollService.isDeleteSendActive(msg.author.id) && msg.guild) {
      if (msg.author.id === this.selfbot?.user?.id) {
        // Auto-protection: retirer l'utilisateur de sa propre liste deletesend
        this.trollService.removeDeleteSend(msg.author.id);
        logger.warn('DiscordManager', 'Auto-protection: removes deletesend sur soi-même');
      } else if (this.trollService['messageHandler']) {
        this.trollService['messageHandler'].deleteMessage(msg).catch(() => { });
      }
    }

    // Autoreply - ne pas répondre à ses propres messages
    if (this.trollService.isAutoreplyActive(msg.author.id) && msg.channel.isText()) {
      if (msg.author.id === this.selfbot?.user?.id) {
        this.trollService.removeAutoreply(msg.author.id);
        logger.warn('DiscordManager', 'Auto-protection: removes autoreply sur soi-même');
      } else {
        const config = this.trollService.getAutoreply(msg.author.id)!;
        if (this.trollService['messageHandler']) {
          const handler = this.trollService['messageHandler'];
          setTimeout(async () => {
            try {
              await handler.sendTyping(msg.channel.id);
              setTimeout(() => {
                handler.sendReply(msg, config.response).catch(() => { });
              }, Math.random() * 2000 + 1500);
            } catch { }
          }, Math.random() * 1000 + 500);
        }
      }
    }

    // MP
    if (msg.channel.type === 'DM') {
      this.broadcastNotification(
        'direct_message',
        `✉️ MP de ${msg.author.tag} : "${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}"`
      );
    }

    // Keyword
    const myName = this.selfbot.user.username.toLowerCase();
    if (msg.content.toLowerCase().includes(myName) && msg.channel.type !== 'DM') {
      this.broadcastNotification(
        'keyword_ping',
        `🔔 Nom mentionné ("${myName}") par ${msg.author.tag}`
      );
    }

    // Spy messages
    const spyGuilds = this.spyService.getUserGuilds(msg.author.id);
    if (spyGuilds && msg.guild && spyGuilds.has(msg.guild.id)) {
      this.broadcastNotification(
        'spy_message',
        `Message de ${msg.author.tag} dans #${msg.channel.name}\n"${msg.content || '[Contenu illisible]'}"`,
        '👁️ Nouveau message (Cible)'
      );
    }
  }

  private handleVoiceStateUpdate(oldState: IVoiceState, newState: IVoiceState): void {
    if (!newState.member || newState.member.user.bot) return;

    const spyGuilds = this.spyService.getUserGuilds(newState.member.id);
    if (!spyGuilds || !newState.guild || !spyGuilds.has(newState.guild.id)) return;

    const oldChannel = oldState.channelId;
    const newChannel = newState.channelId;

    if (!oldChannel && newChannel) {
      this.broadcastNotification(
        'spy_voice_join',
        `${newState.member.user.tag} a rejoint <#${newChannel}>`,
        '👁️ Mouvement Vocal'
      );
    } else if (oldChannel && !newChannel) {
      this.broadcastNotification(
        'spy_voice_leave',
        `${newState.member.user.tag} a quitté le vocal`,
        '👁️ Mouvement Vocal'
      );
    } else if (oldChannel && newChannel && oldChannel !== newChannel) {
      this.broadcastNotification(
        'spy_voice_move',
        `${newState.member.user.tag} s'est déplacé vers <#${newChannel}>`,
        '👁️ Mouvement Vocal'
      );
    }
  }

  // ============================================================================
  // SYNC & HELPERS
  // ============================================================================

  private async performInitialSync(): Promise<void> {
    if (!this.selfbot) return;

    try {
      const friends = this.getFriends();
      const guilds = Array.from(this.selfbot.guilds.cache.values()).map(g => ({ id: g.id, name: g.name }));

      const friendDiff = this.dbService.compareFriends(friends);
      const guildDiff = this.dbService.compareGuilds(guilds);

      // Notifier des changements offline
      for (const f of friendDiff.removed) {
        this.broadcastNotification(
          'friend_removed_offline',
          `**${f.username}** vous a retiré de ses amis pendant votre absence.`,
          '⚠️ [Tracker] Ami supprimé'
        );
      }

      for (const g of guildDiff.removed) {
        this.broadcastNotification(
          'guild_removed_offline',
          `Vous n'êtes plus sur le serveur **${g.name}** (Exclu ou Banni).`,
          '⚠️ [Tracker] Serveur quitté'
        );
      }

      // Sync DB
      this.dbService.syncCache(friends, guilds);
      logger.info('DiscordManager', 'Synchronisation initiale terminée');
    } catch (err) {
      logger.error('DiscordManager', 'Erreur sync initiale', err);
    }
  }

  private getFriendCount(): number {
    const rels = this.selfbot?.relationships as any;
    if (!rels) return 0;
    if (typeof rels.friendCache !== 'undefined') return rels.friendCache.size;
    if (rels.cache) return rels.cache.filter((r: any) => r === 1 || r.type === 1).size;
    return rels.friendCount || 0;
  }

  private getFriends(): Array<{ id: string; username: string }> {
    const rels = this.selfbot?.relationships as any;
    if (!rels) return [];

    const friends: Array<{ id: string; username: string }> = [];

    try {
      if (rels.friendCache) {
        for (const [id, f] of rels.friendCache) {
          if (!f) continue;
          friends.push({ id, username: f.user?.tag || 'Unknown' });
        }
      } else if (rels.cache) {
        for (const [id, rel] of rels.cache) {
          if (!rel) continue;
          if (rel.type === 1 || rel === 1) {
            friends.push({ id, username: rel.user?.tag || 'Unknown' });
          }
        }
      }
    } catch (err) {
      logger.warn('DiscordManager', 'Erreur getFriends', err);
    }

    return friends;
  }

  // ============================================================================
  // WEBSOCKET HELPERS
  // ============================================================================

  public broadcastToClients(message: Record<string, unknown>): void {
    this.wsService.broadcast(message as any);
  }

  public broadcastToast(title: string, content: string): void {
    this.broadcastToClients({ type: 'toast', title, content });
  }

  public broadcastNotification(action: string, content: string, title?: string): void {
    this.broadcastToClients({ type: 'notification', action, content, title });
  }

  // ============================================================================
  // RATE LIMITED ACTIONS
  // ============================================================================

  /**
   * Supprime un message avec rate limiting
   */
  async deleteMessage(messageId: string, channelId: string): Promise<void> {
    await rateLimiter.schedule(
      `channels/${channelId}/messages`,
      async () => {
        const channel = await this.selfbot?.channels.fetch(channelId);
        if (channel?.isText()) {
          const message = await channel.messages.fetch(messageId);
          if (message && !Array.isArray(message) && !(message instanceof Map)) {
            await (message as IMessage).delete();
          }
        }
      },
      8 // Priorité haute pour les suppressions
    );
  }

  /**
   * Envoie un message avec rate limiting
   */
  async sendMessage(channelId: string, content: string): Promise<IMessage | void> {
    return rateLimiter.schedule(
      `channels/${channelId}/messages`,
      async () => {
        const channel = await this.selfbot?.channels.fetch(channelId);
        if (channel?.isText()) {
          return await channel.send(content);
        }
      },
      5 // Priorité moyenne
    );
  }

  /**
   * Kick un membre avec rate limiting
   */
  async kickMember(guildId: string, userId: string, reason?: string): Promise<void> {
    await rateLimiter.schedule(
      `guilds/${guildId}/members`,
      async () => {
        const guild = this.selfbot?.guilds.cache.get(guildId);
        if (guild) {
          const member = await guild.members.fetch(userId);
          await member.kick(reason);
        }
      },
      7
    );
  }

  /**
   * Ban un membre avec rate limiting
   */
  async banMember(guildId: string, userId: string, reason?: string): Promise<void> {
    await rateLimiter.schedule(
      `guilds/${guildId}/bans`,
      async () => {
        const guild = this.selfbot?.guilds.cache.get(guildId);
        if (guild) {
          await guild.members.ban(userId, { reason });
        }
      },
      7
    );
  }

  /**
   * Unban un membre avec rate limiting
   */
  async unbanMember(guildId: string, userId: string, reason?: string): Promise<void> {
    await rateLimiter.schedule(
      `guilds/${guildId}/bans`,
      async () => {
        const guild = this.selfbot?.guilds.cache.get(guildId);
        if (guild) {
          await guild.members.unban(userId, reason);
        }
      },
      7
    );
  }

  /**
   * Crée un webhook avec rate limiting
   */
  async createWebhook(channelId: string, name: string, avatar?: string): Promise<any> {
    return rateLimiter.schedule(
      `channels/${channelId}/webhooks`,
      async () => {
        const channel = await this.selfbot?.channels.fetch(channelId);
        if (channel?.isText()) {
          return await channel.createWebhook(name, { avatar: avatar || "" });
        }
      },
      6
    );
  }

  /**
   * Supprime plusieurs messages (bulk delete avec rate limiting entre chaque)
   */
  async deleteMessages(messageIds: string[], channelId: string): Promise<void> {
    for (const messageId of messageIds) {
      try {
        await this.deleteMessage(messageId, channelId);
        // Le rate limiter gère déjà le délai, mais on ajoute une petite pause supplémentaire
        // pour éviter de spammer l'API même si on a des tokens disponibles
        await new Promise(r => setTimeout(r, 100));
      } catch (err) {
        logger.warn('DiscordManager', `Erreur suppression message ${messageId}`, err);
      }
    }
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  getSelfbot(): DiscordUserClient | null {
    return this.selfbot;
  }

  getRest(): DiscordREST | null {
    return this.selfbot?.getRest() || null;
  }
}
