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
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  Interaction
} from 'discord.js';
import { EventEmitter } from 'events';
import { logger } from '../services/Logger';
import { DatabaseService } from '../services/DatabaseService';
import { SpyService } from '../services/SpyService';
import { TrollService } from '../services/TrollService';
import { CommandManager } from '../commands';
import { asciiMap, smallCaps, fullwidth, emojiMap, responses, roasts, compliments, jokes, steps } from '../shared/constants';
import { WebSocketService } from '../services/WebSocketService';
import { rateLimiter } from '../services/RateLimiter';
import { parseRateLimitHeaders, isRateLimitError, getRetryAfterFromError } from '../utils/rateLimitHeaders';

export interface DiscordConfig {
  userToken: string;
  appToken?: string;
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
  private selfbot: DiscordUserClient | null = null;
  private appBot: BotClient | null = null;
  private config: DiscordConfig | null = null;
  private wsService: WebSocketService;
  private dbService: DatabaseService;
  private spyService: SpyService;
  private trollService: TrollService;
  private commandManager: CommandManager;

  // Caches
  private snipeCache = new Map<string, { content: string; author: string; timestamp: number }>();
  private editsnipeCache = new Map<string, { oldContent: string; author: string; timestamp: number }>();
  private globalAfkMessage: string | null = null;

  constructor(
    wsService: WebSocketService,
    dbService: DatabaseService,
    spyService: SpyService,
    trollService: TrollService
  ) {
    super();
    this.wsService = wsService;
    this.dbService = dbService;
    this.spyService = spyService;
    this.trollService = trollService;
    this.commandManager = new CommandManager();

    // Configure le TrollService avec les handlers rate-limités
    this.setupTrollServiceHandlers();
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
    return [
      new SlashCommandBuilder()
        .setName('help').setDescription('Affiche la liste des commandes')
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('ping').setDescription('Affiche la latence')
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('clear').setDescription('Supprime vos messages')
        .addIntegerOption(o => o.setName('count').setDescription('Nombre').setRequired(false))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('snipe').setDescription('Message supprimé récent')
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('editsnipe').setDescription('Message édité récent')
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('afk').setDescription('Mode AFK')
        .addStringOption(o => o.setName('message').setDescription('Raison').setRequired(false))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('ghostping').setDescription('Mention furtive')
        .addUserOption(o => o.setName('cible').setDescription('Victime').setRequired(true))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('spy').setDescription('Surveillance')
        .addUserOption(o => o.setName('cible').setDescription('Personne').setRequired(true))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('kick').setDescription('Expulse un membre')
        .addUserOption(o => o.setName('cible').setDescription('Cible').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false))
        .setIntegrationTypes([0, 1]).setContexts([0]),
      new SlashCommandBuilder()
        .setName('ban').setDescription('Bannit un membre')
        .addUserOption(o => o.setName('cible').setDescription('Cible').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false))
        .setIntegrationTypes([0, 1]).setContexts([0]),
      new SlashCommandBuilder()
        .setName('hackban').setDescription('Bannit par ID')
        .addStringOption(o => o.setName('id').setDescription('ID').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false))
        .setIntegrationTypes([0, 1]).setContexts([0]),
      new SlashCommandBuilder()
        .setName('unban').setDescription('Débannit par ID')
        .addStringOption(o => o.setName('id').setDescription('ID').setRequired(true))
        .setIntegrationTypes([0, 1]).setContexts([0]),
      new SlashCommandBuilder()
        .setName('slowmode').setDescription('Mode lent')
        .addIntegerOption(o => o.setName('secondes').setDescription('Secondes').setRequired(true))
        .setIntegrationTypes([0, 1]).setContexts([0]),
      new SlashCommandBuilder()
        .setName('lock').setDescription('Verrouille le salon')
        .setIntegrationTypes([0, 1]).setContexts([0]),
      new SlashCommandBuilder()
        .setName('unlock').setDescription('Déverrouille le salon')
        .setIntegrationTypes([0, 1]).setContexts([0]),
      new SlashCommandBuilder()
        .setName('nuke').setDescription('Clone et supprime le salon')
        .setIntegrationTypes([0]).setContexts([0]),
      new SlashCommandBuilder()
        .setName('userinfo').setDescription('Infos utilisateur')
        .addUserOption(o => o.setName('cible').setDescription('Cible').setRequired(true))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('avatar').setDescription('Avatar utilisateur')
        .addUserOption(o => o.setName('cible').setDescription('Cible').setRequired(true))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('typing').setDescription('Indicateur d\'écriture perpétuel')
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('mimic').setDescription('Imite quelqu\'un avec webhook')
        .addUserOption(o => o.setName('cible').setDescription('Utilisateur à imiter').setRequired(true))
        .addStringOption(o => o.setName('message').setDescription('Message à envoyer').setRequired(true))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('tts').setDescription('Envoie un message TTS')
        .addStringOption(o => o.setName('message').setDescription('Message').setRequired(true))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('mock').setDescription('MoCkInG sPoNgEbOb TeXt')
        .addStringOption(o => o.setName('texte').setDescription('Texte à convertir').setRequired(true))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('ascii').setDescription('Convertit en ASCII art')
        .addStringOption(o => o.setName('texte').setDescription('Texte (max 10 caractères)').setRequired(true))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('serverinfo').setDescription('Infos du serveur')
        .addStringOption(o => o.setName('guild_id').setDescription('ID du Serv. cible (Requis en DM)').setRequired(false))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('autobump').setDescription('Active le bump automatique')
        .addIntegerOption(o => o.setName('interval').setDescription('Interval en minutes (défaut: 120)').setRequired(false))
        .addIntegerOption(o => o.setName('offset').setDescription('Décalage initial en min (défaut: 0)').setRequired(false))
        .addStringOption(o => o.setName('guild_id').setDescription('ID du Serv. cible (Requis en DM)').setRequired(false))
        .addStringOption(o => o.setName('channel_id').setDescription('ID du Salon cible (Requis en DM)').setRequired(false))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('stopbump').setDescription('Désactive le bump automatique')
        .addStringOption(o => o.setName('guild_id').setDescription('ID du Serv. cible (Requis en DM)').setRequired(false))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('bumpstatus').setDescription('Statut du bump automatique')
        .addStringOption(o => o.setName('guild_id').setDescription('ID du Serv. cible (Requis en DM)').setRequired(false))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),

      // Commandes Fun
      new SlashCommandBuilder()
        .setName('roll').setDescription('Lance un dé (1-100 par défaut)')
        .addStringOption(o => o.setName('dice').setDescription('Format: 6, 2d6, 20...').setRequired(false))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('coinflip').setDescription('Pile ou Face')
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('8ball').setDescription('Pose une question à la boule magique')
        .addStringOption(o => o.setName('question').setDescription('Ta question').setRequired(true))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('choose').setDescription('Choisit aléatoirement entre plusieurs options')
        .addStringOption(o => o.setName('options').setDescription('Options séparées par |').setRequired(true))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('love').setDescription('Calculateur d\'amour')
        .addUserOption(o => o.setName('cible').setDescription('Personne à tester').setRequired(true))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('roast').setDescription('Envoie une pique humoristique')
        .addUserOption(o => o.setName('cible').setDescription('Victime').setRequired(false))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('compliment').setDescription('Envoie un compliment')
        .addUserOption(o => o.setName('cible').setDescription('Personne à complimenter').setRequired(false))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('joke').setDescription('Raconte une blague')
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('rate').setDescription('Note quelque chose sur 10')
        .addStringOption(o => o.setName('chose').setDescription('Chose à noter').setRequired(true))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('nighty').setDescription('Convertit en small caps (ɴɪɢʜᴛʏ)')
        .addStringOption(o => o.setName('texte').setDescription('Texte à convertir').setRequired(true))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('vaporwave').setDescription('Convertit en fullwidth (ｖａｐｏｒｗａｖｅ)')
        .addStringOption(o => o.setName('texte').setDescription('Texte à convertir').setRequired(true))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('emojify').setDescription('Convertit en emojis (🇭🇪🇱🇱🇴)')
        .addStringOption(o => o.setName('texte').setDescription('Texte à convertir').setRequired(true))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('clap').setDescription('Ajoute des 👏 entre les mots')
        .addStringOption(o => o.setName('texte').setDescription('Texte').setRequired(true))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('ship').setDescription('Ship deux personnes')
        .addUserOption(o => o.setName('user1').setDescription('Première personne').setRequired(true))
        .addUserOption(o => o.setName('user2').setDescription('Deuxième personne').setRequired(true))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),

      // Commandes Utilitaires
      new SlashCommandBuilder()
        .setName('calc').setDescription('Calculatrice')
        .addStringOption(o => o.setName('expression').setDescription('Ex: 2 + 2').setRequired(true))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('poll').setDescription('Crée un sondage')
        .addStringOption(o => o.setName('question').setDescription('Question').setRequired(true))
        .addStringOption(o => o.setName('option1').setDescription('Option 1').setRequired(true))
        .addStringOption(o => o.setName('option2').setDescription('Option 2').setRequired(true))
        .addStringOption(o => o.setName('option3').setDescription('Option 3').setRequired(false))
        .addStringOption(o => o.setName('option4').setDescription('Option 4').setRequired(false))
        .setIntegrationTypes([0]).setContexts([0]),
      new SlashCommandBuilder()
        .setName('password').setDescription('Génère un mot de passe sécurisé')
        .addIntegerOption(o => o.setName('longueur').setDescription('Longueur (défaut: 16)').setRequired(false))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('color').setDescription('Génère ou affiche une couleur')
        .addStringOption(o => o.setName('hex').setDescription('Code hex (optionnel)').setRequired(false))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),

      // Commandes Troll
      new SlashCommandBuilder()
        .setName('fuckyou').setDescription('Animation middle finger troll')
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('fakevirus').setDescription('Animation fake trojan download')
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('annoy').setDescription('Spam mention silencieux (troll)')
        .addUserOption(o => o.setName('cible').setDescription('Victime').setRequired(true))
        .addIntegerOption(o => o.setName('nombre').setDescription('Nombre de mentions (1-5, défaut: 3)').setRequired(false))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('deletesend').setDescription('Active/désactive la suppression auto des messages d\'un utilisateur')
        .addUserOption(o => o.setName('cible').setDescription('Utilisateur cible').setRequired(true))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('hack').setDescription('Simulation de hack (fake)')
        .addUserOption(o => o.setName('cible').setDescription('Victime').setRequired(true))
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new SlashCommandBuilder()
        .setName('disconnect').setDescription('Fait semblant de se déconnecter')
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),

      // Context Menus
      new ContextMenuCommandBuilder()
        .setName('Ghostping').setType(ApplicationCommandType.User)
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
      new ContextMenuCommandBuilder()
        .setName('Spy User').setType(ApplicationCommandType.User)
        .setIntegrationTypes([0, 1]).setContexts([0, 1, 2]),
    ];
  }

  /**
   * Répond de manière stealth (invisible)
   * Envoie le message dans le canal et supprime la trace de la commande
   */
  private async stealthReply(interaction: any, content: string, options: any = {}): Promise<any> {
    // 1. On acquitte immédiatement l'interaction de façon éphémère et "silencieuse"
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '⌛', ephemeral: true });
      }
    } catch (e) { }

    try {
      // 2. On récupère le vrai salon via l'instance de votre VRAI COMPTE (selfbot)
      if (this.selfbot && interaction.channelId) {
        const channel = await this.selfbot.channels.fetch(interaction.channelId);
        if (channel && channel.isText()) {
          // 3. Vous envoyez le message comme si vous l'aviez tapé vous-même
          // Support for threads in case they exist:
          let sentMsg;
          if (channel.isThread()) {
            // For threads, standard sending is usually supported on selfbot if we pass threadId
            // or send directly to the thread channel if Discord allows it.
            sentMsg = await (channel as any).send({ content, ...options });
          } else {
            sentMsg = await (channel as any).send({ content, ...options });
          }

          // 4. On supprime l'interaction temporaire ⌛ (invisible pour les autres de toute façon)
          await interaction.deleteReply().catch(() => { });
          return sentMsg;
        }
      }
    } catch (err: any) {
      console.error("Erreur d'envoi stealth via le selfbot:", err);
      try {
        require('fs').appendFileSync('stealth_error.txt', err.stack + '\n\n');
      } catch (e) { }
    }

    // Fallback ultime (si votre compte n'a pas pu envoyer le msg) : le bot répond, 
    // l'utilisateur de l'app verra 'used app' mais aura au moins l'info au lieu d'un crashe silencieux.
    try {
      const msg = await interaction.editReply({ content, ...options }).catch(() => { });
      return msg;
    } catch (e) { }

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

    // Gérer les Context Menus (clic droit sur utilisateur)
    if (interaction.isUserContextMenuCommand()) {
      await this.handleUserContextMenu(interaction);
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    logger.info('DiscordManager', `Slash Command: /${commandName}`);

    try {
      switch (commandName) {
        case 'ping': {
          const start = Date.now();
          await interaction.reply({ content: '🏓 Pong!', ephemeral: true });
          const latency = Date.now() - start;
          await interaction.editReply({ content: `🏓 Pong! \`${latency}ms\`` });
          break;
        }

        case 'help': {
          const helpText = `
**Eclipse - Commandes Slash**

🔹 **Basiques**
/ping - Latence du bot
/help - Affiche cette aide
/clear [nombre] - Supprime vos messages
/snipe - Dernier message supprimé
/editsnipe - Dernier message édité
/afk [message] - Mode AFK

🔹 **Modération**
/kick @user [raison] - Expulser un membre
/ban @user [raison] - Bannir un membre
/spy @user - Surveiller un utilisateur

🔹 **Fun**
/ghostping @user - Mention furtive
/annoy @user [nombre] - Spam mention silencieux
/hack @user - Simulation de hack
/disconnect - Fausse déconnexion
/typing - Indicateur d'écriture
/mimic @user <message> - Imiter quelqu'un
/tts <message> - Message TTS

🔹 **Utilitaires**
/userinfo @user - Infos utilisateur
/avatar @user - Avatar utilisateur
/serverinfo - Infos du serveur
/calc <expression> - Calculatrice
/password [longueur] - Génère un mot de passe

🔹 **Troll Settings**
/deletesend @user - Active/désactive la suppression auto des messages
          `.trim();
          await interaction.reply({ content: helpText, ephemeral: true });
          break;
        }

        case 'clear': {
          const count = interaction.options.getInteger('count') || 10;
          await interaction.reply({ content: `🔄 Suppression de ${count} messages...`, ephemeral: true });

          const channel = interaction.channel;
          if (channel?.isTextBased()) {
            const messages = await channel.messages.fetch({ limit: 100 });
            const myMessages = messages.filter(m => m.author.id === this.selfbot?.user?.id).first(count);

            for (const m of myMessages) {
              await m.delete().catch(() => { });
              await new Promise(r => setTimeout(r, 600));
            }
            await interaction.editReply({ content: `✅ ${myMessages.length} messages supprimés.` });
          }
          break;
        }

        case 'snipe': {
          const snipe = this.snipeCache.get(interaction.channelId);
          if (!snipe) {
            await interaction.reply({ content: '❌ Aucun message à snipe.', ephemeral: true });
            return;
          }
          const embed = new EmbedBuilder()
            .setTitle('🎯 Message supprimé')
            .setDescription(snipe.content)
            .setFooter({ text: `Par ${snipe.author}` })
            .setTimestamp(snipe.timestamp)
            .setColor(0x5865F2);
          await interaction.reply({ embeds: [embed], ephemeral: true });
          break;
        }

        case 'editsnipe': {
          const editSnipe = this.editsnipeCache.get(interaction.channelId);
          if (!editSnipe) {
            await interaction.reply({ content: '❌ Aucun message à editsnipe.', ephemeral: true });
            return;
          }
          const embed = new EmbedBuilder()
            .setTitle('✏️ Message édité')
            .setDescription(editSnipe.oldContent)
            .setFooter({ text: `Par ${editSnipe.author}` })
            .setTimestamp(editSnipe.timestamp)
            .setColor(0x57F287);
          await interaction.reply({ embeds: [embed], ephemeral: true });
          break;
        }

        case 'afk': {
          const message = interaction.options.getString('message') || 'Je suis AFK';
          this.globalAfkMessage = message;
          await interaction.reply({ content: `💤 Mode AFK activé: "${message}"`, ephemeral: true });
          break;
        }

        case 'ghostping': {
          const target = interaction.options.getUser('cible');
          if (!target) {
            await interaction.reply({ content: '❌ Cible invalide.', ephemeral: true });
            return;
          }
          const channel = interaction.channel;
          if (!channel || !('send' in channel)) {
            await interaction.reply({ content: '❌ Canal invalide.', ephemeral: true });
            return;
          }
          const ghostMsg = await (channel as any).send(`${target}`);
          if (ghostMsg) {
            await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
            await ghostMsg.delete();
            await interaction.reply({ content: `👻 Ghostping envoyé à ${target.tag}`, ephemeral: true });
          }
          break;
        }

        case 'userinfo': {
          const target = interaction.options.getUser('cible') || interaction.user;
          const member = interaction.guild?.members.cache.get(target.id);

          const embed = new EmbedBuilder()
            .setTitle(`👤 ${target.tag}`)
            .setThumbnail(target.displayAvatarURL())
            .addFields(
              { name: 'ID', value: target.id, inline: true },
              { name: 'Créé le', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true },
              { name: 'Bot', value: target.bot ? 'Oui' : 'Non', inline: true }
            )
            .setColor(0x5865F2);

          if (member) {
            embed.addFields(
              { name: 'Rejoint le', value: `<t:${Math.floor((member.joinedTimestamp || 0) / 1000)}:R>`, inline: true },
              { name: 'Rôles', value: `${member.roles.cache.size - 1} rôles`, inline: true }
            );
          }

          await interaction.reply({ embeds: [embed], ephemeral: true });
          break;
        }

        case 'avatar': {
          const target = interaction.options.getUser('cible') || interaction.user;
          const embed = new EmbedBuilder()
            .setTitle(`🖼️ Avatar de ${target.tag}`)
            .setImage(target.displayAvatarURL({ size: 4096 }))
            .setColor(0x5865F2);
          await interaction.reply({ embeds: [embed], ephemeral: true });
          break;
        }

        case 'typing': {
          await interaction.reply({ content: '⌨️ Indicateur d\'écriture activé pendant 60s...', ephemeral: true });
          const channel = interaction.channel;
          if (channel?.isTextBased()) {
            const interval = setInterval(() => {
              (channel as any).sendTyping().catch(() => { });
            }, 8000);
            setTimeout(() => clearInterval(interval), 60000);
          }
          break;
        }

        case 'mimic': {
          const target = interaction.options.getUser('cible');
          const mimicText = interaction.options.getString('message');
          if (!target || !mimicText) {
            await interaction.reply({ content: '❌ Arguments manquants.', ephemeral: true });
            return;
          }

          try {
            const channel = interaction.channel;
            if (channel?.isTextBased()) {
              let targetChannel: any = channel;
              let threadId: string | undefined = undefined;

              if (channel.isThread()) {
                targetChannel = channel.parent;
                threadId = channel.id;
              }

              const webhook = await targetChannel.createWebhook(target.username, {
                avatar: target.displayAvatarURL()
              });
              await webhook.send({ content: mimicText, threadId });
              await webhook.delete();
              await interaction.reply({ content: `✅ Message envoyé en tant que ${target.tag}`, ephemeral: true });
            }
          } catch (e) {
            await interaction.reply({ content: '❌ Impossible de créer le webhook.', ephemeral: true });
          }
          break;
        }

        case 'tts': {
          const ttsText = interaction.options.getString('message');
          if (!ttsText) {
            await interaction.reply({ content: '❌ Message requis.', ephemeral: true });
            return;
          }
          const ttsChannel = interaction.channel;
          if (ttsChannel && 'send' in ttsChannel) {
            await ttsChannel.send({ content: ttsText, tts: true });
            await interaction.reply({ content: '🔊 Message TTS envoyé!', ephemeral: true });
          } else {
            await interaction.reply({ content: '❌ Canal invalide.', ephemeral: true });
          }
          break;
        }

        case 'mock': {
          const text = interaction.options.getString('texte');
          if (!text) {
            await interaction.reply({ content: '❌ Texte requis.', ephemeral: true });
            return;
          }
          let mocked = '';
          for (let i = 0; i < text.length; i++) {
            mocked += i % 2 === 0 ? text[i].toLowerCase() : text[i].toUpperCase();
          }
          await this.stealthReply(interaction, mocked);
          break;
        }

        case 'ascii': {
          const text = interaction.options.getString('texte')?.toUpperCase();
          if (!text || text.length > 10) {
            await interaction.reply({ content: '❌ Texte requis (max 10 caractères).', ephemeral: true });
            return;
          }

          let result = '';
          for (const char of text) {
            if (asciiMap[char]) result += asciiMap[char] + '\n\n';
          }

          if (result.length > 1900) {
            await interaction.reply({ content: '❌ Résultat trop long.', ephemeral: true });
            return;
          }

          await this.stealthReply(interaction, '```\n' + result + '\n```');
          break;
        }

        case 'avatar': {
          const target = interaction.options.getUser('cible') || interaction.user;
          const embed = new EmbedBuilder()
            .setTitle(`🖼️ Avatar de ${target.tag}`)
            .setImage(target.displayAvatarURL({ size: 4096 }))
            .setColor(0x5865F2);
          await interaction.reply({ embeds: [embed], ephemeral: true });
          break;
        }

        case 'userinfo': {
          const target = interaction.options.getUser('cible') || interaction.user;
          const member = interaction.guild?.members.cache.get(target.id);

          const embed = new EmbedBuilder()
            .setTitle(`👤 ${target.tag}`)
            .setThumbnail(target.displayAvatarURL())
            .addFields(
              { name: 'ID', value: target.id, inline: true },
              { name: 'Créé le', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true },
              { name: 'Bot', value: target.bot ? 'Oui' : 'Non', inline: true }
            )
            .setColor(0x5865F2);

          if (member) {
            embed.addFields(
              { name: 'Rejoint le', value: `<t:${Math.floor((member.joinedTimestamp || 0) / 1000)}:R>`, inline: true },
              { name: 'Rôles', value: `${member.roles.cache.size - 1} rôles`, inline: true }
            );
          }

          await interaction.reply({ embeds: [embed], ephemeral: true });
          break;
        }

        case 'serverinfo': {
          const targetGuildId = interaction.options.getString('guild_id') || interaction.guildId;
          if (!targetGuildId) {
            await interaction.reply({ content: '❌ ID du serveur (guild_id) requis en DM.', ephemeral: true });
            return;
          }

          const guild = interaction.client.guilds.cache.get(targetGuildId);
          if (!guild) {
            await interaction.reply({ content: '❌ Serveur introuvable dans le cache.', ephemeral: true });
            return;
          }

          const embed = new EmbedBuilder()
            .setTitle(`🏰 ${guild.name}`)
            .setThumbnail(guild.iconURL())
            .addFields(
              { name: 'ID', value: guild.id, inline: true },
              { name: 'Membres', value: `${guild.memberCount}`, inline: true },
              { name: 'Créé le', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
              { name: 'Propriétaire', value: `<@${guild.ownerId}>`, inline: true },
              { name: 'Salons', value: `${guild.channels.cache.size}`, inline: true }
            )
            .setColor(0x5865F2);

          await interaction.reply({ embeds: [embed], ephemeral: true });
          break;
        }

        case 'autobump': {
          const targetGuildId = interaction.options.getString('guild_id') || interaction.guildId;
          const targetChannelId = interaction.options.getString('channel_id') || interaction.channelId;

          if (!targetGuildId || !targetChannelId) {
            await interaction.reply({ content: '❌ ID de serveur (guild_id) et ID de salon (channel_id) requis en DM.', ephemeral: true });
            return;
          }

          let interval = interaction.options.getInteger('interval') || 120;
          let offset = interaction.options.getInteger('offset') || 0;

          // Sécurité: intervalle minimum 60 minutes
          if (interval < 60) {
            await interaction.reply({
              content: '⚠️ Intervalle minimum: 60 minutes. Utilisation de 120 minutes.',
              ephemeral: true
            });
            interval = 120;
          }

          // Limite maximum 24h
          if (interval > 1440) {
            await interaction.reply({
              content: '⚠️ Intervalle maximum: 24h (1440 minutes).',
              ephemeral: true
            });
            interval = 1440;
          }

          const result = (global as any).eclipseCore?.autoSlashService?.enableBump(
            targetGuildId,
            targetChannelId,
            interval,
            offset
          );

          if (result && !result.success) {
            await interaction.reply({
              content: `❌ Erreur: ${result.error}`,
              ephemeral: true
            });
            return;
          }

          const firstBumpTime = offset > 0 ? `dans ${offset} minutes` : `immédiatement`;
          await interaction.reply({
            content: `🔼 Bump auto activé ! Le premier bump s'effectuera ${firstBumpTime}. Ensuite, toutes les ${interval} minutes dans le salon cible.`,
            ephemeral: true
          });
          break;
        }

        case 'stopbump': {
          const targetGuildId = interaction.options.getString('guild_id') || interaction.guildId;
          if (!targetGuildId) {
            await interaction.reply({ content: '❌ ID du serveur (guild_id) requis en DM.', ephemeral: true });
            return;
          }

          (global as any).eclipseCore?.autoSlashService?.disableBump(targetGuildId);
          await interaction.reply({ content: '🔼 Bump auto désactivé sur le serveur cible.', ephemeral: true });
          break;
        }

        case 'bumpstatus': {
          const targetGuildId = interaction.options.getString('guild_id') || interaction.guildId;
          if (!targetGuildId) {
            await interaction.reply({ content: '❌ ID du serveur (guild_id) requis en DM.', ephemeral: true });
            return;
          }

          const autoSlash = (global as any).eclipseCore?.autoSlashService;
          const status = autoSlash?.getBumpStatus(targetGuildId);

          if (!status || !status.enabled) {
            await interaction.reply({ content: `🔼 Bump auto: Désactivé (pour le serveur ${targetGuildId})`, ephemeral: true });
            return;
          }

          const timeLeft = autoSlash?.getTimeUntilBump(targetGuildId);
          const formatted = autoSlash?.formatTimeRemaining(timeLeft);

          await interaction.reply({
            content: `🔼 **Bump Auto**\n✅ Activé\n📍 Salon: <#${status.channelId}>\n⏱️ Interval: ${status.interval / 60000} min\n🕐 Prochain bump: ${formatted}`,
            ephemeral: true
          });
          break;
        }

        // Commandes Fun
        case 'roll': {
          const input = interaction.options.getString('dice') || '100';
          let result: number;
          let details = '';

          if (input.includes('d')) {
            const [count, sides] = input.split('d').map(Number);
            if (count > 0 && sides > 0 && count <= 10) {
              const rolls: number[] = [];
              let total = 0;
              for (let i = 0; i < count; i++) {
                const roll = Math.floor(Math.random() * sides) + 1;
                rolls.push(roll);
                total += roll;
              }
              details = `[${rolls.join(', ')}] = `;
              result = total;
            } else {
              result = Math.floor(Math.random() * 100) + 1;
            }
          } else {
            const max = parseInt(input, 10) || 100;
            result = Math.floor(Math.random() * max) + 1;
          }

          await this.stealthReply(interaction, `🎲 ${details}**${result}**`);
          break;
        }

        case 'coinflip': {
          const result = Math.random() < 0.5 ? '🪙 Pile' : '🪙 Face';
          await this.stealthReply(interaction, result);
          break;
        }

        case '8ball': {
          const question = interaction.options.getString('question');
          const answer = responses[Math.floor(Math.random() * responses.length)];
          await this.stealthReply(interaction, `🎱 **Question:** ${question}\n**Réponse:** ${answer}`);
          break;
        }

        case 'choose': {
          const optionsText = interaction.options.getString('options');
          const options = optionsText?.split('|').map(o => o.trim()).filter(o => o) || [];

          if (options.length < 2) {
            await interaction.reply({ content: '❌ Il faut au moins 2 options séparées par |', ephemeral: true });
            return;
          }

          const choice = options[Math.floor(Math.random() * options.length)];
          await this.stealthReply(interaction, `🤔 Je choisis: **${choice}**`);
          break;
        }

        case 'love': {
          const target = interaction.options.getUser('cible');
          if (!target) {
            await interaction.reply({ content: '❌ Cible requise.', ephemeral: true });
            return;
          }

          const user1 = interaction.user;
          const user2 = target;
          const combined = user1.id.slice(-4) + user2.id.slice(-4);
          const percentage = (parseInt(combined, 10) % 100) + 1;
          const emoji = percentage > 80 ? '💕' : percentage > 50 ? '❤️' : percentage > 20 ? '💔' : '🖤';

          await this.stealthReply(interaction, `${emoji} **${user1.username}** + **${user2.username}** = **${percentage}%** d'amour!`);
          break;
        }

        case 'roast': {
          const target = interaction.options.getUser('cible');
          const roast = roasts[Math.floor(Math.random() * roasts.length)];

          if (target) {
            await this.stealthReply(interaction, `🔥 <@${target.id}>, ${roast}`);
          } else {
            await this.stealthReply(interaction, `🔥 ${roast}`);
          }
          break;
        }

        case 'compliment': {
          const target = interaction.options.getUser('cible');
          const compliment = compliments[Math.floor(Math.random() * compliments.length)];

          if (target) {
            await this.stealthReply(interaction, `💝 <@${target.id}>, ${compliment}`);
          } else {
            await this.stealthReply(interaction, `💝 ${compliment}`);
          }
          break;
        }

        case 'joke': {
          const joke = jokes[Math.floor(Math.random() * jokes.length)];
          await this.stealthReply(interaction, `😄 ${joke}`);
          break;
        }

        case 'rate': {
          const thing = interaction.options.getString('chose') || 'rien';
          const rating = Math.floor(Math.random() * 11);
          const bar = '█'.repeat(rating) + '░'.repeat(10 - rating);
          await this.stealthReply(interaction, `📊 Je note **${thing}**:\n**${rating}/10**\n${bar}`);
          break;
        }

        case 'ship': {
          const user1 = interaction.options.getUser('user1');
          const user2 = interaction.options.getUser('user2');

          if (!user1 || !user2) {
            await interaction.reply({ content: '❌ Deux utilisateurs requis.', ephemeral: true });
            return;
          }

          const name1 = user1.username.slice(0, Math.ceil(user1.username.length / 2));
          const name2 = user2.username.slice(Math.floor(user2.username.length / 2));
          const shipName = name1 + name2;

          const percentage = Math.floor(Math.random() * 100) + 1;
          const hearts = percentage > 80 ? '💕💕💕' : percentage > 60 ? '💕💕' : percentage > 40 ? '💕' : '💔';

          await this.stealthReply(interaction, `🚢 **${user1.username}** x **${user2.username}**\nNom du ship: **${shipName}**\nCompatibilité: **${percentage}%** ${hearts}`);
          break;
        }

        case 'nighty': {
          const text = interaction.options.getString('texte') || '';
          const result = text.split('').map(char => smallCaps[char] || char).join('');
          await this.stealthReply(interaction, result || '❌ Texte requis');
          break;
        }

        case 'vaporwave': {
          const text = interaction.options.getString('texte') || '';
          const result = text.split('').map(char => fullwidth[char] || char).join('');
          await this.stealthReply(interaction, result || '❌ Texte requis');
          break;
        }

        case 'emojify': {
          const text = (interaction.options.getString('texte') || '').toLowerCase();
          const result = text.split('').map(char => emojiMap[char] || char).join(' ');
          await this.stealthReply(interaction, result || '❌ Texte requis');
          break;
        }

        case 'clap': {
          const text = interaction.options.getString('texte') || '';
          const result = text.split(' ').join(' 👏 ');
          await this.stealthReply(interaction, `👏 ${result} 👏`);
          break;
        }

        // Commandes Utilitaires
        case 'calc': {
          const expression = interaction.options.getString('expression') || '';
          try {
            const sanitized = expression.replace(/[^0-9+\-*/.()\s]/g, '');
            if (sanitized !== expression.replace(/\s/g, '')) {
              await interaction.reply({ content: '❌ Caractères non autorisés. Uniquement: 0-9 + - * / ( )', ephemeral: true });
              return;
            }
            const result = new Function('return ' + sanitized)();
            await this.stealthReply(interaction, `🧮 ${expression} = **${result}**`);
          } catch {
            await interaction.reply({ content: '❌ Expression invalide', ephemeral: true });
          }
          break;
        }

        case 'poll': {
          const question = interaction.options.getString('question');
          const option1 = interaction.options.getString('option1');
          const option2 = interaction.options.getString('option2');
          const option3 = interaction.options.getString('option3');
          const option4 = interaction.options.getString('option4');

          const options = [option1, option2, option3, option4].filter(o => o) as string[];
          const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

          let pollText = `📊 **${question}**\n\n`;
          options.forEach((opt, i) => {
            pollText += `${emojis[i]} ${opt}\n`;
          });

          const pollMsg = await interaction.reply({ content: pollText, fetchReply: true });

          if (pollMsg && 'react' in pollMsg) {
            for (let i = 0; i < options.length; i++) {
              await pollMsg.react(emojis[i]).catch(() => { });
            }
          }
          break;
        }

        case 'password': {
          const length = interaction.options.getInteger('longueur') || 16;
          const maxLength = Math.min(length, 64);
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
          let password = '';
          for (let i = 0; i < maxLength; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          await interaction.reply({ content: `🔐 Mot de passe généré (${maxLength} caractères):\n||${password}||`, ephemeral: true });
          break;
        }

        case 'color': {
          const input = interaction.options.getString('hex');
          if (input) {
            const hex = input.replace('#', '');
            if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
              await interaction.reply({ content: '❌ Format hex invalide. Exemple: `FF5733`', ephemeral: true });
              return;
            }
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            await this.stealthReply(interaction, `🎨 Couleur #${hex.toUpperCase()}\nRGB: ${r}, ${g}, ${b}\nhttps://singlecolorimage.com/get/${hex}/100x100`);
          } else {
            const randomColor = Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
            const r = parseInt(randomColor.substr(0, 2), 16);
            const g = parseInt(randomColor.substr(2, 2), 16);
            const b = parseInt(randomColor.substr(4, 2), 16);
            await this.stealthReply(interaction, `🎨 Couleur aléatoire: #${randomColor.toUpperCase()}\nRGB: ${r}, ${g}, ${b}\nhttps://singlecolorimage.com/get/${randomColor}/100x100`);
          }
          break;
        }

        // Commandes Troll
        case 'fuckyou': {
          const msg = await this.stealthReply(interaction, '┌─┐');
          if (!msg) break;
          await new Promise(r => setTimeout(r, 800));
          await msg.edit('┌─┐\n┴─┴').catch(() => { });
          await new Promise(r => setTimeout(r, 800));
          await msg.edit('┌─┐\n┴─┴\nಠ_ರೃ').catch(() => { });
          await new Promise(r => setTimeout(r, 800));
          await msg.edit('╭∩╮（︶︿︶）╭∩╮').catch(() => { });
          break;
        }

        case 'fakevirus': {
          const msg = await this.stealthReply(interaction, '⚠️ **WARNING** ⚠️\nInjecting Trojan.Win32.Discord...');
          if (!msg) break;
          await new Promise(r => setTimeout(r, 1500));
          await msg.edit('⚙️ Executing exploit... [root@localhost]').catch(() => { });
          await new Promise(r => setTimeout(r, 1500));
          await msg.edit('📥 Downloading payloads... 45%').catch(() => { });
          await new Promise(r => setTimeout(r, 1500));
          await msg.edit('📥 Downloading payloads... 100%').catch(() => { });
          await new Promise(r => setTimeout(r, 1500));
          await msg.edit('✅ System compromised! IP logged.').catch(() => { });
          break;
        }

        case 'hack': {
          const target = interaction.options.getUser('cible');
          if (!target) {
            await interaction.reply({ content: '❌ Cible requise.', ephemeral: true });
            return;
          }

          const msg = await this.stealthReply(interaction, `🕵️ **HACKING ${target.username.toUpperCase()}...**`);
          if (!msg) break;

          for (const step of steps) {
            await new Promise(r => setTimeout(r, 1500));
            await msg.edit(step).catch(() => { });
          }

          await new Promise(r => setTimeout(r, 1000));
          await msg.edit(`🎉 **${target.username}** a été hacké avec succès!\n📧 Email: ${target.username.toLowerCase()}@hacked.com\n🔑 Password: ${'x'.repeat(10)}\n💰 Solde: 0.00$ (pauvre!)`).catch(() => { });
          break;
        }

        case 'disconnect': {
          await this.stealthReply(interaction, 'Déconnexion simulée...');
          break;
        }

        case 'annoy': {
          const target = interaction.options.getUser('cible');
          const count = Math.min(interaction.options.getInteger('nombre') || 3, 5); // Max 5

          if (!target) {
            await interaction.reply({ content: '❌ Cible invalide.', ephemeral: true });
            return;
          }

          const channel = interaction.channel;
          if (!channel || !('send' in channel)) {
            await interaction.reply({ content: '❌ Canal invalide.', ephemeral: true });
            return;
          }

          await interaction.reply({ content: `😈 Annoying ${target.username} x${count}...`, ephemeral: true });

          for (let i = 0; i < count; i++) {
            const msg = await (channel as any).send(`<@${target.id}> 👋`);
            setTimeout(() => msg.delete().catch(() => { }), 500);
            await new Promise(r => setTimeout(r, 800));
          }
          break;
        }

        case 'deletesend': {
          const target = interaction.options.getUser('cible');
          if (!target) {
            await interaction.reply({ content: '❌ Cible invalide.', ephemeral: true });
            return;
          }

          if (target.id === this.selfbot?.user?.id) {
            await interaction.reply({ content: '❌ Tu ne peux pas te cibler toi-même.', ephemeral: true });
            return;
          }

          const isActive = this.trollService.isDeletesendActive(target.id);

          if (isActive) {
            this.trollService.removeDeletesend(target.id);
            await interaction.reply({ content: `✅ Deletesend désactivé pour ${target.tag}.`, ephemeral: true });
          } else {
            this.trollService.addDeletesend(target.id);
            await interaction.reply({ content: `🗑️ Deletesend activé pour ${target.tag}. Ses messages seront supprimés automatiquement.`, ephemeral: true });
          }
          break;
        }

        case 'spy': {
          const target = interaction.options.getUser('cible');
          if (!target) {
            await interaction.reply({ content: '❌ Cible invalide.', ephemeral: true });
            return;
          }

          if (!interaction.guild) {
            await interaction.reply({ content: '❌ Commande serveur uniquement.', ephemeral: true });
            return;
          }

          const isSpying = this.spyService.isTargetActive(target.id, interaction.guild.id);

          if (isSpying) {
            this.spyService.removeTarget(interaction.guild.id, target.id);
            await interaction.reply({ content: `👁️ Surveillance arrêtée pour ${target.tag}.`, ephemeral: true });
          } else {
            this.spyService.addTarget(interaction.guild.id, target.id);
            await interaction.reply({ content: `👁️ Surveillance activée pour ${target.tag} dans ce serveur.`, ephemeral: true });
          }
          break;
        }

        case 'kick':
        case 'ban':
        case 'hackban':
        case 'unban':
        case 'slowmode':
        case 'lock':
        case 'unlock':
        case 'nuke': {
          await interaction.reply({
            content: `⚠️ La commande "/${commandName}" est en cours de développement.`,
            ephemeral: true
          });
          break;
        }

        default: {
          await interaction.reply({ content: '❌ Commande inconnue.', ephemeral: true });
        }
      }
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
  // CONTEXT MENU HANDLERS
  // ============================================================================

  private async handleUserContextMenu(interaction: Interaction): Promise<void> {
    if (!interaction.isUserContextMenuCommand()) return;

    const { commandName, targetUser } = interaction;
    logger.info('DiscordManager', `Context Menu: ${commandName} → ${targetUser.tag}`);

    try {
      switch (commandName) {
        case 'Ghostping': {
          const channel = interaction.channel;
          if (!channel || !('send' in channel)) {
            await interaction.reply({ content: '❌ Canal invalide.', ephemeral: true });
            return;
          }
          const ghostMsg2 = await (channel as any).send(`${targetUser}`);
          if (ghostMsg2) {
            await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
            await ghostMsg2.delete();
            await interaction.reply({ content: `👻 Ghostping envoyé à ${targetUser.tag}`, ephemeral: true });
          }
          break;
        }

        case 'Spy User': {
          if (!interaction.guild) {
            await interaction.reply({ content: '❌ Commande serveur uniquement.', ephemeral: true });
            return;
          }

          const isSpying = this.spyService.isTargetActive(targetUser.id, interaction.guild.id);
          if (isSpying) {
            this.spyService.removeTarget(interaction.guild.id, targetUser.id);
            await interaction.reply({ content: `👁️ Surveillance arrêtée pour ${targetUser.tag}.`, ephemeral: true });
          } else {
            this.spyService.addTarget(interaction.guild.id, targetUser.id);
            await interaction.reply({ content: `👁️ Surveillance activée pour ${targetUser.tag} dans ce serveur.`, ephemeral: true });
          }
          break;
        }

        default: {
          await interaction.reply({ content: '❌ Action inconnue.', ephemeral: true });
        }
      }
    } catch (err) {
      logger.error('DiscordManager', `Erreur context menu ${commandName}`, err);
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

    // Commandes texte (prefix) - uniquement pour le propriétaire
    if (this.selfbot && msg.author.id === this.selfbot.user?.id) {
      // Vérifie si c'est une commande avec prefix
      if (msg.content.startsWith(this.commandManager.prefix)) {
        this.commandManager.handleMessage(this.selfbot, msg);
        return;
      }
    }

    // Ignore les messages de soi-même pour le reste
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
    if (this.trollService.isDeletesendActive(msg.author.id) && msg.guild) {
      if (msg.author.id === this.selfbot?.user?.id) {
        // Auto-protection: retirer l'utilisateur de sa propre liste deletesend
        this.trollService.removeDeletesend(msg.author.id);
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

  private broadcastToClients(message: Record<string, unknown>): void {
    this.wsService.broadcast(message as any);
  }

  private broadcastToast(title: string, content: string): void {
    this.broadcastToClients({ type: 'toast', title, content });
  }

  private broadcastNotification(action: string, content: string, title?: string): void {
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

  getSnipeCache(): Map<string, { content: string; author: string; timestamp: number }> {
    return this.snipeCache;
  }

  getEditsnipeCache(): Map<string, { oldContent: string; author: string; timestamp: number }> {
    return this.editsnipeCache;
  }

  setAfkMessage(message: string | null): void {
    this.globalAfkMessage = message;
  }

  getAfkMessage(): string | null {
    return this.globalAfkMessage;
  }
}
