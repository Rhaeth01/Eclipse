import { describe, it, expect, vi } from 'vitest';
import { DiscordManager } from '../DiscordManager';

/**
 * Anti-régression : le fallback de stealthReply ne doit JAMAIS persister
 * le contenu de la commande en éphémère permanent.
 *
 * Bug précédent (signalé par l'utilisateur) :
 * - sendAsSelfbot throw (selfbot pas dans le canal, 403, etc.)
 * - Le code appelait editReply({ content }) qui CONVERTIT le ⌛ deferReply
 *   en message éphémère PERMANENT contenant le texte de la commande.
 * - L'utilisateur voyait "Only you can see this" + le contenu de la commande
 *   qui ne partait jamais.
 *
 * Fix : deleteReply() supprime le ⌛, puis followUp avec un message d'erreur
 * court (pas le contenu original).
 */

function makeManager() {
  const wsService = { broadcast: vi.fn(), sendToClient: vi.fn() } as any;
  const dbService = {} as any;
  const spyService = {} as any;
  const trollService = { setMessageHandler: vi.fn(), stopAllTyping: vi.fn() } as any;
  return new DiscordManager(wsService, dbService, spyService, trollService);
}

function makeInteraction() {
  const i: any = {
    deferred: false,
    replied: false,
    channelId: 'ch-1',
    deleteReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
  };
  i.deferReply = vi.fn().mockImplementation(async () => {
    i.deferred = true;
  });
  return i;
}

describe('stealthReply fallback — anti-régression "erreur only user"', () => {
  it('ne persiste PAS le contenu en éphémère si sendAsSelfbot throw après deferReply', async () => {
    const mgr = makeManager();
    // Selfbot présent mais channel.fetch throw (cas typique : 403, canal introuvable).
    // sendAsSelfbot deferReply D'ABORD (crée le ⌛), puis throw sur fetch.
    (mgr as any).selfbot = {
      channels: {
        fetch: vi.fn().mockRejectedValue(new Error('403 Forbidden')),
      },
    };
    (mgr as any).context = { getCommandStealth: () => true };

    const i = makeInteraction();
    const commandContent = 'VAPORWAVE TEXT(user message)';
    await mgr.stealthReply(i, commandContent);

    // deferReply a été appelé pour ACK silencieusement
    expect(i.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    // deleteReply DOIT être appelé pour supprimer le ⌛ (pas editReply qui le rendrait permanent)
    expect(i.deleteReply).toHaveBeenCalled();
    // editReply NE DOIT PAS être appelé avec le contenu de la commande
    const editReplyCalls = i.editReply.mock.calls;
    for (const call of editReplyCalls) {
      const arg = call[0];
      if (arg?.content) {
        expect(arg.content).not.toContain(commandContent);
      }
    }
    // followUp DOIT être appelé avec un message d'erreur court
    expect(i.followUp).toHaveBeenCalled();
    const followUpArg = i.followUp.mock.calls[0][0];
    expect(followUpArg.ephemeral).toBe(true);
    expect(followUpArg.content).toContain('❌');
    expect(followUpArg.content).not.toContain(commandContent);
  });

  it('reply direct si pas encore deferred et sendAsSelfbot throw', async () => {
    const mgr = makeManager();
    (mgr as any).selfbot = null;
    (mgr as any).context = { getCommandStealth: () => true };

    const i = makeInteraction();
    // Pas de deferReply car selfbot null dès le début (sendAsSelfbot check)
    await mgr.stealthReply(i, 'public message');

    // reply direct avec erreur (pas editReply/followUp)
    expect(i.reply).toHaveBeenCalled();
    const replyArg = i.reply.mock.calls[0][0];
    expect(replyArg.ephemeral).toBe(true);
    expect(replyArg.content).toContain('❌');
  });
});

describe('stealthReply succès — envoie via selfbot normalement', () => {
  it('appelle sendAsSelfbot et retourne le message quand tout va bien', async () => {
    const mgr = makeManager();
    const sentMsg = { id: 'm-1' };
    (mgr as any).selfbot = {
      channels: {
        fetch: vi.fn().mockResolvedValue({
          isText: () => true,
          send: vi.fn().mockResolvedValue(sentMsg),
        }),
      },
    };

    const i = makeInteraction();
    const result = await mgr.stealthReply(i, 'hello world');
    expect(result).toBe(sentMsg);
    expect(i.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(i.deleteReply).toHaveBeenCalled();
  });
});
