/**
 * Service WebSocket typé et robuste
 * Gère les connexions, la validation des messages, et le heartbeat
 *
 * v0.4.0: authentification par secret partagé. Chaque nouvelle connexion
 * doit envoyer un message { type: 'auth', secret: '...' } dans les 5 secondes
 * avec le secret généré par Rust (ws_secret.bin). Les connexions non
 * authentifiées sont immédiatement fermées.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { logger } from './Logger';
import { validateWsMessage } from '../shared/schemas';
import type { ErrorMessage, StatusMessage, ToastMessage, NotificationMessage } from '../shared/types';
import type { ValidatedWsMessage } from '../shared/schemas';

const DEFAULT_AUTH_TIMEOUT_MS = 5000;

interface WebSocketClient {
  socket: WebSocket;
  id: string;
  connectedAt: Date;
  lastPing: Date;
  isAlive: boolean;
  authenticated: boolean;
}

export interface WebSocketServiceOptions {
  port: number;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  expectedSecret?: string;
  authTimeoutMs?: number;
  authCheckIntervalMs?: number;
}

export class WebSocketService extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients = new Map<string, WebSocketClient>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private authCheckTimer: NodeJS.Timeout | null = null;
  private readonly options: Required<WebSocketServiceOptions>;
  private expectedSecret: string | null = null;

  constructor(options: WebSocketServiceOptions) {
    super();
    this.options = {
      port: options.port,
      heartbeatInterval: options.heartbeatInterval ?? 30000,
      heartbeatTimeout: options.heartbeatTimeout ?? 60000,
      expectedSecret: options.expectedSecret ?? '',
      authTimeoutMs: options.authTimeoutMs ?? DEFAULT_AUTH_TIMEOUT_MS,
      authCheckIntervalMs: options.authCheckIntervalMs ?? 1000
    };
  }

  setExpectedSecret(secret: string): void {
    this.expectedSecret = secret;
    logger.debug('WebSocket', 'Secret WS configuré');
  }

  start(): void {
    this.wss = new WebSocketServer({ port: this.options.port });

    logger.info('WebSocket', `Serveur démarré sur ws://localhost:${this.options.port}` + (this.expectedSecret ? ' (auth requise)' : ' (SANS AUTH - mode dev)'));

    this.wss.on('connection', (socket: WebSocket) => {
      this.handleConnection(socket);
    });

    this.wss.on('error', (err) => {
      logger.error('WebSocket', 'Erreur du serveur', err);
      this.emit('error', err);
    });

    // Timer qui ferme les connexions non authentifiées
    this.authCheckTimer = setInterval(() => {
      const now = Date.now();
      this.clients.forEach((client, id) => {
        if (!client.authenticated && now - client.connectedAt.getTime() > this.options.authTimeoutMs) {
          logger.warn('WebSocket', `Client ${id} non authentifié après ${this.options.authTimeoutMs}ms, fermeture`);
          client.socket.close(4001, 'Auth timeout');
          this.clients.delete(id);
        }
      });
    }, this.options.authCheckIntervalMs);

    // Démarrer le heartbeat
    this.startHeartbeat();
  }

  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.authCheckTimer) {
      clearInterval(this.authCheckTimer);
      this.authCheckTimer = null;
    }

    this.clients.forEach((client) => {
      client.socket.close();
    });
    this.clients.clear();

    this.wss?.close(() => {
      logger.info('WebSocket', 'Serveur arrêté');
    });
  }

  private handleConnection(socket: WebSocket): void {
    const clientId = this.generateClientId();
    const client: WebSocketClient = {
      socket,
      id: clientId,
      connectedAt: new Date(),
      lastPing: new Date(),
      isAlive: true,
      authenticated: !this.expectedSecret // si pas de secret configuré, on accepte tout (dev mode)
    };

    this.clients.set(clientId, client);
    logger.info('WebSocket', `Client connecté: ${clientId} (en attente d'auth: ${!!this.expectedSecret})`);

    // Si pas de secret configuré (mode dev), émet l'event immédiatement
    if (!this.expectedSecret) {
      this.emit('clientConnected', clientId);
    }

    // Intercepter send pour ajouter le timestamp
    const originalSend = socket.send.bind(socket);
    socket.send = (data: string | Buffer) => {
      try {
        const parsed = JSON.parse(data.toString());
        parsed.timestamp = Date.now();
        return originalSend(JSON.stringify(parsed));
      } catch {
        return originalSend(data);
      }
    };

    socket.on('message', (data: Buffer) => {
      this.handleMessage(clientId, data);
    });

    socket.on('pong', () => {
      const c = this.clients.get(clientId);
      if (c) {
        c.isAlive = true;
        c.lastPing = new Date();
      }
    });

    socket.on('close', () => {
      this.handleDisconnection(clientId);
    });

    socket.on('error', (err) => {
      logger.error('WebSocket', `Erreur client ${clientId}`, err);
      this.emit('clientError', clientId, err);
    });
  }

  private handleMessage(clientId: string, data: Buffer): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    let parsed: any;
    try {
      parsed = JSON.parse(data.toString());
    } catch (err) {
      logger.error('WebSocket', `Erreur parsing message de ${clientId}`, err);
      this.sendToClient(clientId, { type: 'error', message: 'Format JSON invalide' } as ErrorMessage);
      return;
    }

    // Auth gate: le premier message valide d'un nouveau client doit être { type: 'auth', secret: '...' }
    if (this.expectedSecret && !client.authenticated) {
      if (parsed?.type === 'auth' && typeof parsed.secret === 'string' && parsed.secret === this.expectedSecret) {
        client.authenticated = true;
        logger.info('WebSocket', `Client ${clientId} authentifié`);
        this.sendToClient(clientId, { type: 'status', message: 'authenticated' } as StatusMessage);
        this.emit('clientConnected', clientId);
        return;
      } else {
        logger.warn('WebSocket', `Client ${clientId} auth échouée, fermeture`);
        client.socket.close(4001, 'Auth failed');
        this.clients.delete(clientId);
        return;
      }
    }

    // À partir d'ici, le client est authentifié (ou pas de secret configuré)
    const validation = validateWsMessage(parsed);
    if (!validation.success) {
      const errorStr = (validation as { success: false; error: string }).error;
      logger.warn('WebSocket', `Message invalide de ${clientId}: ${errorStr}`);
      this.sendToClient(clientId, { type: 'error', message: `Message invalide: ${errorStr}` } as ErrorMessage);
      return;
    }

    logger.debug('WebSocket', `Message reçu de ${clientId}`, validation.data.type);
    this.emit('message', clientId, validation.data as ValidatedWsMessage);
  }

  private handleDisconnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      logger.info('WebSocket', `Client déconnecté: ${clientId} (auth=${client.authenticated})`);
      if (client.authenticated) {
        this.emit('clientDisconnected', clientId);
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.clients.forEach((client, id) => {
        if (!client.isAlive) {
          logger.warn('WebSocket', `Client ${id} non réactif, fermeture`);
          client.socket.terminate();
          this.clients.delete(id);
          return;
        }

        client.isAlive = false;
        client.socket.ping();
      });
    }, this.options.heartbeatInterval);
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  sendToClient(clientId: string, message: any): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.socket.send(JSON.stringify(message));
      return true;
    } catch (err) {
      logger.error('WebSocket', `Erreur envoi à ${clientId}`, err);
      return false;
    }
  }

  broadcast(message: any): void {
    const data = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.socket.readyState === WebSocket.OPEN) {
        try {
          client.socket.send(data);
        } catch (err) {
          logger.error('WebSocket', `Erreur broadcast à ${client.id}`, err);
        }
      }
    });
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getAuthenticatedClientCount(): number {
    let n = 0;
    this.clients.forEach((c) => { if (c.authenticated) n++; });
    return n;
  }

  getFirstClientId(): string | null {
    for (const [id, c] of this.clients) {
      if (c.authenticated) return id;
    }
    return null;
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
