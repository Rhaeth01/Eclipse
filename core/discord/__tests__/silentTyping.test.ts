import { describe, it, expect, vi } from 'vitest';
import { DiscordUserClient } from '../DiscordUserClient';

/**
 * Anti-régression : silent typing doit être enforced au plus bas niveau
 * (channel.sendTyping), pas seulement à 2 call sites spécifiques.
 *
 * Avant : seulement DiscordManager.sendTyping wrapper (L250) et la
 * commande /troll typing vérifiaient getSilentTyping(). Si un nouveau
 * call site appelait channel.sendTyping() directement, le silent typing
 * était silencieusement ignoré.
 *
 * Maintenant : DiscordUserClient.silentTypingGetter est appelé dans
 * channel.sendTyping() au plus bas niveau.
 */
describe('DiscordUserClient.silentTypingGetter enforcement', () => {
  it('expose le champ silentTypingGetter (null par défaut)', () => {
    const client = new DiscordUserClient({ os: 'Linux', browser: 'Test', device: 'test' });
    expect(client.silentTypingGetter).toBeNull();
  });

  it('quand silentTypingGetter retourne true, channel.sendTyping court-circuite', async () => {
    const client = new DiscordUserClient({ os: 'Linux', browser: 'Test', device: 'test' });
    const restSendTypingSpy = vi.fn().mockResolvedValue(undefined);
    (client as any).rest = { sendTyping: restSendTypingSpy };
    client.silentTypingGetter = () => true;

    // buildChannel est privé mais on peut y accéder pour le test
    const channel = (client as any).buildChannel({ id: 'ch-1', type: 0 });
    await channel.sendTyping();

    // REST sendTyping NE DOIT PAS être appelé
    expect(restSendTypingSpy).not.toHaveBeenCalled();
  });

  it('quand silentTypingGetter retourne false, channel.sendTyping appelle REST', async () => {
    const client = new DiscordUserClient({ os: 'Linux', browser: 'Test', device: 'test' });
    const restSendTypingSpy = vi.fn().mockResolvedValue(undefined);
    (client as any).rest = { sendTyping: restSendTypingSpy };
    client.silentTypingGetter = () => false;

    const channel = (client as any).buildChannel({ id: 'ch-1', type: 0 });
    await channel.sendTyping();

    expect(restSendTypingSpy).toHaveBeenCalledWith('ch-1');
  });

  it('quand silentTypingGetter est null (non set), channel.sendTyping appelle REST', async () => {
    const client = new DiscordUserClient({ os: 'Linux', browser: 'Test', device: 'test' });
    const restSendTypingSpy = vi.fn().mockResolvedValue(undefined);
    (client as any).rest = { sendTyping: restSendTypingSpy };

    const channel = (client as any).buildChannel({ id: 'ch-1', type: 0 });
    await channel.sendTyping();

    expect(restSendTypingSpy).toHaveBeenCalledWith('ch-1');
  });
});
