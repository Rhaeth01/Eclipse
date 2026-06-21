import { describe, it, expect, vi } from 'vitest';
import { DiscordManager } from '../DiscordManager';

/**
 * Anti-régression P0-1 : owner-gate doit REJETER quand le selfbot est null.
 *
 * Bug précédent : `if (this.selfbot?.user && user.id !== selfbot.user.id)`
 * - Si selfbot?.user est null (selfbot déconnecté/non initialisé), la condition
 *   short-circuit à falsy → gate SKIPÉE → n'importe qui peut appeler les
 *   slash commands pendant la fenêtre de boot/déconnexion.
 *
 * Fix : `if (!this.selfbot?.user || user.id !== selfbot.user.id)` — rejette
 * quand selfbot est unset OU quand le caller n'est pas l'owner.
 */
function makeManager() {
  const wsService = { broadcast: vi.fn(), sendToClient: vi.fn() } as any;
  const dbService = {} as any;
  const spyService = {} as any;
  const trollService = { setMessageHandler: vi.fn(), stopAllTyping: vi.fn() } as any;
  return new DiscordManager(wsService, dbService, spyService, trollService);
}

function makeInteraction(userId: string, isRepliable = true) {
  return {
    user: { id: userId },
    isRepliable: () => isRepliable,
    isAutocomplete: () => false,
    isUserContextMenuCommand: () => false,
    isMessageContextMenuCommand: () => false,
    isChatInputCommand: () => true,
    reply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('Owner-gate — anti-régression sécurité P0-1', () => {
  it('REJETTE quand selfbot est null (boot/disconnect)', async () => {
    const mgr = makeManager();
    (mgr as any).selfbot = null;

    const i = makeInteraction('anyone-else');
    await (mgr as any).handleInteraction(i);

    // Doit reply avec "Réservé au propriétaire"
    expect(i.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
  });

  it('REJETTE quand selfbot.user existe mais caller ≠ owner', async () => {
    const mgr = makeManager();
    (mgr as any).selfbot = { user: { id: 'owner-1' } };
    (mgr as any).commandCtx = null;

    const i = makeInteraction('someone-else');
    await (mgr as any).handleInteraction(i);

    expect(i.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
  });

  it('LAISSÉ PASSER quand selfbot.user existe et caller === owner', async () => {
    const mgr = makeManager();
    (mgr as any).selfbot = { user: { id: 'owner-1' } };
    (mgr as any).commandCtx = null;
    const dispatchSpy = vi.fn().mockResolvedValue(undefined);
    (mgr as any).commandRegistry = { dispatch: dispatchSpy };

    const i = makeInteraction('owner-1');
    i.commandName = 'ping';
    await (mgr as any).handleInteraction(i);

    // Pas de reply "réservé au propriétaire"
    expect(i.reply).not.toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Réservé') }));
  });
});
