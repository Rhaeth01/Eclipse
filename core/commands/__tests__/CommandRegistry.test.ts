/**
 * Tests pour CommandRegistry — la fondation du système de commandes.
 * Couvre : build(), dispatch(), dispatchAutocomplete(), menus contextuels,
 *          toJSON(), gestion des sous-groupes, permissions, edge cases.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  CommandRegistry,
  type SubcommandDef,
  type TopLevelDef,
  type ContextMenuDef,
  type CommandContext,
} from '../CommandRegistry';
import type {
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  UserContextMenuCommandInteraction,
  MessageContextMenuCommandInteraction,
} from 'discord.js';

// ----------------------------------------------------------------------------
// Helpers — mocks minimaux des interactions Discord.js
// ----------------------------------------------------------------------------

function makeChatInput(opts: {
  commandName: string;
  subcommandGroup?: string;
  subcommand?: string;
  focused?: { name: string; value: string };
  isReplied?: boolean;
  isDeferred?: boolean;
}): ChatInputCommandInteraction {
  const interaction: any = {
    commandName: opts.commandName,
    options: {
      getSubcommandGroup: (required = true) => {
        if (opts.subcommandGroup === undefined) return required ? null : undefined;
        return opts.subcommandGroup;
      },
      getSubcommand: (required = true) => {
        if (opts.subcommand === undefined) return required ? null : undefined;
        return opts.subcommand;
      },
      getFocused: (required = true) => {
        if (!opts.focused) return required ? null : { name: 'unknown', value: '' };
        return opts.focused;
      },
    },
    isReplied: () => opts.isReplied ?? false,
    isDeferred: () => opts.isDeferred ?? false,
    reply: vi.fn().mockResolvedValue(undefined),
    respond: vi.fn().mockResolvedValue(undefined),
  };
  return interaction as ChatInputCommandInteraction;
}

function makeAutocomplete(opts: {
  commandName: string;
  subcommandGroup?: string;
  subcommand?: string;
  focused: { name: string; value: string };
}): AutocompleteInteraction {
  return {
    commandName: opts.commandName,
    options: {
      getSubcommandGroup: (required = true) => {
        if (opts.subcommandGroup === undefined) return required ? null : undefined;
        return opts.subcommandGroup;
      },
      getSubcommand: (required = true) => {
        if (opts.subcommand === undefined) return required ? null : undefined;
        return opts.subcommand;
      },
      getFocused: (_required = true) => opts.focused,
    },
    respond: vi.fn().mockResolvedValue(undefined),
  } as unknown as AutocompleteInteraction;
}

function makeUserCtxMenu(commandName: string, targetUser: any): UserContextMenuCommandInteraction {
  return {
    commandName,
    targetUser,
    isReplied: () => false,
    reply: vi.fn().mockResolvedValue(undefined),
  } as unknown as UserContextMenuCommandInteraction;
}

function makeMessageCtxMenu(commandName: string, targetMessage: any): MessageContextMenuCommandInteraction {
  return {
    commandName,
    targetMessage,
    isReplied: () => false,
    reply: vi.fn().mockResolvedValue(undefined),
  } as unknown as MessageContextMenuCommandInteraction;
}

const dummyCtx = {} as CommandContext;

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('CommandRegistry — construction & introspection', () => {
  it('démarre vide', () => {
    const r = new CommandRegistry();
    expect(r.count()).toBe(0);
    expect(r.countAll()).toBe(0);
    expect(r.getCategories()).toEqual([]);
    expect(r.getTopLevel()).toEqual([]);
    expect(r.getContextMenuDefs()).toEqual([]);
  });

  it('sub() ajoute une sous-commande et incrémente count()', () => {
    const r = new CommandRegistry();
    r.sub({ category: 'fun', name: 'roll', description: 'd', execute: vi.fn() });
    expect(r.count()).toBe(1);
    expect(r.getSubcommands('fun')).toHaveLength(1);
  });

  it('describeCategory() enregistre la description', () => {
    const r = new CommandRegistry();
    r.describeCategory('fun', 'Commandes fun');
    expect(r.getCategoryDescription('fun')).toBe('Commandes fun');
  });

  it('top() ajoute une commande top-level', () => {
    const r = new CommandRegistry();
    r.top({ name: 'ping', description: 'd', execute: vi.fn() });
    expect(r.getTopLevel()).toHaveLength(1);
    expect(r.getTopLevel()[0].name).toBe('ping');
  });

  it('menu() ajoute un menu contextuel', () => {
    const r = new CommandRegistry();
    r.menu({ type: 'user', name: 'X', execute: vi.fn() });
    expect(r.getContextMenuDefs()).toHaveLength(1);
  });
});

describe('CommandRegistry — build()', () => {
  it('produit un builder par catégorie + par top-level + par menu', () => {
    const r = new CommandRegistry();
    r.sub({ category: 'fun', name: 'roll', description: 'd', execute: vi.fn() });
    r.sub({ category: 'fun', name: 'flip', description: 'd', execute: vi.fn() });
    r.top({ name: 'ping', description: 'd', execute: vi.fn() });
    r.menu({ type: 'user', name: 'Ctx', execute: vi.fn() });
    const out = r.build();
    // 1 fun + 1 ping + 1 menu = 3 builders
    expect(out).toHaveLength(3);
  });

  it('construit un addSubcommandGroup quand group est présent', () => {
    const r = new CommandRegistry();
    r.sub({ category: 'autoslash', group: 'bump', name: 'enable', description: 'd', execute: vi.fn() });
    r.sub({ category: 'autoslash', group: 'bump', name: 'disable', description: 'd', execute: vi.fn() });
    const out = r.build();
    expect(out).toHaveLength(1);
    const json: any = out[0].toJSON();
    // Vérifie la structure de sous-groupe
    expect(json.name).toBe('autoslash');
    expect(json.options?.[0]).toMatchObject({ type: 2, name: 'bump' });
    expect(json.options?.[0].options).toHaveLength(2);
  });

  it('mélange subcommand groups et direct subcommands dans la même catégorie', () => {
    const r = new CommandRegistry();
    r.sub({ category: 'x', group: 'g1', name: 'a', description: 'd', execute: vi.fn() });
    r.sub({ category: 'x', name: 'b', description: 'd', execute: vi.fn() });
    const out = r.build();
    const json: any = out[0].toJSON();
    // 1 subcommand group + 1 subcommand direct
    expect(json.options).toHaveLength(2);
  });

  it('utilise la description de la catégorie pour le description du builder', () => {
    const r = new CommandRegistry();
    r.describeCategory('fun', 'Description custom');
    r.sub({ category: 'fun', name: 'a', description: 'd', execute: vi.fn() });
    const json: any = r.build()[0].toJSON();
    expect(json.description).toBe('Description custom');
  });

  it('fallback sur "Commandes <cat>" si pas de describeCategory', () => {
    const r = new CommandRegistry();
    r.sub({ category: 'fun', name: 'a', description: 'd', execute: vi.fn() });
    const json: any = r.build()[0].toJSON();
    expect(json.description).toMatch(/^Commandes fun$/);
  });

  it('respecte setDefaultMemberPermissions quand permissions est défini', () => {
    const r = new CommandRegistry();
    r.sub({
      category: 'admin',
      name: 'kick',
      description: 'd',
      execute: vi.fn(),
      permissions: BigInt(1) << BigInt(1), // KickMembers
    });
    const json = r.build()[0].toJSON();
    expect(json.default_member_permissions).toBe('2');
  });

  it('produit un ContextMenuCommandBuilder pour les menus', () => {
    const r = new CommandRegistry();
    r.menu({ type: 'user', name: 'Ghostping', execute: vi.fn() });
    r.menu({ type: 'message', name: 'Translate', execute: vi.fn() });
    const out = r.build();
    expect(out).toHaveLength(2);
    expect(out[0].toJSON().type).toBe(2); // ApplicationCommandType.User
    expect(out[1].toJSON().type).toBe(3); // ApplicationCommandType.Message
  });
});

describe('CommandRegistry — dispatch()', () => {
  it('route une commande top-level vers son execute()', async () => {
    const r = new CommandRegistry();
    const exec = vi.fn();
    r.top({ name: 'ping', description: 'd', execute: exec });
    const i = makeChatInput({ commandName: 'ping' });
    await r.dispatch(i, dummyCtx);
    expect(exec).toHaveBeenCalledWith(i, dummyCtx);
  });

  it('route une sous-commande vers le bon execute()', async () => {
    const r = new CommandRegistry();
    const execRoll = vi.fn();
    const execFlip = vi.fn();
    r.sub({ category: 'fun', name: 'roll', description: 'd', execute: execRoll });
    r.sub({ category: 'fun', name: 'flip', description: 'd', execute: execFlip });
    await r.dispatch(makeChatInput({ commandName: 'fun', subcommand: 'roll' }), dummyCtx);
    expect(execRoll).toHaveBeenCalledOnce();
    expect(execFlip).not.toHaveBeenCalled();
  });

  it('route une sous-commande dans un groupe', async () => {
    const r = new CommandRegistry();
    const execEnable = vi.fn();
    const execDisable = vi.fn();
    r.sub({ category: 'autoslash', group: 'bump', name: 'enable', description: 'd', execute: execEnable });
    r.sub({ category: 'autoslash', group: 'bump', name: 'disable', description: 'd', execute: execDisable });
    await r.dispatch(
      makeChatInput({ commandName: 'autoslash', subcommandGroup: 'bump', subcommand: 'enable' }),
      dummyCtx
    );
    expect(execEnable).toHaveBeenCalledOnce();
    expect(execDisable).not.toHaveBeenCalled();
  });

  it('répond "commande inconnue" pour une catégorie inexistante', async () => {
    const r = new CommandRegistry();
    const i = makeChatInput({ commandName: 'unknown' });
    await r.dispatch(i, dummyCtx);
    expect(i.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringMatching(/inconnue/i) }));
  });

  it('répond "sous-commande inconnue" si sub manquant', async () => {
    const r = new CommandRegistry();
    r.sub({ category: 'fun', name: 'roll', description: 'd', execute: vi.fn() });
    const i = makeChatInput({ commandName: 'fun' });
    await r.dispatch(i, dummyCtx);
    expect(i.reply).toHaveBeenCalled();
  });

  it('répond "sous-commande inconnue" si sub invalide', async () => {
    const r = new CommandRegistry();
    r.sub({ category: 'fun', name: 'roll', description: 'd', execute: vi.fn() });
    const i = makeChatInput({ commandName: 'fun', subcommand: 'nope' });
    await r.dispatch(i, dummyCtx);
    expect(i.reply).toHaveBeenCalled();
  });

  it('ne confonds pas une sous-commande et un sous-groupe', async () => {
    const r = new CommandRegistry();
    const execA = vi.fn();
    r.sub({ category: 'x', group: 'g', name: 'a', description: 'd', execute: execA });
    // Dispatch avec seulement sub, pas de group : ne doit pas matcher
    const i = makeChatInput({ commandName: 'x', subcommand: 'a' });
    await r.dispatch(i, dummyCtx);
    expect(execA).not.toHaveBeenCalled();
  });
});

describe('CommandRegistry — dispatchAutocomplete()', () => {
  it('route vers le handler de la bonne option', async () => {
    const r = new CommandRegistry();
    const handler = vi.fn().mockResolvedValue([{ name: 'opt1', value: 'v1' }]);
    r.sub({
      category: 'fun',
      name: 'roll',
      description: 'd',
      execute: vi.fn(),
      autocomplete: { dice: handler },
    });
    const i = makeAutocomplete({ commandName: 'fun', subcommand: 'roll', focused: { name: 'dice', value: '6' } });
    await r.dispatchAutocomplete(i, dummyCtx);
    expect(handler).toHaveBeenCalledWith(i, dummyCtx);
    expect(i.respond).toHaveBeenCalledWith([{ name: 'opt1', value: 'v1' }]);
  });

  it('répond [] si aucun handler pour l\'option', async () => {
    const r = new CommandRegistry();
    r.sub({ category: 'fun', name: 'roll', description: 'd', execute: vi.fn() });
    const i = makeAutocomplete({ commandName: 'fun', subcommand: 'roll', focused: { name: 'unknown', value: '' } });
    await r.dispatchAutocomplete(i, dummyCtx);
    expect(i.respond).toHaveBeenCalledWith([]);
  });

  it('répond [] si le handler jette une erreur', async () => {
    const r = new CommandRegistry();
    r.sub({
      category: 'fun',
      name: 'roll',
      description: 'd',
      execute: vi.fn(),
      autocomplete: { dice: vi.fn().mockRejectedValue(new Error('boom')) },
    });
    const i = makeAutocomplete({ commandName: 'fun', subcommand: 'roll', focused: { name: 'dice', value: '' } });
    await r.dispatchAutocomplete(i, dummyCtx);
    expect(i.respond).toHaveBeenCalledWith([]);
  });

  it('truncate les résultats à 25', async () => {
    const r = new CommandRegistry();
    const handler = vi.fn().mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({ name: `o${i}`, value: `v${i}` }))
    );
    r.sub({
      category: 'fun',
      name: 'roll',
      description: 'd',
      execute: vi.fn(),
      autocomplete: { dice: handler },
    });
    const i = makeAutocomplete({ commandName: 'fun', subcommand: 'roll', focused: { name: 'dice', value: '' } });
    await r.dispatchAutocomplete(i, dummyCtx);
    expect(i.respond).toHaveBeenCalledWith(expect.arrayContaining([expect.any(Object)]));
    const called = (i.respond as any).mock.calls[0][0];
    expect(called).toHaveLength(25);
  });

  it('route vers l\'autocomplete d\'une commande top-level', async () => {
    const r = new CommandRegistry();
    const handler = vi.fn().mockResolvedValue([]);
    r.top({
      name: 'help',
      description: 'd',
      execute: vi.fn(),
      autocomplete: { categorie: handler },
    });
    const i = makeAutocomplete({ commandName: 'help', focused: { name: 'categorie', value: 'fun' } });
    await r.dispatchAutocomplete(i, dummyCtx);
    expect(handler).toHaveBeenCalled();
  });
});

describe('CommandRegistry — menus contextuels', () => {
  it('dispatchUserContextMenu() route vers le bon execute()', async () => {
    const r = new CommandRegistry();
    const exec = vi.fn();
    r.menu({ type: 'user', name: 'Ghostping', execute: exec });
    const i = makeUserCtxMenu('Ghostping', { id: 'u1', tag: 'user#1' });
    await r.dispatchUserContextMenu(i, dummyCtx);
    expect(exec).toHaveBeenCalledWith(i, dummyCtx);
  });

  it('dispatchMessageContextMenu() route vers le bon execute()', async () => {
    const r = new CommandRegistry();
    const exec = vi.fn();
    r.menu({ type: 'message', name: 'Translate', execute: exec });
    const i = makeMessageCtxMenu('Translate', { id: 'm1', content: 'hello' });
    await r.dispatchMessageContextMenu(i, dummyCtx);
    expect(exec).toHaveBeenCalledWith(i, dummyCtx);
  });

  it('répond "action inconnue" si menu non trouvé', async () => {
    const r = new CommandRegistry();
    const i = makeUserCtxMenu('Ghostping', { id: 'u1', tag: 'u#1' });
    await r.dispatchUserContextMenu(i, dummyCtx);
    expect(i.reply).toHaveBeenCalled();
  });

  it('dispatchMessageContextMenu ne déclenche PAS un menu user', async () => {
    const r = new CommandRegistry();
    const userExec = vi.fn();
    r.menu({ type: 'user', name: 'Ghostping', execute: userExec });
    const i = makeMessageCtxMenu('Ghostping', { content: 'hi' });
    await r.dispatchMessageContextMenu(i, dummyCtx);
    expect(userExec).not.toHaveBeenCalled();
  });
});

describe('CommandRegistry — count() & toJSON()', () => {
  it('count() exclut les menus contextuels', () => {
    const r = new CommandRegistry();
    r.sub({ category: 'fun', name: 'roll', description: 'd', execute: vi.fn() });
    r.sub({ category: 'fun', name: 'flip', description: 'd', execute: vi.fn() });
    r.top({ name: 'ping', description: 'd', execute: vi.fn() });
    r.menu({ type: 'user', name: 'Ctx', execute: vi.fn() });
    expect(r.count()).toBe(3); // 2 fun + 1 ping
    expect(r.countAll()).toBe(4);
  });

  it('toJSON() produit un snapshot complet', () => {
    const r = new CommandRegistry();
    r.describeCategory('fun', 'Commandes fun');
    r.sub({ category: 'fun', name: 'roll', description: 'Lance un dé', execute: vi.fn() });
    r.sub({ category: 'fun', group: 'bump', name: 'a', description: 'd', execute: vi.fn() });
    r.top({ name: 'ping', description: 'd', execute: vi.fn() });
    r.menu({ type: 'user', name: 'Ghostping', execute: vi.fn() });
    const snap = r.toJSON();
    expect(snap.categories).toHaveLength(1);
    expect(snap.categories[0].name).toBe('fun');
    expect(snap.categories[0].subcommands).toHaveLength(2);
    expect(snap.topLevel).toHaveLength(1);
    expect(snap.contextMenus).toHaveLength(1);
    expect(snap.total).toBe(4);
  });

  it('toJSON() sérialise correctement le group', () => {
    const r = new CommandRegistry();
    r.sub({ category: 'x', group: 'g', name: 'a', description: 'd', execute: vi.fn() });
    const snap = r.toJSON();
    expect(snap.categories[0].subcommands[0].group).toBe('g');
    expect(snap.categories[0].subcommands[0].name).toBe('a');
  });
});
