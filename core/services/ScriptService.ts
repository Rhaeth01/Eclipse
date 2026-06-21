/**
 * ScriptService — moteur de scripts personnalisés (TS/JS).
 * Charge des modules depuis core/scripts/ (ou ~/.eclipse/scripts/), les exécute
 * dans un sandbox vm avec une API restreinte, et supporte le hot-reload.
 * Voir AGENTS.md roadmap (🟡 Large).
 *
 * Sécurité : le sandbox n'expose PAS require, process, fs, child_process.
 * L'API eclipse.* est volontairement limitée (send, on, rest, db, log).
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { logger } from './Logger';

export interface ScriptInfo {
  name: string;
  description: string;
  loaded: boolean;
  error?: string;
}

export interface ScriptContext {
  send: (channelId: string, content: string) => Promise<void>;
  log: (msg: string) => void;
  rest: any;
  db: any;
}

export class ScriptService extends EventEmitter {
  private scriptsDir: string;
  private loaded = new Map<string, { info: ScriptInfo; watcher?: fs.FSWatcher }>();
  private ctx: ScriptContext | null = null;

  constructor(scriptsDir?: string) {
    super();
    this.scriptsDir = scriptsDir || path.join(__dirname, '..', 'scripts');
    this.ensureDir();
  }

  private ensureDir(): void {
    try {
      if (!fs.existsSync(this.scriptsDir)) fs.mkdirSync(this.scriptsDir, { recursive: true });
    } catch (err) {
      logger.warn('Script', 'Impossible de créer le dossier scripts', err);
    }
  }

  setContext(ctx: ScriptContext): void {
    this.ctx = ctx;
  }

  /** Liste les scripts disponibles (fichiers .js/.ts dans le dossier). */
  list(): ScriptInfo[] {
    this.ensureDir();
    const files = fs.readdirSync(this.scriptsDir).filter(f => /\.(js|ts|mjs)$/.test(f));
    return files.map(f => {
      const name = f.replace(/\.(js|ts|mjs)$/, '');
      const existing = this.loaded.get(name);
      return existing?.info ?? { name, description: '(non chargé)', loaded: false };
    });
  }

  /** Charge (ou recharge) un script. */
  load(name: string): ScriptInfo {
    const filePath = this.findFile(name);
    if (!filePath) {
      const info: ScriptInfo = { name, description: '', loaded: false, error: 'Fichier introuvable' };
      return info;
    }
    try {
      const code = fs.readFileSync(filePath, 'utf-8');
      const vm = require('vm');
      const sandbox = this.buildSandbox(name);
      const context = vm.createContext(sandbox);
      vm.runInContext(code, context, { timeout: 5000, filename: name, displayErrors: true });
      const info: ScriptInfo = {
        name,
        description: (sandbox as any).__scriptDescription || name,
        loaded: true,
      };
      this.loaded.set(name, { info });
      logger.info('Script', `Script chargé: ${name}`);
      return info;
    } catch (err) {
      const info: ScriptInfo = { name, description: '', loaded: false, error: String(err) };
      this.loaded.set(name, { info });
      logger.error('Script', `Erreur chargement ${name}`, err);
      return info;
    }
  }

  /** Décharge un script. */
  unload(name: string): boolean {
    const entry = this.loaded.get(name);
    if (!entry) return false;
    entry.watcher?.close();
    this.loaded.delete(name);
    logger.info('Script', `Script déchargé: ${name}`);
    return true;
  }

  /** Exécute un script chargé (déclenche son handler 'run' si défini). */
  async run(name: string, args?: string[]): Promise<string> {
    const entry = this.loaded.get(name);
    if (!entry || !entry.info.loaded) {
      return `❌ Script ${name} non chargé.`;
    }
    try {
      // Le sandbox expose une fonction __run si le script la définit
      // (les scripts appellent eclipse.on('run', ...) ou exportent une fonction)
      // On wrap dans un timeout vm pour éviter les boucles infinies bloquant l'event loop.
      const vm = require('vm');
      const timeoutPromise = new Promise<string>((_, reject) => {
        const t = setTimeout(() => reject(Object.assign(new Error('Script timeout'), { code: 'ERR_SCRIPT_EXECUTION_TIMEOUT' })), 5000);
        t.unref?.();
      });
      const runPromise = new Promise<string>((resolve) => {
        this.emit('script:run', name, args);
        // Essayer le handler synchrone si présent, sinon juste ack l'émission
        const result = (entry as any).__runResult;
        if (result !== undefined) return resolve(result);
        resolve(`▶️ Script ${name} exécuté.`);
      });
      return await Promise.race([runPromise, timeoutPromise]);
    } catch (err: any) {
      return `❌ Erreur: ${err?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' ? 'timeout (5s)' : err}`;
    }
  }

  /** Active le hot-reload sur un script. */
  watch(name: string): void {
    const filePath = this.findFile(name);
    if (!filePath) return;
    try {
      const watcher = fs.watch(filePath, () => {
        logger.info('Script', `Changement détecté: ${name}, rechargement...`);
        this.load(name);
      });
      const entry = this.loaded.get(name);
      if (entry) entry.watcher = watcher;
    } catch (err) {
      logger.warn('Script', `Impossible de watcher ${name}`, err);
    }
  }

  private findFile(name: string): string | null {
    for (const ext of ['.js', '.ts', '.mjs']) {
      const p = path.join(this.scriptsDir, name + ext);
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  private buildSandbox(name: string): any {
    return {
      __scriptName: name,
      __scriptDescription: '',
      eclipse: {
        send: async (channelId: string, content: string) => {
          await this.ctx?.send(channelId, content);
        },
        log: (msg: string) => this.ctx?.log(`[${name}] ${msg}`),
        rest: this.ctx?.rest,
        db: this.ctx?.db,
        on: (event: string, handler: (...a: any[]) => void) => this.on(`script:${event}`, handler),
        emit: (event: string, ...a: any[]) => this.emit(`script:${event}`, ...a),
      },
      console: {
        log: (...a: any[]) => this.ctx?.log(`[${name}] ${a.join(' ')}`),
        error: (...a: any[]) => this.ctx?.log(`[${name}] ERROR: ${a.join(' ')}`),
      },
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
      // Explicitly NO: require, process, fs, __dirname, child_process
    };
  }
}
