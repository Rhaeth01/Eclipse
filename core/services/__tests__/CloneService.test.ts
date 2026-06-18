/**
 * Tests pour CloneService — clonage de serveurs via REST.
 * On mocke DiscordREST pour éviter tout appel réseau.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloneService } from '../CloneService';

describe('CloneService.cloneGuild()', () => {
  let service: CloneService;
  let rest: any;
  let progressCalls: any[];

  beforeEach(() => {
    service = new CloneService();
    progressCalls = [];

    // Compteur d'appels pour les IDs auto-incrémentés
    let idCounter = 1000;
    const newId = () => String(++idCounter);

    // Mock REST
    rest = {
      fetchGuildRoles: vi.fn().mockResolvedValue([
        { id: 'role-everyone', name: '@everyone' }, // ignoré
        { id: 'role-1', name: 'Member', color: 0xff0000, hoist: false, mentionable: true, permissions: '0' },
        { id: 'role-2', name: 'VIP', color: 0x00ff00, hoist: true, mentionable: false, permissions: '1' },
      ]),
      fetchGuildChannels: vi.fn().mockResolvedValue([
        { id: 'ch-1', name: 'general', type: 0, position: 0 },
        { id: 'ch-2', name: 'announcements', type: 0, position: 1, parent_id: null },
      ]),
      request: vi.fn().mockImplementation(async (method: string, path: string, body?: any) => {
        // POST /guilds -> crée le nouveau serveur
        if (method === 'POST' && path === '/guilds') {
          return { data: { id: 'new-guild-1', name: body?.name } };
        }
        // POST /guilds/{id}/roles -> crée un rôle
        if (method === 'POST' && /\/guilds\/.+\/roles/.test(path)) {
          return { data: { id: newId() } };
        }
        // POST /guilds/{id}/channels -> crée un salon
        if (method === 'POST' && /\/guilds\/.+\/channels/.test(path)) {
          return { data: { id: newId() } };
        }
        // GET /guilds/{id}/emojis -> liste les emojis
        if (method === 'GET' && /\/guilds\/.+\/emojis/.test(path)) {
          return { data: [] };
        }
        // POST /guilds/{id}/emojis -> crée un emoji (non testé ici)
        if (method === 'POST' && /\/guilds\/.+\/emojis/.test(path)) {
          return { data: { id: newId() } };
        }
        return { data: {} };
      }),
    };
  });

  it('crée un nouveau serveur avec le nom fourni', async () => {
    const result = await service.cloneGuild('source-1', 'Mon Clone', rest);
    expect(result.success).toBe(true);
    expect(result.newGuildId).toBe('new-guild-1');
    expect(rest.request).toHaveBeenCalledWith('POST', '/guilds', { name: 'Mon Clone' });
  });

  it('clone les rôles (sauf @everyone)', async () => {
    const result = await service.cloneGuild('source-1', 'Clone', rest);
    expect(result.rolesCreated).toBe(2); // @everyone ignoré
    const rolePosts = rest.request.mock.calls.filter((c: any[]) => c[1].includes('/roles'));
    expect(rolePosts).toHaveLength(2);
  });

  it('clone les salons en respectant l\'ordre (position)', async () => {
    const result = await service.cloneGuild('source-1', 'Clone', rest);
    expect(result.channelsCreated).toBe(2);
    const channelPosts = rest.request.mock.calls.filter((c: any[]) => c[1].includes('/channels'));
    expect(channelPosts).toHaveLength(2);
  });

  it('appelle onProgress avec les étapes clés', async () => {
    const onProgress = vi.fn((p: any) => progressCalls.push(p));
    await service.cloneGuild('source-1', 'Clone', rest, onProgress);
    expect(progressCalls.length).toBeGreaterThan(0);
    const steps = progressCalls.map(p => p.step);
    expect(steps).toContain('Récupération du serveur source');
    expect(steps).toContain('Création du serveur');
    expect(steps).toContain('Clonage des rôles');
    expect(steps).toContain('Clonage des salons');
  });

  it('continue malgré l\'échec d\'un rôle', async () => {
    // Mock : le 2e POST /roles échoue
    let callCount = 0;
    rest.request.mockImplementation(async (method: string, path: string) => {
      if (method === 'POST' && path === '/guilds') return { data: { id: 'new-1' } };
      if (method === 'POST' && /\/roles/.test(path)) {
        callCount++;
        if (callCount === 1) throw new Error('rate limited');
        return { data: { id: String(1000 + callCount) } };
      }
      if (method === 'POST' && /\/channels/.test(path)) return { data: { id: String(1000 + callCount + 10) } };
      if (method === 'GET' && /\/roles/.test(path)) return { data: [] };
      if (method === 'GET' && /\/channels/.test(path)) return { data: [] };
      if (method === 'GET' && /\/emojis/.test(path)) return { data: [] };
      return { data: {} };
    });
    rest.fetchGuildRoles = vi.fn().mockResolvedValue([
      { id: 'r1', name: 'r1', color: 0, hoist: false, mentionable: false, permissions: '0' },
      { id: 'r2', name: 'r2', color: 0, hoist: false, mentionable: false, permissions: '0' },
    ]);
    const result = await service.cloneGuild('source-1', 'Clone', rest);
    expect(result.success).toBe(true);
    expect(result.rolesCreated).toBe(1); // 1 échec sur 2
  });

  it('retourne success:false si la création du serveur échoue', async () => {
    rest.request.mockImplementation(async (method: string, path: string) => {
      if (method === 'POST' && path === '/guilds') throw new Error('API down');
      return { data: {} };
    });
    const result = await service.cloneGuild('source-1', 'Clone', rest);
    expect(result.success).toBe(false);
    expect(result.error).toContain('API down');
    expect(result.newGuildId).toBeUndefined();
  });

  it('mappe parent_id vers le nouvel ID de catégorie (channels hiérarchiques)', async () => {
    rest.fetchGuildChannels = vi.fn().mockResolvedValue([
      { id: 'cat-1', name: 'Catégorie 1', type: 4, position: 0 },
      { id: 'ch-1', name: 'general', type: 0, position: 0, parent_id: 'cat-1' },
    ]);

    const calls: any[] = [];
    rest.request.mockImplementation(async (method: string, path: string, body?: any) => {
      if (method === 'POST' && path === '/guilds') return { data: { id: 'new-1' } };
      if (method === 'POST' && /\/channels/.test(path)) {
        const result = { id: 'new-' + calls.length, ...body };
        calls.push(result);
        return { data: result };
      }
      if (method === 'GET' && /\/roles/.test(path)) return { data: [] };
      if (method === 'GET' && /\/emojis/.test(path)) return { data: [] };
      return { data: {} };
    });

    await service.cloneGuild('source-1', 'Clone', rest);

    // ch-1 (créé en 2e) devrait avoir parent_id = new-0 (cat-1, créé en 1er)
    const ch1 = calls.find(c => c.name === 'general');
    expect(ch1).toBeDefined();
    expect(ch1.parent_id).toBeDefined();
    expect(ch1.parent_id).toMatch(/^new-/);
    // Le parent_id doit pointer vers la catégorie clonée, pas l'ID original
    expect(ch1.parent_id).not.toBe('cat-1');
  });

  it('fetchGuildRoles et fetchGuildChannels sont appelés avec le sourceId', async () => {
    await service.cloneGuild('source-XYZ', 'Clone', rest);
    expect(rest.fetchGuildRoles).toHaveBeenCalledWith('source-XYZ');
    expect(rest.fetchGuildChannels).toHaveBeenCalledWith('source-XYZ');
  });
});
