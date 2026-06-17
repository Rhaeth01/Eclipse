/**
 * Passerelle WebSocket Discord Gateway.
 * Gère la connexion, l'identification, le heartbeat, et le dispatch.
 */

import { WebSocket } from "ws";
import { EventEmitter } from "events";
import { logger } from "../services/Logger";
import { GatewayProperties } from "./types";

const GATEWAY_URL = "wss://gateway.discord.gg";
const GATEWAY_QS = "?v=9&encoding=json";

interface GatewayReadyData {
  user: any;
  session_id: string;
  resume_gateway_url: string;
  guilds: any[];
  [key: string]: any;
}

export class DiscordGateway extends EventEmitter {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private properties: GatewayProperties;
  private heartbeatInterval: number | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastSequence: number | null = null;
  private sessionId: string | null = null;
  private resumeUrl: string | null = null;
  private heartbeatAcked = true;
  private reconnectAttempts = 0;
  private destroyed = false;
  private lastPresenceUpdate = 0;
  private pendingPresence: { activities: any[]; status: string; since?: number } | null = null;
  private presenceFlushTimer: NodeJS.Timeout | null = null;

  constructor(properties: GatewayProperties) {
    super();
    this.properties = properties;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  // ==========================================================================
  // CONNECTION
  // ==========================================================================

  async connect(token: string): Promise<void> {
    this.token = token;
    this.destroyed = false;

    const url = `${GATEWAY_URL}${GATEWAY_QS}`;
    logger.info("DiscordGateway", `Connexion à ${url}`);

    this.ws = new WebSocket(url);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Gateway connection timeout"));
      }, 30000);

      this.ws!.on("open", () => {
        clearTimeout(timeout);
        logger.info("DiscordGateway", "WebSocket ouvert, attente du Hello...");
      });

      this.ws!.on("message", (data: Buffer) => {
        try {
          const payload = JSON.parse(data.toString());
          this.handlePacket(payload, resolve, reject);
        } catch {
          // non-JSON frame, ignore
        }
      });

      this.ws!.on("close", (code, reason) => {
        clearTimeout(timeout);
        this.handleClose(code, reason);
        if (this.reconnectAttempts === 0) {
          reject(new Error(`Gateway closed: ${code}`));
        }
      });

      this.ws!.on("error", (err) => {
        clearTimeout(timeout);
        logger.error("DiscordGateway", "WebSocket error", err);
        reject(err);
      });
    });
  }

  // ==========================================================================
  // PACKET HANDLING
  // ==========================================================================

  private handlePacket(
    payload: any,
    resolve?: (value: void) => void,
    reject?: (err: Error) => void
  ): void {
    const { op, d, s, t } = payload;

    if (s) {
      this.lastSequence = s;
    }

    switch (op) {
      case 0: // Dispatch
        this.handleDispatch(t, d);
        break;

      case 1: // Heartbeat (server asks)
        this.sendHeartbeat();
        break;

      case 7: // Reconnect
        logger.info("DiscordGateway", "Serveur demande reconnexion");
        this.reconnect();
        break;

      case 9: // Invalid Session
        if (d === true) {
          logger.info("DiscordGateway", "Session invalide, tentative resume");
          this.resume();
        } else {
          logger.info("DiscordGateway", "Session invalide, re-identify");
          this.sessionId = null;
          this.reconnect();
        }
        break;

      case 10: // Hello
        this.heartbeatInterval = d.heartbeat_interval;
        logger.info(
          "DiscordGateway",
          `Hello reçu, heartbeat: ${this.heartbeatInterval}ms`
        );
        this.startHeartbeat();
        this.identify();
        break;

      case 11: // Heartbeat ACK
        this.heartbeatAcked = true;
        break;

      default:
        logger.debug("DiscordGateway", `Opcode inconnu: ${op}`);
    }
  }

  // ==========================================================================
  // IDENTIFY
  // ==========================================================================

  private identify(): void {
    if (!this.token) return;

    const payload = {
      op: 2,
      d: {
        token: this.token,
        intents: 3276799, // All intents
        properties: this.properties,
        presence: {
          status: "online",
          since: 0,
          activities: [],
          afk: false,
        },
      },
    };

    this.send(payload);
  }

  // ==========================================================================
  // HEARTBEAT
  // ==========================================================================

  private startHeartbeat(): void {
    if (!this.heartbeatInterval) return;

    this.stopHeartbeat();

    const jitter = this.heartbeatInterval * (0.8 + Math.random() * 0.4);
    this.heartbeatTimer = setTimeout(() => {
      this.sendHeartbeat();
      if (this.heartbeatInterval) {
        this.heartbeatTimer = setInterval(() => {
          this.sendHeartbeat();
        }, this.heartbeatInterval!);
      }
    }, jitter);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private sendHeartbeat(): void {
    if (!this.heartbeatAcked) {
      logger.warn("DiscordGateway", "Heartbeat zombie détecté, reconnexion");
      this.destroy(true);
      this.reconnect();
      return;
    }

    this.heartbeatAcked = false;
    this.send({ op: 1, d: this.lastSequence });
  }

  // ==========================================================================
  // DISPATCH EVENTS
  // ==========================================================================

  private handleDispatch(event: string, data: any): void {
    switch (event) {
      case "READY":
        this.sessionId = data.session_id;
        this.resumeUrl = data.resume_gateway_url;
        this.reconnectAttempts = 0;
        this.emit("gateway:ready", data);
        break;

      case "RESUMED":
        this.reconnectAttempts = 0;
        logger.info("DiscordGateway", "Session résumée");
        break;

      case "MESSAGE_CREATE":
        this.emit("gateway:messageCreate", data);
        break;

      case "MESSAGE_UPDATE":
        this.emit("gateway:messageUpdate", data);
        break;

      case "MESSAGE_DELETE":
        this.emit("gateway:messageDelete", data);
        break;

      case "MESSAGE_DELETE_BULK":
        for (const id of data.ids || []) {
          this.emit("gateway:messageDelete", { ...data, id, channel_id: data.channel_id, guild_id: data.guild_id });
        }
        break;

      case "VOICE_STATE_UPDATE":
        this.emit("gateway:voiceStateUpdate", data);
        break;

      case "GUILD_CREATE":
        this.emit("gateway:guildCreate", data);
        break;

      case "GUILD_DELETE":
        this.emit("gateway:guildDelete", data);
        break;

      case "GUILD_MEMBER_UPDATE":
        this.emit("gateway:guildMemberUpdate", data);
        break;

      case "RELATIONSHIP_ADD":
        this.emit("gateway:relationshipAdd", data);
        break;

      case "RELATIONSHIP_REMOVE":
        this.emit("gateway:relationshipRemove", data);
        break;
    }
  }

  // ==========================================================================
  // RESUME
  // ==========================================================================

  private resume(): void {
    if (!this.token || !this.sessionId || !this.ws) return;

    this.send({
      op: 6,
      d: {
        token: this.token,
        session_id: this.sessionId,
        seq: this.lastSequence,
      },
    });
  }

  // ==========================================================================
  // RECONNECTION
  // ==========================================================================

  private async reconnect(): Promise<void> {
    if (this.destroyed || !this.token) return;

    this.reconnectAttempts++;
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      60000
    );
    const jitter = Math.random() * delay * 0.3;
    const wait = delay + jitter;

    logger.info(
      "DiscordGateway",
      `Reconnexion dans ${Math.floor(wait)}ms (tentative ${this.reconnectAttempts})`
    );

    await new Promise((r) => setTimeout(r, wait));

    try {
      this.stopHeartbeat();
      this.ws?.removeAllListeners();
      this.ws?.close(4000);

      const url = this.resumeUrl
        ? `${this.resumeUrl}${GATEWAY_QS}`
        : `${GATEWAY_URL}${GATEWAY_QS}`;

      this.ws = new WebSocket(url);
      this.heartbeatAcked = true;

      this.ws.on("message", (data: Buffer) => {
        try {
          const payload = JSON.parse(data.toString());
          this.handlePacket(payload);
        } catch { /* skip non-JSON */ }
      });

      this.ws.on("close", (code, reason) => {
        this.handleClose(code, reason);
      });

      this.ws.on("error", (err) => {
        logger.error("DiscordGateway", "Reconnect error", err);
      });
    } catch (err) {
      logger.error("DiscordGateway", "Reconnect failed", err);
      if (!this.destroyed) {
        this.reconnect();
      }
    }
  }

  // ==========================================================================
  // CLOSE HANDLER
  // ==========================================================================

  private handleClose(code: number, reason: Buffer): void {
    logger.info(
      "DiscordGateway",
      `Fermé: code ${code}, raison: ${reason.toString()}`
    );

    this.stopHeartbeat();

    const cleanClose = code === 1000 || code === 1001;
    if (!this.destroyed && !cleanClose) {
      this.reconnect();
    }
  }

  // ==========================================================================
  // SEND (with gateway rate limit awareness)
  // ==========================================================================

  send(payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn("DiscordGateway", "Tentative d'envoi sur WS fermé");
      return;
    }

    const raw = JSON.stringify(payload);
    if (raw.length > 4096) {
      logger.error("DiscordGateway", `Payload trop grand: ${raw.length} octets`);
      return;
    }

    this.ws.send(raw);
  }

  // ==========================================================================
  // PRESENCE UPDATE (throttled)
  // ==========================================================================

  sendPresenceUpdate(
    activities: any[],
    status: string,
    since?: number
  ): void {
    // Garder toujours la dernière présence demandée. Si on est sous le throttle
    // de 15s, on programme un flush pour l'appliquer dès que possible.
    this.pendingPresence = { activities, status, since };
    this.schedulePresenceFlush();
  }

  private schedulePresenceFlush(): void {
    if (this.presenceFlushTimer) return; // déjà programmé
    if (this.destroyed) return;

    const delay = Math.max(0, 15000 - (Date.now() - this.lastPresenceUpdate));
    this.presenceFlushTimer = setTimeout(() => this.flushPresence(), delay);
  }

  private flushPresence(): void {
    this.presenceFlushTimer = null;
    if (this.destroyed || !this.pendingPresence) return;

    const { activities, status, since } = this.pendingPresence;
    this.pendingPresence = null;
    this.lastPresenceUpdate = Date.now();

    this.send({
      op: 3,
      d: {
        since: since ?? 0,
        activities,
        status,
        afk: false,
      },
    });
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  destroy(reset = false): void {
    this.destroyed = true;
    this.stopHeartbeat();

    if (this.presenceFlushTimer) {
      clearTimeout(this.presenceFlushTimer);
      this.presenceFlushTimer = null;
    }
    this.pendingPresence = null;

    if (this.ws) {
      this.ws.removeAllListeners();
      if (reset) {
        this.ws.close(4000);
      } else {
        this.ws.close(1000, "Client destroyed");
      }
      this.ws = null;
    }
  }
}
