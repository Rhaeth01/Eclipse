/**
 * CommandRegistry — source unique de vérité pour les commandes slash Eclipse.
 *
 * Remplace l'ancien système double (DiscordManager.buildSlashCommands() + core/commands.ts).
 * Les catégories deviennent des commandes top-level avec des sous-commandes (ou groupes
 * de sous-commandes), aligné sur la structure /help de Nighty :
 *   /fun roll, /image meme, /admin ban, /autoslash bump enable, ...
 *
 * Architecture :
 *   - SubcommandDef    : commande dans une catégorie (/fun roll)
 *   - TopLevelDef      : commande plate sans catégorie (/help, /ping)
 *   - ContextMenuDef   : menu contextuel (user ou message)
 *   - CommandContext   : sac de services + helpers passé à chaque execute()
 *
 * Le registre build() les SlashCommandBuilder pour l'enregistrement REST,
 * et dispatch() route les interactions vers le bon execute().
 */

import {
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  UserContextMenuCommandInteraction,
  MessageContextMenuCommandInteraction,
} from 'discord.js';
import type { DiscordUserClient } from '../discord';
import type { SpyService } from '../services/SpyService';
import type { TrollService } from '../services/TrollService';
import type { SniperService } from '../services/SniperService';
import type { AnimationService } from '../services/AnimationService';
import type { QuestService } from '../services/QuestService';
import type { AutoSlashService } from '../services/AutoSlashService';
import type { BackupService } from '../services/BackupService';
import type { StateService } from '../services/StateService';
import type { DatabaseService } from '../services/DatabaseService';
import { eclipseAck } from '../shared/embeds';

// ----------------------------------------------------------------------------
// Contexte — interface structurelle pour éviter une dépendance circulaire
// avec DiscordManager. DiscordManager fournit un objet satisfaisant cette
// interface au moment du dispatch.
// ----------------------------------------------------------------------------

export interface DiscordManagerLike {
  selfbot: DiscordUserClient | null;
  snipeCache: Map<string, { content: string; author: string; timestamp: number }>;
  editsnipeCache: Map<string, { oldContent: string; author: string; timestamp: number }>;
  globalAfkMessage: string | null;
  setGlobalAfkMessage(msg: string | null): void;
  stealthReply(interaction: RepliableInteraction, content: string, options?: any): Promise<any>;
  safeEphemeralReply(interaction: RepliableInteraction, content: string): Promise<void>;
  sendAsSelfbot(interaction: RepliableInteraction, content: string, options?: any): Promise<any>;
  redeployCommands(): Promise<string>;
  getSelfbot(): DiscordUserClient | null;
  getRest(): any;
  broadcastToClients(message: Record<string, unknown>): void;
  broadcastToast(title: string, content: string): void;
  broadcastNotification(action: string, content: string, title?: string): void;
  deleteMessage(messageId: string, channelId: string): Promise<void>;
  sendMessage(channelId: string, content: string): Promise<any>;
  kickMember(guildId: string, userId: string, reason?: string): Promise<void>;
  banMember(guildId: string, userId: string, reason?: string): Promise<void>;
  unbanMember(guildId: string, userId: string, reason?: string): Promise<void>;
  createWebhook(channelId: string, name: string, avatar?: string): Promise<any>;
  deleteMessages(messageIds: string[], channelId: string): Promise<void>;
}

/**
 * Type structurel minimal pour toute interaction à laquelle on peut répondre
 * (slash / user-context / message-context). Permet d'appeler stealthReply,
 * sendAsSelfbot, safeEphemeralReply depuis n'importe quel handler, y compris
 * depuis un menu contextuel.
 */
type RepliableInteraction = {
  channelId?: string;
  channel?: any;
  guild?: any;
  user?: { id: string };
  deferred?: boolean;
  replied?: boolean;
  deferReply: (options?: any) => Promise<any>;
  editReply: (options: any) => Promise<any>;
  reply: (options: any) => Promise<any>;
  deleteReply: () => Promise<void>;
  followUp: (options: any) => Promise<any>;
};

export interface CommandContext {
  dm: DiscordManagerLike;
  spyService: SpyService;
  trollService: TrollService;
  sniperService: SniperService;
  animationService: AnimationService;
  questService: QuestService;
  autoSlashService: AutoSlashService;
  backupService: BackupService;
  stateService: StateService;
  dbService: DatabaseService;
  getCommandStealth: () => boolean;
  setCommandStealth: (value: boolean) => void;
  getSilentTyping: () => boolean;
  setSilentTyping: (value: boolean) => void;
}

// ----------------------------------------------------------------------------
// Définitions de commandes
// ----------------------------------------------------------------------------

export type Contexts = number[]; // 0=guild, 1=DM, 2=group DM
export type Integrations = number[]; // 0=guild install, 1=user install

export type AutocompleteHandler = (
  interaction: AutocompleteInteraction,
  ctx: CommandContext
) => Promise<Array<{ name: string; value: string }>>;

/** Sous-commande au sein d'une catégorie : /<category> [group] <name> */
export interface SubcommandDef {
  category: string; // ex. 'fun' -> commande top-level /fun
  group?: string; // ex. 'bump' -> /autoslash bump <name>
  name: string; // ex. 'roll' -> /fun roll
  description: string;
  /** Ajoute des options à la sous-commande. */
  build?: (sub: SlashCommandSubcommandBuilder) => any;
  /** Handlers d'autocompletion par nom d'option. */
  autocomplete?: Record<string, AutocompleteHandler>;
  execute: (interaction: ChatInputCommandInteraction, ctx: CommandContext) => Promise<void>;
  contexts?: Contexts; // défaut [0,1,2]
  integrationTypes?: Integrations; // défaut [0,1]
  /** Permissions requises (setDefaultMemberPermissions). */
  permissions?: bigint;
}

/** Commande top-level plate sans catégorie : /help, /ping */
export interface TopLevelDef {
  name: string;
  description: string;
  /** Ajoute des options à la commande. */
  build?: (cmd: SlashCommandBuilder) => any;
  autocomplete?: Record<string, AutocompleteHandler>;
  execute: (interaction: ChatInputCommandInteraction, ctx: CommandContext) => Promise<void>;
  contexts?: Contexts;
  integrationTypes?: Integrations;
  permissions?: bigint;
}

/** Menu contextuel (clic droit sur user ou message) */
export interface ContextMenuDef {
  type: 'user' | 'message';
  name: string;
  execute: (
    interaction: UserContextMenuCommandInteraction | MessageContextMenuCommandInteraction,
    ctx: CommandContext
  ) => Promise<void>;
  contexts?: Contexts;
  integrationTypes?: Integrations;
}

// ----------------------------------------------------------------------------
// Registre
// ----------------------------------------------------------------------------

const DEFAULT_CONTEXTS: Contexts = [0, 1, 2];
const DEFAULT_INTEGRATIONS: Integrations = [0, 1];

export class CommandRegistry {
  /** category -> description */
  private categoryDescriptions = new Map<string, string>();
  /** category -> définitions de sous-commandes */
  private byCategory = new Map<string, SubcommandDef[]>();
  /** name -> définition top-level */
  private topLevel = new Map<string, TopLevelDef>();
  /** menus contextuels */
  private contextMenus: ContextMenuDef[] = [];

  /** Enregistre une description pour une catégorie (pour /help). */
  describeCategory(name: string, description: string): void {
    this.categoryDescriptions.set(name, description);
  }

  /** Enregistre une sous-commande dans une catégorie. */
  sub(def: SubcommandDef): void {
    const list = this.byCategory.get(def.category) ?? [];
    list.push(def);
    this.byCategory.set(def.category, list);
  }

  /** Enregistre une commande top-level plate. */
  top(def: TopLevelDef): void {
    this.topLevel.set(def.name, def);
  }

  /** Enregistre un menu contextuel. */
  menu(def: ContextMenuDef): void {
    this.contextMenus.push(def);
  }

  // --------------------------------------------------------------------------
  // Construction des builders pour l'enregistrement REST
  // --------------------------------------------------------------------------

  /**
   * Construit le tableau de builders (SlashCommandBuilder | ContextMenuCommandBuilder)
   * à passer à REST.put. Chaque catégorie devient une commande top-level avec
   * ses sous-commandes / groupes de sous-commandes.
   */
  build(): Array<SlashCommandBuilder | ContextMenuCommandBuilder> {
    const out: Array<SlashCommandBuilder | ContextMenuCommandBuilder> = [];

    // Commandes top-level plates
    for (const def of this.topLevel.values()) {
      const cmd = new SlashCommandBuilder()
        .setName(def.name)
        .setDescription(def.description)
        .setIntegrationTypes(def.integrationTypes ?? DEFAULT_INTEGRATIONS)
        .setContexts(def.contexts ?? DEFAULT_CONTEXTS);
      if (def.permissions !== undefined) cmd.setDefaultMemberPermissions(def.permissions);
      const built = def.build ? def.build(cmd) : cmd;
      out.push(built);
    }

    // Catégories -> commandes avec sous-commandes
    for (const [category, defs] of this.byCategory) {
      const cmd = new SlashCommandBuilder()
        .setName(category)
        .setDescription(this.categoryDescriptions.get(category) ?? `Commandes ${category}`)
        .setIntegrationTypes(this.categoryIntegrationTypes(defs))
        .setContexts(this.categoryContexts(defs));

      // Propage les permissions au top-level si au moins une sous-commande les définit.
      // (Discord stocke default_member_permissions au niveau de la commande, pas du subcommand.)
      const perms = defs.find(d => d.permissions !== undefined)?.permissions;
      if (perms !== undefined) cmd.setDefaultMemberPermissions(perms);

      // Grouper par sous-groupe
      const grouped = new Map<string, SubcommandDef[]>();
      const direct: SubcommandDef[] = [];
      for (const d of defs) {
        if (d.group) {
          const g = grouped.get(d.group) ?? [];
          g.push(d);
          grouped.set(d.group, g);
        } else {
          direct.push(d);
        }
      }

      // Sous-commandes directes (sans groupe)
      for (const d of direct) {
        cmd.addSubcommand(sub => {
          const s = sub.setName(d.name).setDescription(d.description);
          return d.build ? d.build(s) : s;
        });
      }

      // Groupes de sous-commandes
      for (const [groupName, groupDefs] of grouped) {
        cmd.addSubcommandGroup(grp => {
          const g = grp.setName(groupName).setDescription(`Sous-commandes ${groupName}`);
          for (const d of groupDefs) {
            g.addSubcommand(sub => {
              const s = sub.setName(d.name).setDescription(d.description);
              return d.build ? d.build(s) : s;
            });
          }
          return g;
        });
      }

      out.push(cmd);
    }

    // Menus contextuels
    for (const m of this.contextMenus) {
      const cmd = new ContextMenuCommandBuilder()
        .setName(m.name)
        .setType(m.type === 'user' ? ApplicationCommandType.User : ApplicationCommandType.Message)
        .setIntegrationTypes(m.integrationTypes ?? DEFAULT_INTEGRATIONS)
        .setContexts(m.contexts ?? DEFAULT_CONTEXTS);
      out.push(cmd);
    }

    return out;
  }

  /** Contextes d'une catégorie = intersection des contextes de ses sous-commandes (fallback défaut). */
  private categoryContexts(defs: SubcommandDef[]): Contexts {
    // On prend l'union pour que la catégorie apparaisse partout où une sous-commande est valable.
    // Discord n'autorise pas des contexts par sous-commande, uniquement par commande top-level.
    const set = new Set<number>();
    for (const d of defs) for (const c of d.contexts ?? DEFAULT_CONTEXTS) set.add(c);
    return set.size ? [...set] : DEFAULT_CONTEXTS;
  }

  private categoryIntegrationTypes(defs: SubcommandDef[]): Integrations {
    const set = new Set<number>();
    for (const d of defs) for (const i of d.integrationTypes ?? DEFAULT_INTEGRATIONS) set.add(i);
    return set.size ? [...set] : DEFAULT_INTEGRATIONS;
  }

  // --------------------------------------------------------------------------
  // Dispatch
  // --------------------------------------------------------------------------

  /** Route une interaction ChatInput vers le execute() de la commande. */
  async dispatch(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
    const { commandName } = interaction;

    // Top-level plate ?
    const top = this.topLevel.get(commandName);
    if (top) {
      await top.execute(interaction, ctx);
      return;
    }

    // Catégorie avec sous-commandes
    const defs = this.byCategory.get(commandName);
    if (!defs) {
      await interaction.reply(eclipseAck('❌ Commande inconnue.', interaction, true)).catch(() => {});
      return;
    }

    const group = interaction.options.getSubcommandGroup(false) ?? undefined;
    const sub = interaction.options.getSubcommand(false);
    if (!sub) {
      await interaction.reply(eclipseAck('❌ Sous-commande manquante.', interaction, true)).catch(() => {});
      return;
    }

    const def = defs.find(d => d.name === sub && (d.group ?? undefined) === (group ?? undefined));
    if (!def) {
      await interaction.reply(eclipseAck('❌ Sous-commande inconnue.', interaction, true)).catch(() => {});
      return;
    }

    try {
      await def.execute(interaction, ctx);
    } catch (err) {
      console.error(`[CommandRegistry] Erreur /${commandName}${group ? ' ' + group : ''} ${sub}:`, err);
      const errPayload = eclipseAck('❌ Une erreur est survenue.', interaction, true);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errPayload);
        } else {
          await interaction.reply(errPayload);
        }
      } catch {
        // L'interaction a peut-être déjà été traitée
      }
    }
  }

  /** Route une interaction Autocomplete vers le handler de l'option concernée. */
  async dispatchAutocomplete(interaction: AutocompleteInteraction, ctx: CommandContext): Promise<void> {
    const { commandName } = interaction;
    const focused = interaction.options.getFocused(true);
    const optionName = focused.name;

    let handlers: Record<string, AutocompleteHandler> | undefined;

    const top = this.topLevel.get(commandName);
    if (top) {
      handlers = top.autocomplete;
    } else {
      const defs = this.byCategory.get(commandName);
      if (defs) {
        const group = interaction.options.getSubcommandGroup(false) ?? undefined;
        const sub = interaction.options.getSubcommand(false) ?? undefined;
        const def = defs.find(d => d.name === sub && (d.group ?? undefined) === (group ?? undefined));
        if (def) handlers = def.autocomplete;
      }
    }

    if (!handlers || !handlers[optionName]) {
      await interaction.respond([]).catch(() => {});
      return;
    }

    try {
      const choices = await handlers[optionName](interaction, ctx);
      await interaction.respond(choices.slice(0, 25)).catch(() => {});
    } catch {
      await interaction.respond([]).catch(() => {});
    }
  }

  /** Route un menu contextuel utilisateur. */
  async dispatchUserContextMenu(interaction: UserContextMenuCommandInteraction, ctx: CommandContext): Promise<void> {
    const def = this.contextMenus.find(m => m.type === 'user' && m.name === interaction.commandName);
    if (!def) {
      await interaction.reply(eclipseAck('❌ Action inconnue.', interaction, true)).catch(() => {});
      return;
    }
    await def.execute(interaction, ctx);
  }

  /** Route un menu contextuel message. */
  async dispatchMessageContextMenu(interaction: MessageContextMenuCommandInteraction, ctx: CommandContext): Promise<void> {
    const def = this.contextMenus.find(m => m.type === 'message' && m.name === interaction.commandName);
    if (!def) {
      await interaction.reply(eclipseAck('❌ Action inconnue.', interaction, true)).catch(() => {});
      return;
    }
    await def.execute(interaction, ctx);
  }

  // --------------------------------------------------------------------------
  // Introspection — pour /help dynamique et l'UI
  // --------------------------------------------------------------------------

  /** Liste ordonnée des noms de catégories. */
  getCategories(): string[] {
    return [...this.byCategory.keys()];
  }

  /** Description d'une catégorie. */
  getCategoryDescription(category: string): string {
    return this.categoryDescriptions.get(category) ?? `Commandes ${category}`;
  }

  /** Sous-commandes d'une catégorie. */
  getSubcommands(category: string): SubcommandDef[] {
    return this.byCategory.get(category) ?? [];
  }

  /** Commandes top-level plates. */
  getTopLevel(): TopLevelDef[] {
    return [...this.topLevel.values()];
  }

  /** Menus contextuels. */
  getContextMenuDefs(): ContextMenuDef[] {
    return this.contextMenus;
  }

  /** Nombre total de sous-commandes + top-level (exclut les menus contextuels). */
  count(): number {
    let n = this.topLevel.size;
    for (const defs of this.byCategory.values()) n += defs.length;
    return n;
  }

  /** Nombre total incluant les menus contextuels. */
  countAll(): number {
    return this.count() + this.contextMenus.length;
  }

  /** Snapshot sérialisable pour l'UI (WS get_commands). */
  toJSON(): CommandRegistrySnapshot {
    return {
      categories: this.getCategories().map(cat => ({
        name: cat,
        description: this.getCategoryDescription(cat),
        subcommands: this.getSubcommands(cat).map(d => ({
          group: d.group,
          name: d.name,
          description: d.description,
        })),
      })),
      topLevel: this.getTopLevel().map(d => ({
        name: d.name,
        description: d.description,
      })),
      contextMenus: this.contextMenus.map(m => ({
        type: m.type,
        name: m.name,
      })),
      total: this.countAll(),
    };
  }
}

export interface CommandRegistrySnapshot {
  categories: Array<{
    name: string;
    description: string;
    subcommands: Array<{ group?: string; name: string; description: string }>;
  }>;
  topLevel: Array<{ name: string; description: string }>;
  contextMenus: Array<{ type: 'user' | 'message'; name: string }>;
  total: number;
}
