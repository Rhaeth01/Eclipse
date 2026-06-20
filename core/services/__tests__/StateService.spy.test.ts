/**
 * Tests pour StateService — focus sur deserializeSpyTargets.
 *
 * Contexte : avant ce fix, la méthode `deserializeSpyTargets` faisait
 * `this.spyService.clear()` systématiquement (workaround migration v0.4.8
 * jamais réverté). Conséquence : les cibles spy configurées par l'user
 * étaient effacées à CHAQUE redémarrage d'Eclipse, forçant l'user à
 * re-ajouter manuellement toutes ses cibles.
 *
 * Ce fix fait que `deserializeSpyTargets` RESTAURE réellement les cibles
 * sérialisées au lieu de les clear.
 *
 * On teste via `restore()` (méthode publique qui appelle
 * `deserializeSpyTargets` en interne) avec une DB mockée qui retourne
 * un état sérialisé contenant des spy targets.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StateService } from '../StateService';
import { SpyService } from '../SpyService';
import { DatabaseService } from '../DatabaseService';
import { TrollService } from '../TrollService';

function makeMockDb(serializedState: any) {
  const stmt = {
    get: vi.fn().mockReturnValue(
      serializedState ? { value: JSON.stringify(serializedState) } : null
    ),
  };
  return {
    db: {
      prepare: vi.fn().mockReturnValue(stmt),
    },
  } as any;
}

function makeMockTrollService(): any {
  return {
    setMessageHandler: vi.fn(),
    setEditHandler: vi.fn(),
    setBulkDeleteHandler: vi.fn(),
    reactrollTargets: new Map(),
    deletesendTargets: new Map(),
    autoreplyTargets: new Map(),
    typingChannels: new Map(),
  };
}

describe('StateService.restore — spy targets', () => {
  it('restaure les cibles spy au lieu de les clear (anti-régression v0.4.8)', () => {
    const spyService = new SpyService();
    const addTargetSpy = vi.spyOn(spyService, 'addTarget');
    const clearSpy = vi.spyOn(spyService, 'clear');

    const serialized = {
      version: 1,
      timestamp: Date.now(),
      settings: { stealthMode: true, silentTyping: false },
      spyTargets: [
        ['user-A', ['guild-1', 'guild-2']],
        ['user-B', ['guild-3']],
      ],
      trolls: {
        reactroll: [],
        deletesend: [],
        autoreply: [],
        typingChannels: [],
      },
      animations: {},
    };
    const db = makeMockDb(serialized);
    const trollService = makeMockTrollService();
    const stateService = new StateService(db, spyService, trollService as any);

    stateService.restore();

    // Anti-régression : clear() ne doit PAS être appelé sur les spy targets
    expect(clearSpy).not.toHaveBeenCalled();

    // Les 2 users doivent avoir été addTarget avec leurs guilds respectifs
    expect(addTargetSpy).toHaveBeenCalledWith('user-A', 'guild-1');
    expect(addTargetSpy).toHaveBeenCalledWith('user-A', 'guild-2');
    expect(addTargetSpy).toHaveBeenCalledWith('user-B', 'guild-3');
    expect(addTargetSpy).toHaveBeenCalledTimes(3);

    // Vérification de l'état final du service
    expect(spyService.getUserGuilds('user-A')).toEqual(new Set(['guild-1', 'guild-2']));
    expect(spyService.getUserGuilds('user-B')).toEqual(new Set(['guild-3']));
  });

  it("ne crash pas si spyTargets est vide", () => {
    const spyService = new SpyService();
    const addTargetSpy = vi.spyOn(spyService, 'addTarget');

    const serialized = {
      version: 1,
      timestamp: Date.now(),
      settings: { stealthMode: true, silentTyping: false },
      spyTargets: [],
      trolls: { reactroll: [], deletesend: [], autoreply: [], typingChannels: [] },
      animations: {},
    };
    const db = makeMockDb(serialized);
    const stateService = new StateService(db, spyService, makeMockTrollService());

    expect(() => stateService.restore()).not.toThrow();
    expect(addTargetSpy).not.toHaveBeenCalled();
    expect(spyService.getTargets().size).toBe(0);
  });

  it('survit à un état absent (première installation, pas de sauvegarde)', () => {
    const spyService = new SpyService();
    const db = makeMockDb(null); // Pas de row.value
    const stateService = new StateService(db, spyService, makeMockTrollService());

    expect(() => stateService.restore()).not.toThrow();
    expect(spyService.getTargets().size).toBe(0);
  });
});
