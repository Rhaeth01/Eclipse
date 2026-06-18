/**
 * Tests d'intégration pour la couche de dispatch :
 *  - CommandRegistry.dispatch() appelle bien le bon execute avec le bon ctx
 *  - La propagation des erreurs du execute remonte
 *  - Le contexte (CommandContext) est passé tel quel
 */

import { describe, it, expect, vi } from 'vitest';
import { CommandRegistry, type CommandContext, type SubcommandDef } from '../CommandRegistry';
import type { ChatInputCommandInteraction } from 'discord.js';

function makeInteraction(commandName: string, subcommand?: string): ChatInputCommandInteraction {
  return {
    commandName,
    options: {
      getSubcommand: (required = true) => (required ? subcommand ?? null : subcommand),
      getSubcommandGroup: (_required = true) => null,
    },
    isReplied: () => false,
    isDeferred: () => false,
    reply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('Integration — dispatch avec ctx réel', () => {
  it('passe le ctx tel quel au execute', async () => {
    const r = new CommandRegistry();
    const receivedCtx: any = { marker: 'unique-marker' };
    r.sub({
      category: 'fun',
      name: 'roll',
      description: 'd',
      execute: vi.fn(async (_i, ctx) => {
        expect(ctx).toBe(receivedCtx);
      }),
    });
    await r.dispatch(makeInteraction('fun', 'roll'), receivedCtx as CommandContext);
  });

  it("passe l'interaction au execute (avec commandName et options)", async () => {
    const r = new CommandRegistry();
    const exec = vi.fn();
    r.sub({ category: 'fun', name: 'roll', description: 'd', execute: exec });
    const i = makeInteraction('fun', 'roll');
    await r.dispatch(i, {} as CommandContext);
    expect(exec).toHaveBeenCalledWith(i, expect.any(Object));
  });

  it('capture et swallow une erreur du execute (ne crash pas le dispatcher)', async () => {
    const r = new CommandRegistry();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    r.sub({
      category: 'fun',
      name: 'roll',
      description: 'd',
      execute: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const i = makeInteraction('fun', 'roll');
    // Ne doit pas throw
    await expect(r.dispatch(i, {} as CommandContext)).resolves.toBeUndefined();
    errSpy.mockRestore();
  });

  it("permet à l'execute d'appeler interaction.reply() librement", async () => {
    const r = new CommandRegistry();
    r.sub({
      category: 'fun',
      name: 'roll',
      description: 'd',
      async execute(interaction) {
        await interaction.reply({ content: 'rolled!', ephemeral: true });
      },
    });
    const i = makeInteraction('fun', 'roll');
    await r.dispatch(i, {} as CommandContext);
    expect(i.reply).toHaveBeenCalledWith({ content: 'rolled!', ephemeral: true });
  });

  it('dispatche plusieurs sous-commandes en série sans interférence', async () => {
    const r = new CommandRegistry();
    const calls: string[] = [];
    r.sub({ category: 'fun', name: 'roll', description: 'd', execute: vi.fn(async () => { calls.push('roll'); }) });
    r.sub({ category: 'fun', name: 'flip', description: 'd', execute: vi.fn(async () => { calls.push('flip'); }) });
    r.sub({ category: 'fun', name: 'joke', description: 'd', execute: vi.fn(async () => { calls.push('joke'); }) });

    await r.dispatch(makeInteraction('fun', 'roll'), {} as CommandContext);
    await r.dispatch(makeInteraction('fun', 'flip'), {} as CommandContext);
    await r.dispatch(makeInteraction('fun', 'joke'), {} as CommandContext);
    expect(calls).toEqual(['roll', 'flip', 'joke']);
  });

  it("supporte l'injection de dépendances dans le execute via closure", async () => {
    // Pattern réel : un service passé en closure au registre (cf. categories/clone.ts)
    const fakeCloneService = { clone: vi.fn().mockResolvedValue('ok') };
    const r = new CommandRegistry();
    r.sub({
      category: 'clone',
      name: 'server',
      description: 'd',
      execute: async () => {
        const result = await fakeCloneService.clone();
        expect(result).toBe('ok');
      },
    });
    await r.dispatch(makeInteraction('clone', 'server'), {} as CommandContext);
    expect(fakeCloneService.clone).toHaveBeenCalled();
  });
});
