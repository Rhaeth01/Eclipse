import { Client } from 'discord.js-selfbot-v13';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface BackupData {
    user: {
        id: string;
        tag: string;
        avatarURL: string | null;
        settings?: any; // Discord user settings
    };
    friends: { id: string, tag: string }[];
    blocked: { id: string, tag: string }[];
    guilds: {
        id: string;
        name: string;
        iconURL: string | null;
        channels: { id: string, name: string, type: string }[];
        roles: { id: string, name: string, color: number }[];
    }[];
    timestamp: number;
}

export async function createAccountBackup(client: Client, backupDir: string): Promise<string> {
    if (!client.user) throw new Error("Client non authentifié.");

    console.log(`[Backup] Démarrage de la sauvegarde pour ${client.user.tag}...`);

    const data: BackupData = {
        user: {
            id: client.user.id,
            tag: client.user.tag,
            avatarURL: client.user.displayAvatarURL(),
        },
        friends: [],
        blocked: [],
        guilds: [],
        timestamp: Date.now()
    };

    // 1. Récupération des Relations (Amis / Bloqués)
    // discord.js-selfbot-v13 offre l'accès direct via client.relationships
    if (client.relationships) {
        client.relationships.cache.forEach((rel: any, id: string) => {
            const userRef = client.users.cache.get(id);
            if (userRef) {
                if (rel === 1) data.friends.push({ id: userRef.id, tag: userRef.tag });
                if (rel === 2) data.blocked.push({ id: userRef.id, tag: userRef.tag });
            }
        });
    }

    // 2. Sauvegarde des Serveurs (Guilds)
    client.guilds.cache.forEach(guild => {
        const guildData = {
            id: guild.id,
            name: guild.name,
            iconURL: guild.iconURL(),
            channels: guild.channels.cache.map(c => ({ id: c.id, name: c.name, type: c.type.toString() })),
            roles: guild.roles.cache.map(r => ({ id: r.id, name: r.name, color: r.color }))
        };
        data.guilds.push(guildData);
    });

    // Écriture du fichier JSON
    await fs.ensureDir(backupDir);
    const filename = `backup_${client.user.id}_${Date.now()}.json`;
    const filePath = path.join(backupDir, filename);
    await fs.writeJson(filePath, data, { spaces: 2 });

    console.log(`[Backup] Sauvegarde terminée: ${filename}`);
    return filePath;
}
