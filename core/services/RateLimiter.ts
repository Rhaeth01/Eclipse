/**
 * Service de Rate Limiting Intelligent pour Discord
 * Respecte les headers X-RateLimit et implémente le backoff exponentiel
 */

import { logger } from './Logger';

interface RateLimitBucket {
  limit: number;
  remaining: number;
  resetAt: number;
  resetAfter: number;
  retryAfter?: number;
  isGlobal: boolean;
}

interface QueueItem {
  id: string;
  endpoint: string;
  execute: () => Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
  priority: number;
  retries: number;
  addedAt: number;
}

interface RateLimiterOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  defaultLimit?: number;
}

/**
 * RateLimiter gère les quotas Discord de manière intelligente
 * 
 * Features:
 * - Parsing des headers X-RateLimit-*
 * - Buckets par endpoint (channels/, guilds/, etc.)
 * - File d'attente prioritaire
 * - Backoff exponentiel sur 429
 * - Détection des rate limits globaux
 */
export class RateLimiter {
  private buckets = new Map<string, RateLimitBucket>();
  private queues = new Map<string, QueueItem[]>();
  private processing = new Set<string>();
  private globalBlockUntil = 0;
  
  private readonly maxRetries: number;
  private readonly baseDelay: number;
  private readonly maxDelay: number;
  private readonly defaultLimit: number;

  constructor(options: RateLimiterOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.baseDelay = options.baseDelay ?? 1000;
    this.maxDelay = options.maxDelay ?? 60000;
    this.defaultLimit = options.defaultLimit ?? 5;
  }

  /**
   * Exécute une fonction en respectant les rate limits
   * 
   * @param endpoint - L'endpoint Discord (ex: "channels/123/messages")
   * @param execute - La fonction à exécuter
   * @param priority - Priorité (1-10, 10 = plus prioritaire)
   * @returns Promise<void>
   */
  async schedule<T>(
    endpoint: string, 
    execute: () => Promise<T>, 
    priority = 5
  ): Promise<T> {
    const bucketKey = this.extractBucketKey(endpoint);
    
    return new Promise((resolve, reject) => {
      const item: QueueItem = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        endpoint: bucketKey,
        execute: async () => {
          try {
            const result = await execute();
            resolve(result);
          } catch (err) {
            reject(err as Error);
          }
        },
        resolve: () => {}, // Pas utilisé directement
        reject: () => {},
        priority,
        retries: 0,
        addedAt: Date.now()
      };

      this.enqueue(bucketKey, item);
      this.processQueue(bucketKey);
    });
  }

  /**
   * Met à jour les infos de rate limit depuis les headers Discord
   * 
   * @param endpoint - L'endpoint appelé
   * @param headers - Les headers de réponse HTTP
   */
  updateFromHeaders(endpoint: string, headers: Record<string, string>): void {
    const bucketKey = this.extractBucketKey(endpoint);
    
    const limit = headers['x-ratelimit-limit'];
    const remaining = headers['x-ratelimit-remaining'];
    const reset = headers['x-ratelimit-reset'];
    const resetAfter = headers['x-ratelimit-reset-after'];
    const retryAfter = headers['retry-after'];
    const global = headers['x-ratelimit-global'];

    // Rate limit global
    if (global === 'true' && retryAfter) {
      this.globalBlockUntil = Date.now() + parseInt(retryAfter) * 1000;
      logger.warn('RateLimiter', `Rate limit global détecté, blocage pendant ${retryAfter}s`);
      return;
    }

    // Si on a un retry-after (429), on met à jour le bucket
    if (retryAfter) {
      const existing = this.buckets.get(bucketKey);
      if (existing) {
        existing.retryAfter = parseInt(retryAfter);
      }
    }

    // Mise à jour normale du bucket
    if (limit && remaining && (reset || resetAfter)) {
      const bucket: RateLimitBucket = {
        limit: parseInt(limit),
        remaining: parseInt(remaining),
        resetAt: reset ? parseFloat(reset) * 1000 : Date.now() + parseFloat(resetAfter!) * 1000,
        resetAfter: resetAfter ? parseFloat(resetAfter) : parseFloat(reset!) - Date.now() / 1000,
        isGlobal: false
      };

      this.buckets.set(bucketKey, bucket);
      logger.debug('RateLimiter', `Bucket ${bucketKey}: ${remaining}/${limit} restants`);
    }
  }

  /**
   * Signale un 429 (Too Many Requests) pour un endpoint
   * Déclenche le backoff exponentiel
   */
  reportRateLimit(endpoint: string, retryAfterMs?: number): void {
    const bucketKey = this.extractBucketKey(endpoint);
    const bucket = this.buckets.get(bucketKey);

    if (bucket) {
      bucket.remaining = 0;
      if (retryAfterMs) {
        bucket.resetAt = Date.now() + retryAfterMs;
      }
    }

    logger.warn('RateLimiter', `429 reçu sur ${bucketKey}, retry after: ${retryAfterMs}ms`);
  }

  /**
   * Retourne l'état actuel des buckets (pour debug/monitoring)
   */
  getStatus(): Array<{ endpoint: string; remaining: number; limit: number; resetIn: number }> {
    const now = Date.now();
    return Array.from(this.buckets.entries()).map(([endpoint, bucket]) => ({
      endpoint,
      remaining: bucket.remaining,
      limit: bucket.limit,
      resetIn: Math.max(0, bucket.resetAt - now)
    }));
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private extractBucketKey(endpoint: string): string {
    // Normalise l'endpoint pour le bucket
    // Ex: "channels/123456789/messages" → "channels/{id}/messages"
    // Ex: "guilds/123456789/members" → "guilds/{id}/members"
    
    const parts = endpoint.split('/').filter(p => p);
    
    // Remplace les IDs numériques par {id}
    const normalized = parts.map(part => {
      if (/^\d{10,}$/.test(part)) return '{id}';
      return part;
    }).join('/');

    return normalized || 'global';
  }

  private enqueue(bucketKey: string, item: QueueItem): void {
    let queue = this.queues.get(bucketKey);
    if (!queue) {
      queue = [];
      this.queues.set(bucketKey, queue);
    }

    // Insertion par priorité (tri décroissant)
    const insertIndex = queue.findIndex(i => i.priority < item.priority);
    if (insertIndex === -1) {
      queue.push(item);
    } else {
      queue.splice(insertIndex, 0, item);
    }

    logger.debug('RateLimiter', `Item ${item.id} enqueued sur ${bucketKey} (prio: ${item.priority})`);
  }

  private async processQueue(bucketKey: string): Promise<void> {
    // Évite le traitement parallèle du même bucket
    if (this.processing.has(bucketKey)) return;
    
    const queue = this.queues.get(bucketKey);
    if (!queue || queue.length === 0) return;

    this.processing.add(bucketKey);

    try {
      while (queue.length > 0) {
        // Vérifie le rate limit global
        if (Date.now() < this.globalBlockUntil) {
          const waitTime = this.globalBlockUntil - Date.now();
          logger.debug('RateLimiter', `Attente rate limit global: ${waitTime}ms`);
          await this.sleep(waitTime);
          continue;
        }

        // Vérifie le bucket spécifique
        const bucket = this.buckets.get(bucketKey);
        if (bucket && bucket.remaining <= 0 && Date.now() < bucket.resetAt) {
          const waitTime = bucket.resetAt - Date.now();
          logger.debug('RateLimiter', `Attente bucket ${bucketKey}: ${waitTime}ms`);
          await this.sleep(waitTime);
          continue;
        }

        // Décrémente le compteur
        if (bucket) {
          bucket.remaining--;
        }

        // Traite l'item
        const item = queue.shift()!;
        await this.executeItem(item, bucketKey);
      }
    } finally {
      this.processing.delete(bucketKey);
    }
  }

  private async executeItem(item: QueueItem, bucketKey: string): Promise<void> {
    try {
      logger.debug('RateLimiter', `Exécution ${item.id} sur ${bucketKey}`);
      await item.execute();
    } catch (err: any) {
      // Si c'est un 429, on retry
      if (err?.status === 429 || err?.code === 429) {
        if (item.retries < this.maxRetries) {
          item.retries++;
          const delay = this.calculateBackoff(item.retries);
          
          logger.warn('RateLimiter', `Retry ${item.retries}/${this.maxRetries} pour ${item.id} après ${delay}ms`);
          
          await this.sleep(delay);
          this.enqueue(bucketKey, item);
          return;
        }
      }
      
      // Sinon, on propage l'erreur
      throw err;
    }
  }

  private calculateBackoff(retryCount: number): number {
    // Backoff exponentiel avec jitter
    const exponential = Math.min(
      this.baseDelay * Math.pow(2, retryCount),
      this.maxDelay
    );
    const jitter = Math.random() * 1000;
    return exponential + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton export
export const rateLimiter = new RateLimiter({
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000
});
