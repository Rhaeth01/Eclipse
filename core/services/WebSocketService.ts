/**
 * Service WebSocket typé et robuste
 * Gère les connexions, la validation des messages, et le heartbeat
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { logger } from './Logger';
import { validateWsMessage } from '../shared/schemas';
import type { ErrorMessage, StatusMessage, ToastMessage, NotificationMessage } from '../shared/types';
import type { ValidatedWsMessage } from '../shared/schemas';

interface WebSocketClient {
  socket: WebSocket;
  id: string;
  connectedAt: Date;
  lastPing: Date;
  isAlive: boolean;
}

export interface WebSocketServiceOptions {
  port: number;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
}

export class WebSocketService extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients = new Map<string, WebSocketClient>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly options: Required<WebSocketServiceOptions>;

  constructor(options: WebSocketServiceOptions) {
    super();
    this.options = {
      port: options.port,
      heartbeatInterval: options.heartbeatInterval ?? 30000,
      heartbeatTimeout: options.heartbeatTimeout ?? 60000
    };
  }

  start(): void {
    this.wss = new WebSocketServer({ port: this.options.port });
    
    logger.info('WebSocket', `Serveur démarré sur ws://localhost:${this.options.port}`);

    this.wss.on('connection', (socket: WebSocket) => {
      this.handleConnection(socket);
    });

    this.wss.on('error', (err) => {
      logger.error('WebSocket', 'Erreur du serveur', err);
      this.emit('error', err);
    });

    // Démarrer le heartbeat
    this.startHeartbeat();
  }

  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
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
      isAlive: true
    };

    this.clients.set(clientId, client);
    logger.info('WebSocket', `Client connecté: ${clientId}`);
    this.emit('clientConnected', clientId);

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

    try {
      const parsed = JSON.parse(data.toString());
      const validation = validateWsMessage(parsed);

      if (!validation.success) {
        const errorStr = (validation as { success: false; error: string }).error;
        logger.warn('WebSocket', `Message invalide de ${clientId}: ${errorStr}`);
        const errorMsg: ErrorMessage = {
          type: 'error',
          message: `Message invalide: ${errorStr}`
        };
        this.sendToClient(clientId, errorMsg);
        return;
      }

      logger.debug('WebSocket', `Message reçu de ${clientId}`, validation.data.type);
      this.emit('message', clientId, validation.data as ValidatedWsMessage);
    } catch (err) {
      logger.error('WebSocket', `Erreur parsing message de ${clientId}`, err);
      const errorMsg: ErrorMessage = {
        type: 'error',
        message: 'Format JSON invalide'
      };
      this.sendToClient(clientId, errorMsg);
    }
  }

  private handleDisconnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      logger.info('WebSocket', `Client déconnecté: ${clientId}`);
      this.emit('clientDisconnected', clientId);
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

  getFirstClientId(): string | null {
    const first = this.clients.keys().next();
    return first.value ?? null;
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
