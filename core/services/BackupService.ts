/**
 * Service de sauvegarde des données Discord
 * Clone le compte utilisateur (amis, serveurs, groupes DM)
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DiscordUserClient } from '../discord';
import { logger } from './Logger';

export interface BackupData {
  metadata: {
    userId: string;
    username: string;
    createdAt: string;
    version: string;
  };
  friends: Array<{
    id: string;
    username: string;
    avatar?: string;
  }>;
  guilds: Array<{
    id: string;
    name: string;
    icon?: string;
    ownerId: string;
    memberCount?: number;
  }>;
  channels: Array<{
    id: string;
    type: string;
    name?: string;
    recipients?: string[];
  }>;
}

export interface BackupResult {
  filePath: string;
  data: BackupData;
}

export class BackupService {
  private backupDir: string;

  constructor(backupDir?: string) {
    this.backupDir = backupDir || path.join(__dirname, '..', 'backups');
    try {
      this.ensureBackupDir();
    } catch (err) {
      logger.error('Backup', 'Impossible de creer le dossier de backup, fallback vers tmp', err);
      // Fallback : utiliser le repertoire temporaire du systeme
      this.backupDir = path.join(os.tmpdir(), 'eclipse-backups');
      try {
        this.ensureBackupDir();
      } catch (err2) {
        logger.error('Backup', 'Echec total : impossible de creer un dossier de backup', err2);
        // On continue sans crash — les backups seront silencieusement echouees a l'ecriture
      }
    }
  }

  private ensureBackupDir(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async createBackup(client: DiscordUserClient): Promise<BackupResult> {
    if (!client.user) {
      throw new Error('Client non connecté');
    }

    logger.info('Backup', 'Démarrage de la sauvegarde...');

    const userId = client.user.id;
    const username = client.user.tag;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Collecte des données
    const friends = this.collectFriends(client);
    const guilds = this.collectGuilds(client);
    const channels = this.collectChannels(client);

    const backupData: BackupData = {
      metadata: {
        userId,
        username,
        createdAt: new Date().toISOString(),
        version: '1.0'
      },
      friends,
      guilds,
      channels
    };

    // Sauvegarde sur disque
    const fileName = `backup_${userId}_${timestamp}.json`;
    const filePath = path.join(this.backupDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');

    logger.info('Backup', `Sauvegarde terminée: ${filePath}`);

    return {
      filePath,
      data: backupData
    };
  }

  private collectFriends(client: DiscordUserClient): BackupData['friends'] {
    const friends: BackupData['friends'] = [];
    
    try {
      const relationships = client.relationships as any;
      if (relationships?.friendCache) {
        for (const [id, friend] of relationships.friendCache) {
          friends.push({
            id,
            username: friend.user?.tag || friend.tag || 'Unknown',
            avatar: friend.user?.displayAvatarURL?.() || friend.displayAvatarURL?.()
          });
        }
      } else if (relationships?.cache) {
        for (const [id, rel] of relationships.cache) {
          if (rel.type === 1 || rel === 1) {
            friends.push({
              id,
              username: rel.user?.tag || 'Unknown',
              avatar: rel.user?.displayAvatarURL?.()
            });
          }
        }
      }
    } catch (err) {
      logger.warn('Backup', 'Erreur lors de la collecte des amis', err);
    }

    return friends;
  }

  private collectGuilds(client: DiscordUserClient): BackupData['guilds'] {
    const guilds: BackupData['guilds'] = [];

    try {
      for (const [id, guild] of client.guilds.cache) {
        guilds.push({
          id,
          name: guild.name,
          icon: guild.iconURL() || undefined,
          ownerId: guild.ownerId,
          memberCount: guild.memberCount
        });
      }
    } catch (err) {
      logger.warn('Backup', 'Erreur lors de la collecte des serveurs', err);
    }

    return guilds;
  }

  private collectChannels(client: DiscordUserClient): BackupData['channels'] {
    const channels: BackupData['channels'] = [];

    try {
      for (const [id, channel] of client.channels.cache) {
        const ch = channel as any;
        if (ch.type === 'DM' || ch.type === 'GROUP_DM') {
          channels.push({
            id,
            type: ch.type,
            name: ch.name || undefined,
            recipients: ch.recipients?.map((r: any) => r.id) || undefined
          });
        }
      }
    } catch (err) {
      logger.warn('Backup', 'Erreur lors de la collecte des canaux', err);
    }

    return channels;
  }

  listBackups(): string[] {
    this.ensureBackupDir();
    return fs.readdirSync(this.backupDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .sort()
      .reverse();
  }

  loadBackup(fileName: string): BackupData {
    const filePath = path.join(this.backupDir, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Fichier non trouvé: ${fileName}`);
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as BackupData;
  }

  deleteBackup(fileName: string): boolean {
    const filePath = path.join(this.backupDir, fileName);
    if (!fs.existsSync(filePath)) {
      return false;
    }
    
    fs.unlinkSync(filePath);
    return true;
  }
}
