/**
 * Service de base de données SQLite
 * Centralise tous les accès à la DB avec typage fort
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import { logger } from './Logger';

export interface FriendRecord {
  id: string;
  username: string;
  updatedAt?: number;
}

export interface GuildRecord {
  id: string;
  name: string;
  updatedAt?: number;
}

export interface CacheComparison<T> {
  added: T[];
  removed: T[];
  unchanged: T[];
}

export class DatabaseService {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(__dirname, '..', 'eclipse_state.db');
  }

  connect(): void {
    try {
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.initTables();
      logger.info('Database', `Connecté à ${this.dbPath}`);
    } catch (err) {
      logger.error('Database', 'Erreur de connexion', err);
      throw err;
    }
  }

  close(): void {
    this.db?.close();
    logger.info('Database', 'Déconnecté');
  }

  private initTables(): void {
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS friends_cache (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch())
      );
      
      CREATE TABLE IF NOT EXISTS guilds_cache (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_friends_updated ON friends_cache(updated_at);
      CREATE INDEX IF NOT EXISTS idx_guilds_updated ON guilds_cache(updated_at);
      
      -- Table pour la persistance d'état
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch())
      );
    `);
  }

  // ============================================================================
  // FRIENDS OPERATIONS
  // ============================================================================

  getFriends(): FriendRecord[] {
    return this.db!.prepare('SELECT id, username FROM friends_cache').all() as FriendRecord[];
  }

  saveFriends(friends: FriendRecord[]): void {
    const insert = this.db!.prepare(
      'INSERT OR REPLACE INTO friends_cache (id, username, updated_at) VALUES (?, ?, unixepoch())'
    );
    
    const transaction = this.db!.transaction((items: FriendRecord[]) => {
      for (const f of items) {
        insert.run(f.id, f.username);
      }
    });

    transaction(friends);
  }

  addFriend(friend: FriendRecord): void {
    this.db!.prepare(
      'INSERT OR REPLACE INTO friends_cache (id, username, updated_at) VALUES (?, ?, unixepoch())'
    ).run(friend.id, friend.username);
  }

  removeFriend(id: string): void {
    this.db!.prepare('DELETE FROM friends_cache WHERE id = ?').run(id);
  }

  clearFriends(): void {
    this.db!.prepare('DELETE FROM friends_cache').run();
  }

  // ============================================================================
  // GUILDS OPERATIONS
  // ============================================================================

  getGuilds(): GuildRecord[] {
    return this.db!.prepare('SELECT id, name FROM guilds_cache').all() as GuildRecord[];
  }

  saveGuilds(guilds: GuildRecord[]): void {
    const insert = this.db!.prepare(
      'INSERT OR REPLACE INTO guilds_cache (id, name, updated_at) VALUES (?, ?, unixepoch())'
    );
    
    const transaction = this.db!.transaction((items: GuildRecord[]) => {
      for (const g of items) {
        insert.run(g.id, g.name);
      }
    });

    transaction(guilds);
  }

  addGuild(guild: GuildRecord): void {
    this.db!.prepare(
      'INSERT OR REPLACE INTO guilds_cache (id, name, updated_at) VALUES (?, ?, unixepoch())'
    ).run(guild.id, guild.name);
  }

  removeGuild(id: string): void {
    this.db!.prepare('DELETE FROM guilds_cache WHERE id = ?').run(id);
  }

  clearGuilds(): void {
    this.db!.prepare('DELETE FROM guilds_cache').run();
  }

  // ============================================================================
  // DIFF OPERATIONS (Pour le tracker offline)
  // ============================================================================

  compareFriends(currentFriends: FriendRecord[]): CacheComparison<FriendRecord> {
    const previous = this.getFriends();
    const previousIds = new Set(previous.map(p => p.id));
    const currentIds = new Set(currentFriends.map(c => c.id));

    return {
      added: currentFriends.filter(c => !previousIds.has(c.id)),
      removed: previous.filter(p => !currentIds.has(p.id)),
      unchanged: currentFriends.filter(c => previousIds.has(c.id))
    };
  }

  compareGuilds(currentGuilds: GuildRecord[]): CacheComparison<GuildRecord> {
    const previous = this.getGuilds();
    const previousIds = new Set(previous.map(p => p.id));
    const currentIds = new Set(currentGuilds.map(c => c.id));

    return {
      added: currentGuilds.filter(c => !previousIds.has(c.id)),
      removed: previous.filter(p => !currentIds.has(p.id)),
      unchanged: currentGuilds.filter(c => previousIds.has(c.id))
    };
  }

  // ============================================================================
  // SYNC OPERATIONS
  // ============================================================================

  syncCache(friends: FriendRecord[], guilds: GuildRecord[]): void {
    const transaction = this.db!.transaction(
      (f: FriendRecord[], g: GuildRecord[]) => {
        // Clear and repopulate
        this.db!.prepare('DELETE FROM friends_cache').run();
        this.db!.prepare('DELETE FROM guilds_cache').run();

        const insertFriend = this.db!.prepare(
          'INSERT INTO friends_cache (id, username, updated_at) VALUES (?, ?, unixepoch())'
        );
        for (const friend of f) {
          insertFriend.run(friend.id, friend.username);
        }

        const insertGuild = this.db!.prepare(
          'INSERT INTO guilds_cache (id, name, updated_at) VALUES (?, ?, unixepoch())'
        );
        for (const guild of g) {
          insertGuild.run(guild.id, guild.name);
        }
      }
    );

    transaction(friends, guilds);
    logger.debug('Database', `Cache synchronisé: ${friends.length} amis, ${guilds.length} serveurs`);
  }
}
