/**
 * Client REST Discord avec headers officiels et rate limiting intégré.
 * Mime le client desktop Discord (Electron) pour éviter la détection.
 */

import { logger } from "../services/Logger";
import { GatewayProperties } from "./types";

const API_BASE = "https://discord.com/api/v9";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9210 Chrome/134.0.6998.205 Electron/35.3.0 Safari/537.36";

interface RateLimitState {
  remaining: number;
  resetAt: number;
  limit: number;
}

export class DiscordREST {
  private token: string | null = null;
  private properties: GatewayProperties;
  private buckets = new Map<string, RateLimitState>();
  private globalBlockUntil = 0;

  constructor(properties: GatewayProperties) {
    this.properties = properties;
  }

  setToken(token: string): void {
    this.token = token;
  }

  // ==========================================================================
  // HEADERS
  // ==========================================================================

  private get xSuperProperties(): string {
    return Buffer.from(JSON.stringify(this.properties)).toString("base64");
  }

  private getCommonHeaders(): Record<string, string> {
    return {
      "User-Agent": USER_AGENT,
      "Accept": "*/*",
      "Accept-Language": "en-US",
      "X-Super-Properties": this.xSuperProperties,
      "X-Discord-Locale": "en-US",
      "X-Discord-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
      "X-Debug-Options": "bugReporterEnabled",
      "Origin": "https://discord.com",
      "Referer": "https://discord.com/channels/@me",
      "sec-ch-ua": '"Not:A-Brand";v="24", "Chromium";v="134"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
    };
  }

  private getAuthHeaders(): Record<string, string> {
    if (!this.token) throw new Error("Token not set");
    return { Authorization: this.token };
  }

  private headers(): Record<string, string> {
    return { ...this.getCommonHeaders(), ...this.getAuthHeaders() };
  }

  // ==========================================================================
  // RATE LIMIT HANDLING
  // ==========================================================================

  private extractBucketKey(url: string, method: string): string {
    const u = new URL(url);
    const pathParts = u.pathname.split("/").filter(Boolean);
    const normalized = pathParts
      .map((p) => (/^\d{10,}$/.test(p) ? "{id}" : p))
      .join("/");
    return `${method}:${normalized}`;
  }

  private parseRateLimitHeaders(
    bucketKey: string,
    headers: Headers
  ): void {
    const remaining = headers.get("x-ratelimit-remaining");
    const reset = headers.get("x-ratelimit-reset");
    const resetAfter = headers.get("x-ratelimit-reset-after");
    const global = headers.get("x-ratelimit-global");
    const retryAfter = headers.get("retry-after");

    if (global === "true" && retryAfter) {
      this.globalBlockUntil = Date.now() + parseInt(retryAfter) * 1000;
      logger.warn("DiscordREST", `Rate limit global: blocage ${retryAfter}s`);
    }

    if (remaining && (reset || resetAfter)) {
      const resetAt = reset
        ? parseFloat(reset) * 1000
        : Date.now() + parseFloat(resetAfter!) * 1000;
      this.buckets.set(bucketKey, {
        remaining: parseInt(remaining),
        resetAt,
        limit: parseInt(headers.get("x-ratelimit-limit") || "5"),
      });
    }
  }

  private async waitForBucket(bucketKey: string): Promise<void> {
    if (Date.now() < this.globalBlockUntil) {
      const wait = this.globalBlockUntil - Date.now() + 100;
      logger.debug("DiscordREST", `Attente rate limit global: ${wait}ms`);
      await this.sleep(wait);
      return;
    }

    const bucket = this.buckets.get(bucketKey);
    if (bucket && bucket.remaining <= 0 && Date.now() < bucket.resetAt) {
      const wait = bucket.resetAt - Date.now() + 100;
      logger.debug("DiscordREST", `Attente bucket ${bucketKey}: ${wait}ms`);
      await this.sleep(wait);
    }
  }

  // ==========================================================================
  // CORE REQUEST
  // ==========================================================================

  private async request(
    method: string,
    path: string,
    body?: unknown,
    retries = 3
  ): Promise<{ data: any; headers: Headers }> {
    const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
    const bucketKey = this.extractBucketKey(url, method);

    await this.waitForBucket(bucketKey);

    const fetchOptions: RequestInit = {
      method,
      headers: this.headers(),
    };

    if (method !== "GET" && body !== undefined) {
      fetchOptions.body =
        typeof body === "string" ? body : JSON.stringify(body);
      (fetchOptions.headers as Record<string, string>)["Content-Type"] =
        "application/json";
    }

    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (err: any) {
      if (retries > 0) {
        logger.debug("DiscordREST", `Retry fetch: ${err.message}`);
        await this.sleep(1000 + Math.random() * 1000);
        return this.request(method, path, body, retries - 1);
      }
      throw err;
    }

    this.parseRateLimitHeaders(bucketKey, response.headers);

    if (response.status === 429) {
      const retryAfter =
        response.headers.get("retry-after") ||
        response.headers.get("x-ratelimit-reset-after");
      const waitMs = retryAfter
        ? parseFloat(retryAfter) * 1000
        : 5000 + Math.random() * 5000;

      logger.warn("DiscordREST", `429 sur ${method} ${path}, retry dans ${waitMs}ms`);
      await this.sleep(waitMs);

      if (retries > 0) {
        return this.request(method, path, body, retries - 1);
      }
    }

    let data: any = null;
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    const bucket = this.buckets.get(bucketKey);
    if (bucket) {
      bucket.remaining = Math.max(0, bucket.remaining - 1);
    }

    if (!response.ok && response.status !== 429) {
      const err: any = new Error(
        `HTTP ${response.status}: ${JSON.stringify(data).slice(0, 200)}`
      );
      err.status = response.status;
      err.code = response.status;
      throw err;
    }

    return { data, headers: response.headers };
  }

  // ==========================================================================
  // PUBLIC: CHANNELS
  // ==========================================================================

  async fetchChannel(channelId: string): Promise<any> {
    const { data } = await this.request("GET", `/channels/${channelId}`);
    return data;
  }

  async sendMessage(
    channelId: string,
    content: string | { content?: string; tts?: boolean; embeds?: any[] }
  ): Promise<any> {
    const body =
      typeof content === "string"
        ? { content }
        : content;
    const { data } = await this.request(
      "POST",
      `/channels/${channelId}/messages`,
      body
    );
    return data;
  }

  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    await this.request("DELETE", `/channels/${channelId}/messages/${messageId}`);
  }

  async editMessage(
    channelId: string,
    messageId: string,
    content: string
  ): Promise<any> {
    const { data } = await this.request(
      "PATCH",
      `/channels/${channelId}/messages/${messageId}`,
      { content }
    );
    return data;
  }

  async reactMessage(
    channelId: string,
    messageId: string,
    emoji: string
  ): Promise<void> {
    const encoded = encodeURIComponent(emoji);
    await this.request(
      "PUT",
      `/channels/${channelId}/messages/${messageId}/reactions/${encoded}/@me`
    );
  }

  async fetchMessages(
    channelId: string,
    limit: number
  ): Promise<any[]> {
    const { data } = await this.request(
      "GET",
      `/channels/${channelId}/messages?limit=${limit}`
    );
    return Array.isArray(data) ? data : [];
  }

  async fetchMessage(
    channelId: string,
    messageId: string
  ): Promise<any> {
    const { data } = await this.request(
      "GET",
      `/channels/${channelId}/messages/${messageId}`
    );
    return data;
  }

  async sendTyping(channelId: string): Promise<void> {
    await this.request("POST", `/channels/${channelId}/typing`);
  }

  async createWebhook(
    channelId: string,
    name: string,
    avatar: string
  ): Promise<{ id: string; token: string }> {
    const { data } = await this.request(
      "POST",
      `/channels/${channelId}/webhooks`,
      { name, avatar }
    );
    return data;
  }

  async sendWebhook(
    webhookId: string,
    webhookToken: string,
    content: string,
    threadId?: string
  ): Promise<any> {
    const body: any = { content };
    if (threadId) body.thread_id = threadId;
    const { data } = await this.request(
      "POST",
      `/webhooks/${webhookId}/${webhookToken}`,
      body
    );
    return data;
  }

  async deleteWebhook(webhookId: string, webhookToken: string): Promise<void> {
    await this.request("DELETE", `/webhooks/${webhookId}/${webhookToken}`);
  }

  // ==========================================================================
  // PUBLIC: GUILDS
  // ==========================================================================

  async fetchGuilds(): Promise<any[]> {
    const { data } = await this.request("GET", "/users/@me/guilds");
    return Array.isArray(data) ? data : [];
  }

  async fetchMember(guildId: string, userId: string): Promise<any> {
    const { data } = await this.request(
      "GET",
      `/guilds/${guildId}/members/${userId}`
    );
    return data;
  }

  async kickMember(
    guildId: string,
    userId: string,
    reason?: string
  ): Promise<void> {
    const path = `/guilds/${guildId}/members/${userId}`;
    const opts: any = {};
    if (reason) opts["X-Audit-Log-Reason"] = reason;
    await this.request("DELETE", path);
  }

  async banMember(
    guildId: string,
    userId: string,
    reason?: string
  ): Promise<void> {
    const body: any = {};
    if (reason) body.reason = reason;
    await this.request("PUT", `/guilds/${guildId}/bans/${userId}`, body);
  }

  async unbanMember(
    guildId: string,
    userId: string,
    reason?: string
  ): Promise<void> {
    const path = `/guilds/${guildId}/bans/${userId}`;
    await this.request("DELETE", path);
  }

  async fetchGuildChannels(guildId: string): Promise<any[]> {
    const { data } = await this.request("GET", `/guilds/${guildId}/channels`);
    return Array.isArray(data) ? data : [];
  }

  async fetchGuildRoles(guildId: string): Promise<any[]> {
    const { data } = await this.request("GET", `/guilds/${guildId}/roles`);
    return Array.isArray(data) ? data : [];
  }

  async fetchGuildMembers(
    guildId: string,
    limit = 1000
  ): Promise<any[]> {
    const { data } = await this.request(
      "GET",
      `/guilds/${guildId}/members?limit=${limit}`
    );
    return Array.isArray(data) ? data : [];
  }

  // ==========================================================================
  // PUBLIC: USER & RELATIONSHIPS
  // ==========================================================================

  async fetchUserProfile(): Promise<any> {
    const { data } = await this.request("GET", "/users/@me");
    return data;
  }

  async fetchRelationships(): Promise<any[]> {
    const { data } = await this.request("GET", "/users/@me/relationships");
    return Array.isArray(data) ? data : [];
  }

  /** Ajoute un ami (envoie une demande / accepte) via PUT /users/@me/relationships/:id. */
  async addFriend(userId: string): Promise<void> {
    await this.request("PUT", `/users/@me/relationships/${userId}`, {});
  }

  async fetchChannels(): Promise<any[]> {
    const { data } = await this.request(
      "GET",
      "/users/@me/channels"
    );
    return Array.isArray(data) ? data : [];
  }

  // ==========================================================================
  // PUBLIC: DIRECT HTTP (anciens calls selfbot.api.*)
  // ==========================================================================

  async redeemNitro(code: string): Promise<any> {
    const { data } = await this.request(
      "POST",
      `/entitlements/gift-codes/${code}/redeem`,
      { channel_id: null }
    );
    return data;
  }

  async sendInteraction(body: {
    type: number;
    application_id: string;
    guild_id: string;
    channel_id: string;
    session_id: string;
    data: any;
    nonce: string;
  }): Promise<any> {
    const { data } = await this.request("POST", "/interactions", body);
    return data;
  }

  // ==========================================================================
  // PUBLIC: QUESTS
  // ==========================================================================

  async getQuests(): Promise<any> {
    const { data } = await this.request("GET", "/users/@me/quests");
    return data;
  }

  async acceptQuest(questId: string): Promise<any> {
    const { data } = await this.request(
      "POST",
      `/quests/${questId}/accept`
    );
    return data;
  }

  async heartbeatQuest(
    questId: string,
    body: { videoId: string; timestamp: number }
  ): Promise<any> {
    const { data } = await this.request(
      "POST",
      `/quests/${questId}/heartbeat`,
      body
    );
    return data;
  }

  async claimQuestReward(questId: string): Promise<any> {
    const { data } = await this.request(
      "POST",
      `/quests/${questId}/claim_reward`
    );
    return data;
  }

  async createApplication(name: string): Promise<{ id: string; name: string; bot?: { id: string; token?: string } }> {
    const { data } = await this.request(
      "POST",
      "/applications",
      { name }
    );
    return data;
  }

  async createBotForApplication(appId: string): Promise<{ id: string; token: string }> {
    const { data } = await this.request(
      "POST",
      `/applications/${appId}/bot`
    );
    return data;
  }

  async resetBotToken(appId: string): Promise<{ token: string }> {
    const { data } = await this.request(
      "POST",
      `/applications/${appId}/bot/reset`
    );
    return data;
  }

  async getApplication(appId: string): Promise<any> {
    const { data } = await this.request(
      "GET",
      `/applications/${appId}`
    );
    return data;
  }

  async authorizeApplication(appId: string, guildId?: string): Promise<string> {
    const params = new URLSearchParams();
    params.set("client_id", appId);
    params.set("scope", "applications.commands%20bot");
    if (guildId) params.set("guild_id", guildId);
    const url = `https://discord.com/oauth2/authorize?${params.toString()}`;
    return url;
  }

  // ==========================================================================
  // UTILITAIRE
  // ==========================================================================

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
