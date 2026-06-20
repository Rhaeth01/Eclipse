/**
 * Tests pour les caches internes de DiscordUserClient :
 *   - messageCache (alimenté sur MESSAGE_CREATE, consulté sur MESSAGE_DELETE
 *     et MESSAGE_UPDATE)
 *   - voiceStateCache (alimenté sur VOICE_STATE_UPDATE, émet old/new distincts)
 *
 * Contexte : avant ce fix, MESSAGE_DELETE ne contenait pas author/content
 * (Discord ne renvoie que {id, channel_id, guild_id}) et il n'y avait pas
 * de cache → snipe retournait "Unknown#0000" et spy_deleted ne se déclenchait
 * jamais. idem pour voiceStateUpdate qui émettait le même objet old/new
 * → spy_voice_join/leave/move injoignables.
 *
 * On teste les handlers directement en émettant les events gateway
 * (gateway:messageCreate, gateway:messageDelete, etc.) sur le gateway
 * interne du client.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscordUserClient } from '../DiscordUserClient';

function makeClient(): DiscordUserClient {
  return new DiscordUserClient({
    os: 'Windows',
    browser: 'Discord Client',
    device: 'desktop',
  });
}

function makeMessagePayload(overrides: any = {}): any {
  return {
    id: 'msg-1',
    content: 'hello world',
    author: { id: 'user-1', username: 'Alice', discriminator: '0', avatar: null, bot: false },
    channel_id: 'ch-1',
    guild_id: 'g-1',
    timestamp: '2024-01-01T00:00:00.000Z',
    mentions: [],
    ...overrides,
  };
}

function getGateway(client: DiscordUserClient): any {
  return (client as any).gateway;
}

describe('DiscordUserClient — message cache', () => {
  it('alimente le cache sur MESSAGE_CREATE', async () => {
    const client = makeClient();
    const gw = getGateway(client);
    const onCreate = vi.fn();
    client.on('messageCreate', onCreate);

    gw.emit('gateway:messageCreate', makeMessagePayload());

    expect(onCreate).toHaveBeenCalledTimes(1);
    const msg = onCreate.mock.calls[0][0];
    // Le cache interne contient le message (vérif via le lookup privé)
    const cache = (client as any).messageCache;
    expect(cache.get('msg-1')).toBe(msg);
  });

  it('émet un message avec les VRAIES données (author/content) sur MESSAGE_DELETE', async () => {
    const client = makeClient();
    const gw = getGateway(client);
    const onDelete = vi.fn();

    // 1. MESSAGE_CREATE → cache alimenté
    gw.emit('gateway:messageCreate', makeMessagePayload({
      id: 'msg-1',
      content: 'secret content',
      author: { id: 'user-1', username: 'Alice', discriminator: '0', avatar: null, bot: false },
    }));

    // 2. MESSAGE_DELETE → Discord envoie juste {id, channel_id, guild_id}
    const onCreateListener = vi.fn();
    client.on('messageDelete', onDelete);
    gw.emit('gateway:messageDelete', {
      id: 'msg-1',
      channel_id: 'ch-1',
      guild_id: 'g-1',
    });

    expect(onDelete).toHaveBeenCalledTimes(1);
    const emitted = onDelete.mock.calls[0][0];
    // Anti-régression : le message émis doit contenir les VRAIES données
    // (author.tag, content), pas "Unknown#0000" / "[Contenu illisible]"
    expect(emitted.author.id).toBe('user-1');
    expect(emitted.author.tag).toBe('Alice');
    expect(emitted.content).toBe('secret content');
  });

  it('fallback gracieux si MESSAGE_DELETE pour un message jamais vu', () => {
    const client = makeClient();
    const gw = getGateway(client);
    const onDelete = vi.fn();
    client.on('messageDelete', onDelete);

    // Pas de MESSAGE_CREATE préalable
    gw.emit('gateway:messageDelete', {
      id: 'msg-inexistant',
      channel_id: 'ch-1',
      guild_id: 'g-1',
    });

    // L'event est quand même émis (pour ne pas perdre l'event), mais avec
    // les données limitées de MESSAGE_DELETE (author.id = "0")
    expect(onDelete).toHaveBeenCalledTimes(1);
    const emitted = onDelete.mock.calls[0][0];
    expect(emitted.id).toBe('msg-inexistant');
  });

  it('émet oldMsg et newMsg distincts sur MESSAGE_UPDATE (vrai old content)', async () => {
    const client = makeClient();
    const gw = getGateway(client);
    const onUpdate = vi.fn();

    // 1. MESSAGE_CREATE avec contenu initial
    gw.emit('gateway:messageCreate', makeMessagePayload({
      id: 'msg-1',
      content: 'original content',
    }));

    // 2. MESSAGE_UPDATE avec nouveau contenu
    client.on('messageUpdate', onUpdate);
    gw.emit('gateway:messageUpdate', makeMessagePayload({
      id: 'msg-1',
      content: 'edited content',
    }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const [oldMsg, newMsg] = onUpdate.mock.calls[0];
    // Anti-régression : old et new doivent être des objets DISTINCTS
    expect(oldMsg).not.toBe(newMsg);
    expect(oldMsg.content).toBe('original content');
    expect(newMsg.content).toBe('edited content');
  });

  it('update le cache avec le nouveau contenu après MESSAGE_UPDATE', () => {
    const client = makeClient();
    const gw = getGateway(client);
    const cache = (client as any).messageCache;

    gw.emit('gateway:messageCreate', makeMessagePayload({ id: 'msg-1', content: 'v1' }));
    expect(cache.get('msg-1').content).toBe('v1');

    gw.emit('gateway:messageUpdate', makeMessagePayload({ id: 'msg-1', content: 'v2' }));
    expect(cache.get('msg-1').content).toBe('v2');
  });

  it('supprime du cache sur MESSAGE_DELETE', () => {
    const client = makeClient();
    const gw = getGateway(client);
    const cache = (client as any).messageCache;

    gw.emit('gateway:messageCreate', makeMessagePayload({ id: 'msg-1' }));
    expect(cache.has('msg-1')).toBe(true);

    gw.emit('gateway:messageDelete', { id: 'msg-1', channel_id: 'ch-1', guild_id: 'g-1' });
    expect(cache.has('msg-1')).toBe(false);
  });
});

describe('DiscordUserClient — voice state cache', () => {
  it('émet oldState et newState distincts sur VOICE_STATE_UPDATE (pas le même objet)', () => {
    const client = makeClient();
    const gw = getGateway(client);
    const onVSU = vi.fn();
    client.on('voiceStateUpdate', onVSU);

    // Premier event : user "u-1" rejoint le vocal "vc-1" dans "g-1"
    gw.emit('gateway:voiceStateUpdate', {
      user_id: 'u-1',
      guild_id: 'g-1',
      channel_id: 'vc-1',
      member: { user: { id: 'u-1', username: 'Bob', discriminator: '0', bot: false } },
    });

    expect(onVSU).toHaveBeenCalledTimes(1);
    const [oldState, newState] = onVSU.mock.calls[0];
    // Anti-régression : old et new DOIVENT être des objets distincts
    expect(oldState).not.toBe(newState);
    // oldState = pas de cache → channelId undefined (join)
    expect(oldState.channelId).toBeUndefined();
    // newState = le join
    expect(newState.channelId).toBe('vc-1');
  });

  it('détecte un move vocal (old.channelId !== new.channelId)', () => {
    const client = makeClient();
    const gw = getGateway(client);
    const onVSU = vi.fn();
    client.on('voiceStateUpdate', onVSU);

    // 1. Join initial dans vc-1
    gw.emit('gateway:voiceStateUpdate', {
      user_id: 'u-1',
      guild_id: 'g-1',
      channel_id: 'vc-1',
      member: { user: { id: 'u-1', username: 'Bob', discriminator: '0', bot: false } },
    });
    // 2. Move de vc-1 vers vc-2
    gw.emit('gateway:voiceStateUpdate', {
      user_id: 'u-1',
      guild_id: 'g-1',
      channel_id: 'vc-2',
      member: { user: { id: 'u-1', username: 'Bob', discriminator: '0', bot: false } },
    });

    expect(onVSU).toHaveBeenCalledTimes(2);
    const [oldState2, newState2] = onVSU.mock.calls[1];
    // oldState DOIT refléter le canal précédent (vc-1), pas le nouveau
    expect(oldState2.channelId).toBe('vc-1');
    expect(newState2.channelId).toBe('vc-2');
  });

  it('détecte un leave vocal (new.channelId undefined)', () => {
    const client = makeClient();
    const gw = getGateway(client);
    const onVSU = vi.fn();
    client.on('voiceStateUpdate', onVSU);

    // 1. Join
    gw.emit('gateway:voiceStateUpdate', {
      user_id: 'u-1',
      guild_id: 'g-1',
      channel_id: 'vc-1',
      member: { user: { id: 'u-1', username: 'Bob', discriminator: '0', bot: false } },
    });
    // 2. Leave (channel_id = null)
    gw.emit('gateway:voiceStateUpdate', {
      user_id: 'u-1',
      guild_id: 'g-1',
      channel_id: null,
      member: { user: { id: 'u-1', username: 'Bob', discriminator: '0', bot: false } },
    });

    const [oldState, newState] = onVSU.mock.calls[1];
    expect(oldState.channelId).toBe('vc-1');
    expect(newState.channelId).toBeNull();
  });

  it('isole les voice states par (userId, guildId)', () => {
    const client = makeClient();
    const gw = getGateway(client);
    const cache = (client as any).voiceStateCache;

    // User dans guild1
    gw.emit('gateway:voiceStateUpdate', {
      user_id: 'u-1',
      guild_id: 'g-1',
      channel_id: 'vc-1',
      member: { user: { id: 'u-1', username: 'Bob', discriminator: '0', bot: false } },
    });
    // MÊME user dans guild2 (cas légitime : user dans plusieurs guildes)
    gw.emit('gateway:voiceStateUpdate', {
      user_id: 'u-1',
      guild_id: 'g-2',
      channel_id: 'vc-A',
      member: { user: { id: 'u-1', username: 'Bob', discriminator: '0', bot: false } },
    });

    // Le cache doit contenir 2 entrées distinctes
    expect(cache.has('u-1:g-1')).toBe(true);
    expect(cache.has('u-1:g-2')).toBe(true);
    expect(cache.get('u-1:g-1').channelId).toBe('vc-1');
    expect(cache.get('u-1:g-2').channelId).toBe('vc-A');
  });
});
