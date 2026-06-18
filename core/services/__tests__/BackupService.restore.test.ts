/**
 * Tests pour BackupService.restoreBackup() — la nouvelle fonctionnalité restore.
 * On mock DiscordREST pour éviter tout appel réseau.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BackupService } from '../BackupService';

function makeClientStub(overrides: { relationships?: any[]; guilds?: any[]; addFriend?: any } = {}) {
  return {
    user: { id: 'me-id', tag: 'me#0001' },
    guilds: { cache: { values: () => overrides.guilds ?? [] } },
    getRest: () => ({ addFriend: overrides.addFriend ?? vi.fn().mockResolvedValue(undefined) }),
  } as any;
}

describe('BackupService.restoreBackup()', () => {
  let service: BackupService;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eclipse-restore-'));
    service = new BackupService(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeBackup(name: string, data: any) {
    const filePath = path.join(tmpDir, name);
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
    return filePath;
  }

  const validBackup = {
    metadata: { userId: 'me-id', username: 'me#0001', createdAt: '2024-01-01', version: '1.0' },
    friends: [
      { id: 'f1', username: 'alice#1' },
      { id: 'f2', username: 'bob#2' },
      { id: 'f3', username: 'carol#3' },
    ],
    guilds: [
      { id: 'g1', name: 'Already here' },
      { id: 'g2', name: 'Missing' },
    ],
    channels: [],
  };

  it('réajoute tous les amis via addFriend()', async () => {
    const addFriend = vi.fn().mockResolvedValue(undefined);
    writeBackup('backup.json', validBackup);
    const client = makeClientStub({ addFriend });

    const report = await service.restoreBackup('backup.json', client);
    expect(addFriend).toHaveBeenCalledTimes(3);
    expect(addFriend).toHaveBeenCalledWith('f1');
    expect(addFriend).toHaveBeenCalledWith('f2');
    expect(addFriend).toHaveBeenCalledWith('f3');
    expect(report.friendsAdded).toBe(3);
    expect(report.friendsFailed).toBe(0);
  });

  it('continue après un échec et compte les échecs', async () => {
    const addFriend = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValueOnce(undefined);
    writeBackup('backup.json', validBackup);
    const client = makeClientStub({ addFriend });

    const report = await service.restoreBackup('backup.json', client);
    expect(addFriend).toHaveBeenCalledTimes(3);
    expect(report.friendsAdded).toBe(2);
    expect(report.friendsFailed).toBe(1);
  });

  it('détecte les serveurs manquants (pas dans le cache actuel)', async () => {
    writeBackup('backup.json', validBackup);
    const client = makeClientStub({ guilds: [{ id: 'g1' }] }); // g2 manque

    const report = await service.restoreBackup('backup.json', client);
    expect(report.missingGuilds).toHaveLength(1);
    expect(report.missingGuilds[0].id).toBe('g2');
    expect(report.missingGuilds[0].name).toBe('Missing');
  });

  it('retourne [] si tous les serveurs sont déjà dans le cache', async () => {
    writeBackup('backup.json', validBackup);
    const client = makeClientStub({ guilds: [{ id: 'g1' }, { id: 'g2' }] });

    const report = await service.restoreBackup('backup.json', client);
    expect(report.missingGuilds).toEqual([]);
  });

  it('lance une erreur si le fichier de backup n\'existe pas', async () => {
    const client = makeClientStub();
    await expect(service.restoreBackup('nope.json', client)).rejects.toThrow(/non trouvé/);
  });

  it('gère un backup avec zéro amis et zéro serveurs', async () => {
    writeBackup('empty.json', { ...validBackup, friends: [], guilds: [] });
    const client = makeClientStub();
    const report = await service.restoreBackup('empty.json', client);
    expect(report.friendsAdded).toBe(0);
    expect(report.friendsFailed).toBe(0);
    expect(report.missingGuilds).toEqual([]);
  });

  it('respecte un délai entre les appels (rate-limit friendly)', async () => {
    const addFriend = vi.fn().mockResolvedValue(undefined);
    writeBackup('backup.json', { ...validBackup, friends: validBackup.friends.slice(0, 2) });
    const client = makeClientStub({ addFriend });

    const start = Date.now();
    await service.restoreBackup('backup.json', client);
    const elapsed = Date.now() - start;
    // ~800ms minimum par ami (2 amis => >= ~1.6s, on checke > 1s pour éviter la flaky)
    expect(elapsed).toBeGreaterThan(1000);
  });
});
