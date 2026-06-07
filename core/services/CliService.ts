/**
 * Service CLI pour le debugging et monitoring
 * Accessible en mode headless ou via des commandes WS
 */

import { createInterface } from 'readline';
import { logger } from './Logger';
import { rateLimiter } from './RateLimiter';
import { WebSocketService } from './WebSocketService';

export interface CliCommand {
  name: string;
  description: string;
  execute: (args: string[]) => Promise<string>;
}

export class CliService {
  private wsService?: WebSocketService;
  private commands = new Map<string, CliCommand>();
  private rl?: ReturnType<typeof createInterface>;

  constructor(wsService?: WebSocketService) {
    this.wsService = wsService;
    this.registerCommands();
  }

  startInteractive(): void {
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'eclipse> '
    });

    this.rl.prompt();

    this.rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (trimmed) {
        const result = await this.executeCommand(trimmed);
        console.log(result);
      }
      this.rl?.prompt();
    });

    this.rl.on('close', () => {
      console.log('\nAu revoir!');
      process.exit(0);
    });

    console.log('=== Eclipse Core CLI ===');
    console.log('Tapez "help" pour la liste des commandes\n');
  }

  stop(): void {
    this.rl?.close();
  }

  async executeCommand(input: string): Promise<string> {
    const [cmd, ...args] = input.split(' ');
    const command = this.commands.get(cmd.toLowerCase());

    if (!command) {
      return `Commande inconnue: ${cmd}. Tapez "help" pour la liste.`;
    }

    try {
      return await command.execute(args);
    } catch (err) {
      return `Erreur: ${err instanceof Error ? err.message : 'Unknown'}`;
    }
  }

  private registerCommands(): void {
    this.commands.set('help', {
      name: 'help',
      description: 'Affiche la liste des commandes',
      execute: async () => {
        const lines = ['Commandes disponibles:'];
        for (const [name, cmd] of this.commands) {
          lines.push(`  ${name.padEnd(15)} ${cmd.description}`);
        }
        return lines.join('\n');
      }
    });

    this.commands.set('status', {
      name: 'status',
      description: 'Affiche le statut du système',
      execute: async () => {
        const memUsage = process.memoryUsage();
        const lines = [
          '=== Statut ===',
          `Mémoire:`,
          `  RSS: ${Math.round(memUsage.rss / 1024 / 1024)} MB`,
          `  Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)} / ${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
          `WebSocket: ${this.wsService?.getClientCount() || 0} clients connectés`,
        ];
        return lines.join('\n');
      }
    });

    this.commands.set('ratelimit', {
      name: 'ratelimit',
      description: 'Affiche le statut des rate limits Discord',
      execute: async () => {
        const buckets = rateLimiter.getStatus();
        if (buckets.length === 0) {
          return 'Aucun bucket de rate limit connu (pas encore d\'appels API)';
        }

        const lines = ['=== Rate Limits ==='];
        for (const bucket of buckets) {
          const resetInSecs = Math.ceil(bucket.resetIn / 1000);
          lines.push(`${bucket.endpoint}:`);
          lines.push(`  ${bucket.remaining}/${bucket.limit} restants`);
          lines.push(`  Reset dans ${resetInSecs}s`);
        }
        return lines.join('\n');
      }
    });

    this.commands.set('logs', {
      name: 'logs',
      description: 'Affiche les derniers logs (logs [level] [limit])',
      execute: async (args) => {
        const level = args[0] as any;
        const limit = parseInt(args[1]) || 20;
        const logs = logger.getLogs(level, limit);
        
        if (logs.length === 0) return 'Aucun log';

        return logs.map(l => {
          const time = l.timestamp.toISOString().split('T')[1].split('.')[0];
          return `[${time}] [${l.level.toUpperCase()}] [${l.module}] ${l.message}`;
        }).join('\n');
      }
    });

    this.commands.set('spy', {
      name: 'spy',
      description: 'Liste les cibles spy (spy list)',
      execute: async (args) => {
        // Cette commande nécessiterait l'accès au SpyService
        // Pour l'instant c'est un placeholder
        return 'Commande spy: utiliser via l\'interface web pour l\'instant';
      }
    });

    this.commands.set('clear', {
      name: 'clear',
      description: 'Efface la console',
      execute: async () => {
        console.clear();
        return '';
      }
    });

    this.commands.set('exit', {
      name: 'exit',
      description: 'Arrête le core',
      execute: async () => {
        process.exit(0);
        return '';
      }
    });
  }
}
