/**
 * Tests pour le path PLAY du QuestService — vérifie que le dummy process est
 * désormais un vrai .exe (pas un .bat) sur Windows, avec une chaîne de
 * fallback donor (cmd.exe → ping.exe → process.execPath).
 *
 * Bug historique (avant v0.6.0) : on créait un .bat renommé `X.bat` au lieu
 * de `X.exe`. Discord scanne la liste des processus et fait correspondre les
 * noms aux exécutables de jeux — un .bat n'est jamais matché, donc la quête
 * PLAY ne progressait jamais.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

let currentPlatform: NodeJS.Platform = 'linux';

vi.mock('os', () => ({
  platform: () => currentPlatform,
  tmpdir: () => '/tmp',
}));

vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({ unref: vi.fn(), pid: 99999 })),
}));

const existsSyncMock = vi.fn();
const copyFileSyncMock = vi.fn();
const writeFileSyncMock = vi.fn();
const rmSyncMock = vi.fn();
const mkdirSyncMock = vi.fn();

vi.mock('fs', () => ({
  default: {
    existsSync: (...a: any[]) => existsSyncMock(...a),
    copyFileSync: (...a: any[]) => copyFileSyncMock(...a),
    writeFileSync: (...a: any[]) => writeFileSyncMock(...a),
    rmSync: (...a: any[]) => rmSyncMock(...a),
    mkdirSync: (...a: any[]) => mkdirSyncMock(...a),
  },
  existsSync: (...a: any[]) => existsSyncMock(...a),
  copyFileSync: (...a: any[]) => copyFileSyncMock(...a),
  writeFileSync: (...a: any[]) => writeFileSyncMock(...a),
  rmSync: (...a: any[]) => rmSyncMock(...a),
  mkdirSync: (...a: any[]) => mkdirSyncMock(...a),
}));

import { spawn } from 'child_process';
import { QuestService } from '../QuestService';

function makeService(): QuestService {
  return new QuestService({} as any, {} as any);
}

describe('QuestService.launchDummyProcess (PLAY path)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentPlatform = 'linux';
    existsSyncMock.mockReturnValue(true);
    copyFileSyncMock.mockImplementation(() => undefined);
  });

  describe('Windows', () => {
    beforeEach(() => {
      currentPlatform = 'win32';
    });

    it('crée un fichier .exe (pas .bat) avec le nom du jeu', async () => {
      const svc = makeService();
      const result = await (svc as any).launchDummyProcess('FortniteClient-Win64-Shipping.exe', 'Fortnite');

      expect(result.type).toBe('windows-exe');
      expect(result.path).toMatch(/FortniteClient-Win64-Shipping\.exe$/);
      expect(result.path).not.toMatch(/\.bat$/); // Anti-régression : pas de .bat
      expect(result.pid).toBeDefined();
    });

    it('copie cmd.exe depuis System32 (premier candidat donor)', async () => {
      const svc = makeService();
      await (svc as any).launchDummyProcess('Among Us.exe', 'Among Us');

      const donorArgs = copyFileSyncMock.mock.calls[0]?.[0];
      const targetArgs = copyFileSyncMock.mock.calls[0]?.[1];
      expect(String(donorArgs)).toMatch(/cmd\.exe$/i);
      expect(String(targetArgs)).toMatch(/Among Us\.exe$/);
    });

    it('spawn le .exe avec windowsHide:true et stdio ignore (stealth)', async () => {
      const svc = makeService();
      await (svc as any).launchDummyProcess('Valorant.exe', 'Valorant');

      const spawnArgs = (spawn as any).mock.calls[0];
      expect(spawnArgs[0]).toMatch(/Valorant\.exe$/);
      expect(spawnArgs[2]).toMatchObject({
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
    });

    it("fallback donor si cmd.exe n'est pas trouvable", async () => {
      existsSyncMock.mockImplementation((p: string) => {
        if (String(p).includes('cmd.exe')) return false;
        if (String(p).includes('ping.exe')) return true;
        return false;
      });
      const svc = makeService();
      await (svc as any).launchDummyProcess('ApexLegends.exe', 'Apex');

      const donorArgs = copyFileSyncMock.mock.calls[0]?.[0];
      expect(String(donorArgs)).toMatch(/ping\.exe$/i);
    });

    it("lance une erreur explicite si aucun donor n'est accessible", async () => {
      existsSyncMock.mockReturnValue(false);
      copyFileSyncMock.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      const svc = makeService();
      await expect(
        (svc as any).launchDummyProcess('Game.exe', 'Game')
      ).rejects.toThrow(/dummy .exe/);
    });
  });

  describe('Linux/Mac', () => {
    beforeEach(() => {
      currentPlatform = 'linux';
    });

    it("spawn 'sleep 3600' (best-effort non-Windows)", async () => {
      const svc = makeService();
      const result = await (svc as any).launchDummyProcess('Game.exe', 'Game');
      expect(result.type).toBe('unix');
      const spawnArgs = (spawn as any).mock.calls[0];
      expect(spawnArgs[0]).toBe('sleep');
      expect(spawnArgs[1]).toEqual(['3600']);
    });
  });
});
