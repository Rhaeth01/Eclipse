/**
 * Anti-régression : s'assure que le dossier `core/dist/` est compilé depuis
 * la nouvelle source (CommandRegistry + categories/) et non depuis l'ancien
 * système (core/commands.ts monolithique).
 *
 * Bug historique : v0.5.0 a refactoré les commandes vers CommandRegistry +
 * dossiers categories/, mais `core/dist/` contenait encore l'ancien
 * `commands.js` + un switch de 940 lignes dans `DiscordManager.js`. Le bundle
 * Tauri embarque `core/dist/`, donc l'utilisateur exécutait l'ancien système :
 * les commandes préfixe-`.` (.roll, .mimic) fonctionnaient, mais les
 * nouvelles catégories (.spy, .admin, .troll) n'existaient pas dans la
 * table préfixe et étaient silencieusement ignorées.
 *
 * Ce test vérifie que la compilation est bien synchro avec la source.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CORE_ROOT = resolve(__dirname, '..');
const DIST_ROOT = join(CORE_ROOT, 'dist');

describe('Anti-régression — dist/ synchronisé avec la source', () => {
  it("l'ancien fichier monolithique commands.js n'existe plus dans dist/", () => {
    // L'ancien système compilait un seul commands.js (53 KB) à la racine de dist/.
    // Le nouveau système compile commands/CommandRegistry.js + commands/categories/*.js.
    expect(existsSync(join(DIST_ROOT, 'commands.js'))).toBe(false);
  });

  it('le nouveau CommandRegistry est bien présent dans dist/', () => {
    expect(existsSync(join(DIST_ROOT, 'commands', 'CommandRegistry.js'))).toBe(true);
    expect(existsSync(join(DIST_ROOT, 'commands', 'index.js'))).toBe(true);
  });

  it("toutes les catégories compilées existent dans dist/commands/categories/", () => {
    const expected = [
      'admin', 'animated', 'autoslash', 'basics', 'clone', 'fun', 'image',
      'info', 'misc', 'notify', 'quest', 'recovery', 'script', 'settings',
      'sniper', 'spotify', 'spy', 'text', 'troll', 'utils', 'voice',
    ];
    for (const cat of expected) {
      expect(
        existsSync(join(DIST_ROOT, 'commands', 'categories', `${cat}.js`)),
        `Catégorie manquante dans dist/ : ${cat}.js`,
      ).toBe(true);
    }
  });

  it('EclipseCore.js compilé utilise CommandRegistry (pas CommandManager)', () => {
    // L'ancien EclipseCore.js instanciait `new CommandManager()` et appelait
    // `commands.js`. Le nouveau appelle `createCommandRegistry()`.
    expect(existsSync(join(DIST_ROOT, 'EclipseCore.js'))).toBe(true);
    const content = require('fs').readFileSync(join(DIST_ROOT, 'EclipseCore.js'), 'utf-8');
    expect(content).toContain('setCommandContext');
    expect(content).toContain('commands/categories');
    expect(content).not.toContain('CommandManager');
  });

  it('DiscordManager.js compilé dispatche via commandRegistry (pas de préfixe-.)', () => {
    expect(existsSync(join(DIST_ROOT, 'discord', 'DiscordManager.js'))).toBe(true);
    const content = require('fs').readFileSync(join(DIST_ROOT, 'discord', 'DiscordManager.js'), 'utf-8');
    // Le nouveau code passe par commandRegistry
    expect(content).toContain('commandRegistry');
    // Pas de dispatcher de commandes préfixe-.
    expect(content).not.toMatch(/message\.content\.startsWith\(/);
    // Pas d'import de l'ancien CommandManager monolithique
    // (le nouveau code require './commands' qui est le dossier commands/, pas l'ancien commands.js)
    expect(content).not.toMatch(/new CommandManager\(/);
  });

  it('dist/ est plus récent que la dernière modification de la source', () => {
    // Soft check : si quelqu'un modifie la source sans recompiler, ce test pète.
    // On tolère un écart de 5 secondes pour les FS avec granularité grossière.
    const srcFiles = [
      join(CORE_ROOT, 'commands', 'CommandRegistry.ts'),
      join(CORE_ROOT, 'commands', 'index.ts'),
      join(CORE_ROOT, 'EclipseCore.ts'),
      join(CORE_ROOT, 'discord', 'DiscordManager.ts'),
    ];
    const distFiles = [
      join(DIST_ROOT, 'commands', 'CommandRegistry.js'),
      join(DIST_ROOT, 'commands', 'index.js'),
      join(DIST_ROOT, 'EclipseCore.js'),
      join(DIST_ROOT, 'discord', 'DiscordManager.js'),
    ];

    for (const f of distFiles) {
      expect(existsSync(f), `dist manquant : ${f} — as-tu lancé 'npx tsc' dans core/?`).toBe(true);
    }

    const maxSrcMtime = Math.max(...srcFiles.map(f => statSync(f).mtimeMs));
    const minDistMtime = Math.min(...distFiles.map(f => statSync(f).mtimeMs));

    // dist/ doit être au moins aussi récent que la source (+5s de tolérance)
    expect(
      minDistMtime + 5000,
      'core/dist/ est plus ancien que core/ — relance `cd core && npx tsc`',
    ).toBeGreaterThanOrEqual(maxSrcMtime);
  });
});
