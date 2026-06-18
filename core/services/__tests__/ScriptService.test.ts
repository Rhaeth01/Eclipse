/**
 * Tests pour ScriptService — sandbox vm, isolation, hot-reload.
 * On utilise un dossier temporaire pour les scripts de test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ScriptService } from '../ScriptService';

describe('ScriptService', () => {
  let service: ScriptService;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eclipse-scripts-'));
    service = new ScriptService(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeScript(name: string, code: string) {
    const filePath = path.join(tmpDir, `${name}.js`);
    fs.writeFileSync(filePath, code, 'utf-8');
  }

  describe('list()', () => {
    it('retourne [] si le dossier est vide', () => {
      expect(service.list()).toEqual([]);
    });

    it('retourne les scripts présents dans le dossier', () => {
      writeScript('hello', '// hi');
      writeScript('world', '// world');
      const scripts = service.list();
      expect(scripts).toHaveLength(2);
      expect(scripts.map(s => s.name).sort()).toEqual(['hello', 'world']);
    });

    it('inclut le statut loaded:false pour les scripts non chargés', () => {
      writeScript('notloaded', '// nothing');
      const [s] = service.list();
      expect(s.loaded).toBe(false);
    });

    it('ne liste que les fichiers .js/.ts/.mjs', () => {
      writeScript('script', '// js');
      fs.writeFileSync(path.join(tmpDir, 'README.md'), '# ignore me');
      fs.writeFileSync(path.join(tmpDir, 'data.json'), '{}');
      const scripts = service.list();
      expect(scripts).toHaveLength(1);
      expect(scripts[0].name).toBe('script');
    });
  });

  describe('load()', () => {
    it('charge un script valide et retourne loaded:true', () => {
      writeScript('valid', '__scriptDescription = "Test script";');
      const info = service.load('valid');
      expect(info.loaded).toBe(true);
      expect(info.description).toBe('Test script');
      expect(info.error).toBeUndefined();
    });

    it('échoue proprement sur un script avec erreur de syntaxe', () => {
      writeScript('broken', 'this is not valid javascript!!!');
      const info = service.load('broken');
      expect(info.loaded).toBe(false);
      expect(info.error).toBeTruthy();
    });

    it('retourne error si le fichier n\'existe pas', () => {
      const info = service.load('nonexistent');
      expect(info.loaded).toBe(false);
      expect(info.error).toBe('Fichier introuvable');
    });

    it('permet de recharger un script (load() est idempotent)', () => {
      writeScript('reload', '__scriptDescription = "v1";');
      const i1 = service.load('reload');
      expect(i1.description).toBe('v1');
      // Modifie et recharge
      writeScript('reload', '__scriptDescription = "v2";');
      const i2 = service.load('reload');
      expect(i2.description).toBe('v2');
    });
  });

  describe('unload()', () => {
    it('décharge un script chargé', () => {
      writeScript('a', '__scriptDescription = "a";');
      service.load('a');
      expect(service.unload('a')).toBe(true);
      // list() ne le montre plus comme loaded
      const [s] = service.list();
      expect(s.loaded).toBe(false);
    });

    it('retourne false pour un script non chargé', () => {
      expect(service.unload('nope')).toBe(false);
    });
  });

  describe('sandbox isolation', () => {
    it('N\'expose PAS require dans le sandbox', () => {
      writeScript('norequire', `
        try { require('fs'); __scriptDescription = 'HAS_REQUIRE'; }
        catch (e) { __scriptDescription = 'NO_REQUIRE'; }
      `);
      const info = service.load('norequire');
      expect(info.description).toBe('NO_REQUIRE');
    });

    it('N\'expose PAS process dans le sandbox', () => {
      writeScript('noprocess', `
        try { const p = process; __scriptDescription = 'HAS_PROCESS'; }
        catch (e) { __scriptDescription = 'NO_PROCESS'; }
      `);
      const info = service.load('noprocess');
      expect(info.description).toBe('NO_PROCESS');
    });

    it('N\'expose PAS fs comme variable globale', () => {
      writeScript('nofs', `
        try { const _ = fs; __scriptDescription = 'HAS_FS'; }
        catch (e) { __scriptDescription = 'NO_FS'; }
      `);
      const info = service.load('nofs');
      expect(info.description).toBe('NO_FS');
    });

    it('expose setTimeout (utilitaire standard)', () => {
      writeScript('hastimeout', `
        __scriptDescription = typeof setTimeout === 'function' ? 'HAS_TIMEOUT' : 'NO_TIMEOUT';
      `);
      const info = service.load('hastimeout');
      expect(info.description).toBe('HAS_TIMEOUT');
    });

    it('appelle eclipse.log() du contexte', () => {
      const ctxLog = vi.fn();
      service.setContext({
        send: vi.fn(),
        log: ctxLog,
        rest: null,
        db: null,
      });
      writeScript('logit', `eclipse.log('hello from script');`);
      service.load('logit');
      expect(ctxLog).toHaveBeenCalledWith(expect.stringContaining('hello'));
    });

    it('appelle eclipse.send() du contexte', () => {
      // Note : load() exécute le code de manière synchrone (vm.runInContext ne await pas).
      // On vérifie que la fonction est appelée (peu importe la résolution de la Promise).
      const ctxSend = vi.fn().mockResolvedValue(undefined);
      service.setContext({ send: ctxSend, log: vi.fn(), rest: null, db: null });
      writeScript('sendit', `eclipse.send('ch-1', 'hello');`);
      service.load('sendit');
      expect(ctxSend).toHaveBeenCalledWith('ch-1', 'hello');
    });
  });

  describe('run()', () => {
    it('retourne un message d\'erreur si le script n\'est pas chargé', async () => {
      const result = await service.run('notloaded');
      expect(result).toMatch(/non chargé/);
    });

    it('émet "script:run" quand un script chargé est exécuté', async () => {
      writeScript('runner', '// nothing');
      service.load('runner');
      const handler = vi.fn();
      service.on('script:run', handler);
      await service.run('runner', ['arg1', 'arg2']);
      expect(handler).toHaveBeenCalledWith('runner', ['arg1', 'arg2']);
    });
  });

  describe('setContext()', () => {
    it('accepte un contexte sans crash', () => {
      expect(() => service.setContext({
        send: vi.fn(), log: vi.fn(), rest: null, db: null,
      })).not.toThrow();
    });
  });
});
