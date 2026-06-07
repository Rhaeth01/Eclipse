/**
 * Utilitaires pour parser les headers de rate limit Discord
 * 
 * Discord envoie ces headers sur les réponses API:
 * - X-RateLimit-Limit: Nombre max de requêtes
 * - X-RateLimit-Remaining: Requêtes restantes dans la fenêtre
 * - X-RateLimit-Reset: Timestamp Unix quand la fenêtre reset
 * - X-RateLimit-Reset-After: Secondes jusqu'au reset
 * - X-RateLimit-Bucket: ID du bucket (pour debug)
 * - X-RateLimit-Global: "true" si c'est un rate limit global
 * - Retry-After: Millisecondes à attendre (sur 429)
 */

export interface ParsedRateLimitHeaders {
  limit: number;
  remaining: number;
  resetAt: number;        // Timestamp Unix ms
  resetAfter: number;     // Secondes
  bucket?: string;
  isGlobal: boolean;
  retryAfter?: number;    // Présent uniquement sur 429
}

/**
 * Parse les headers de rate limit depuis une réponse fetch/axios
 */
export function parseRateLimitHeaders(
  headers: Headers | Record<string, string | string[] | undefined>
): ParsedRateLimitHeaders | null {
  const getHeader = (name: string): string | undefined => {
    if (headers instanceof Headers) {
      return headers.get(name) || undefined;
    }
    const val = headers[name.toLowerCase()];
    if (Array.isArray(val)) return val[0];
    return val;
  };

  const limit = getHeader('x-ratelimit-limit');
  const remaining = getHeader('x-ratelimit-remaining');
  const reset = getHeader('x-ratelimit-reset');
  const resetAfter = getHeader('x-ratelimit-reset-after');
  const bucket = getHeader('x-ratelimit-bucket');
  const global = getHeader('x-ratelimit-global');
  const retryAfter = getHeader('retry-after');

  // Au moins limit et remaining doivent être présents
  if (!limit || !remaining) {
    return null;
  }

  return {
    limit: parseInt(limit),
    remaining: parseInt(remaining),
    resetAt: reset ? parseFloat(reset) * 1000 : Date.now() + (parseFloat(resetAfter || '0') * 1000),
    resetAfter: resetAfter ? parseFloat(resetAfter) : parseFloat(reset || '0') - Date.now() / 1000,
    bucket,
    isGlobal: global === 'true',
    retryAfter: retryAfter ? parseInt(retryAfter) : undefined
  };
}

/**
 * Vérifie si une erreur est un rate limit Discord
 */
export function isRateLimitError(error: any): boolean {
  return error?.status === 429 || 
         error?.code === 429 || 
         error?.httpStatus === 429 ||
         error?.message?.includes('rate limit');
}

/**
 * Extrait le retry-after d'une erreur 429
 * Retourne null si pas trouvé
 */
export function getRetryAfterFromError(error: any): number | null {
  if (!isRateLimitError(error)) return null;
  
  // Retry-after peut être dans plusieurs endroits
  const retryAfter = error?.headers?.['retry-after'] || 
                     error?.retryAfter || 
                     error?.retry_after;
  
  if (retryAfter) {
    // Discord envoie parfois en secondes, parfois en millisecondes
    const num = parseInt(retryAfter);
    return num > 10000 ? num : num * 1000; // Si > 10000, c'est probablement déjà des ms
  }
  
  return null;
}
