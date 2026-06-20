/**
 * Tests pour DiscordManager.sendAsSelfbot (et par extension stealthReply).
 *
 * Problème ciblé : un user account (selfbot) qui envoie un message via
 * l'API Discord déclenche l'anti-spam dès qu'une mention est parsée. Le
 * résultat est que channel.send throw une 403/429 et la commande crash
 * (cf. logs : "[DiscordManager] stealthReply: envoi stealth via selfbot
 * échoué"). Le fix ajoute des defaults "silent mention" (flags:4096 +
 * allowed_mentions vide) à sendAsSelfbot pour que les réponses stealth
 * passent sous le radar de l'anti-spam.
 *
 * Ces tests vérifient que les defaults sont bien appliqués ET que les
 * callers peuvent toujours surcharger explicitement via options.
 */

import { describe, it, expect, vi } from 'vitest';
import { DiscordManager } from '../DiscordManager';

function makeMockServices() {
  return {
    wsService: { broadcast: vi.fn() } as any,
    dbService: {} as any,
    spyService: {} as any,
    // Le constructor appelle setupTrollServiceHandlers qui set 3 handlers
    // (message/edit/bulkDelete). Le mock doit juste exposer les setters.
    trollService: {
      setMessageHandler: vi.fn(),
      setEditHandler: vi.fn(),
      setBulkDeleteHandler: vi.fn(),
    } as any,
  };
}

function makeManagerWithMockSelfbot() {
  const mgr = new DiscordManager(
    makeMockServices().wsService,
    makeMockServices().dbService,
    makeMockServices().spyService,
    makeMockServices().trollService,
  );
  const sendSpy = vi.fn().mockResolvedValue({ id: 'msg-1' });
  const mockChannel = { isText: () => true, send: sendSpy };
  const mockSelfbot = {
    channels: { fetch: vi.fn().mockResolvedValue(mockChannel) },
  };
  (mgr as any).selfbot = mockSelfbot;
  return { mgr, sendSpy, mockChannel, mockSelfbot };
}

function makeInteraction(overrides: any = {}) {
  return {
    channelId: 'ch-1',
    deferred: false,
    replied: false,
    deferReply: vi.fn().mockResolvedValue(undefined),
    deleteReply: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

describe('DiscordManager.sendAsSelfbot — defaults silent mention', () => {
  it('applique flags:4096 et allowed_mentions vide par défaut', async () => {
    const { mgr, sendSpy } = makeManagerWithMockSelfbot();
    const interaction = makeInteraction();

    await mgr.sendAsSelfbot(interaction, 'réponse de commande');

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(sendSpy).toHaveBeenCalledWith({
      content: 'réponse de commande',
      allowed_mentions: { parse: [], users: [], roles: [], replied_user: false },
      flags: 4096,
    });
    expect(interaction.deleteReply).toHaveBeenCalled();
  });

  it('appelle deferReply AVANT le send (anti timeout 3s Discord)', async () => {
    const { mgr, sendSpy } = makeManagerWithMockSelfbot();
    const order: string[] = [];
    (sendSpy as any).mockImplementation(async () => {
      order.push('send');
      return { id: 'msg-1' };
    });
    const interaction = makeInteraction({
      deferReply: vi.fn().mockImplementation(async () => {
        order.push('defer');
      }),
    });

    await mgr.sendAsSelfbot(interaction, 'yo');

    expect(order).toEqual(['defer', 'send']);
  });

  it('permet de surcharger allowed_mentions via options', async () => {
    const { mgr, sendSpy } = makeManagerWithMockSelfbot();
    const interaction = makeInteraction();

    // Cas légitime : une commande qui veut notifier explicitement un user.
    // Le caller passe son propre allowed_mentions → le default est overridé.
    await mgr.sendAsSelfbot(
      interaction,
      'Hello <@123>',
      { allowed_mentions: { parse: ['users'], users: ['123'] } },
    );

    expect(sendSpy).toHaveBeenCalledWith({
      content: 'Hello <@123>',
      allowed_mentions: { parse: ['users'], users: ['123'] },
      // flags:4096 reste appliqué (default séparé, pas overridé par l'absence
      // de la clé dans options)
      flags: 4096,
    });
  });

  it('permet de surcharger flags via options', async () => {
    const { mgr, sendSpy } = makeManagerWithMockSelfbot();
    const interaction = makeInteraction();

    // Cas légitime : message urgent (URGENT flag = 1 << 2 = 4) qui doit notifier.
    await mgr.sendAsSelfbot(interaction, 'URGENT', { flags: 4 });

    expect(sendSpy).toHaveBeenCalledWith({
      content: 'URGENT',
      allowed_mentions: { parse: [], users: [], roles: [], replied_user: false },
      flags: 4,
    });
  });
});

describe('DiscordManager.sendAsSelfbot — error paths', () => {
  it('throw si le selfbot est déconnecté', async () => {
    const { mgr } = makeManagerWithMockSelfbot();
    (mgr as any).selfbot = null;
    const interaction = makeInteraction();

    await expect(mgr.sendAsSelfbot(interaction, 'yo')).rejects.toThrow(
      /Selfbot non connecté/,
    );
  });

  it('throw si le canal est introuvable', async () => {
    const { mgr } = makeManagerWithMockSelfbot();
    (mgr as any).selfbot.channels.fetch = vi.fn().mockResolvedValue(null);
    const interaction = makeInteraction();

    await expect(mgr.sendAsSelfbot(interaction, 'yo')).rejects.toThrow(
      /Canal textuel introuvable/,
    );
  });

  it('throw si le canal n\'est pas textuel (DM vocal par ex)', async () => {
    const { mgr } = makeManagerWithMockSelfbot();
    (mgr as any).selfbot.channels.fetch = vi.fn().mockResolvedValue({
      isText: () => false,
      send: vi.fn(),
    });
    const interaction = makeInteraction();

    await expect(mgr.sendAsSelfbot(interaction, 'yo')).rejects.toThrow(
      /Canal textuel introuvable/,
    );
  });

  it('propage l\'erreur du channel.send (ne swallow PAS l\'erreur)', async () => {
    // CRITIQUE : si channel.send throw (anti-spam 403/429), stealthReply
    // doit pouvoir catch et basculer sur le fallback App Bot. Si on swallow,
    // la commande crash sans réponse.
    const { mgr } = makeManagerWithMockSelfbot();
    (mgr as any).selfbot.channels.fetch = vi.fn().mockResolvedValue({
      isText: () => true,
      send: vi.fn().mockRejectedValue(new Error('403: spam detected')),
    });
    const interaction = makeInteraction();

    await expect(mgr.sendAsSelfbot(interaction, 'yo')).rejects.toThrow(
      /403: spam detected/,
    );
  });
});
