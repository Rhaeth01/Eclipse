/**
 * Service de notifications système via Tauri
 * Affiche des notifications natives Windows quand l'app est en arrière-plan
 */

import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import type { NotificationMessage } from '@/lib/websocket/types';

let permissionGranted = false;

export async function initNotifications(): Promise<void> {
  // Vérifie la permission
  permissionGranted = await isPermissionGranted();
  
  // Demande la permission si nécessaire
  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === 'granted';
  }
}

export function showNotification(message: NotificationMessage): void {
  if (!permissionGranted) {
    console.warn('[Notification] Permission non accordée');
    return;
  }

  const title = message.title || getDefaultTitle(message.action);
  const body = message.content;

  // Note : pas de champ `icon` ici. Le chemin `tauri://assets/icon.png`
  // precedemment utilise n'est PAS un filesystem path valide pour
  // tauri-plugin-notification (c'est un protocole IPC). Le mettre faisait
  // silencieusement echouer sendNotification sur Windows. On laisse Windows
  // utiliser l'icone de l'AUMID enregistre pour l'app installee.
  // Note 2 : sendNotification est fire-and-forget (retourne void en Tauri v2),
  // donc on ne peut pas await/catch. Les erreurs internes sont silencieuses
  // par design du plugin.
  sendNotification({
    title,
    body: body.length > 200 ? body.substring(0, 200) + '...' : body,
  });
}

function getDefaultTitle(action: string): string {
  const titles: Record<string, string> = {
    'friend_removed_offline': '👥 Ami supprimé',
    'guild_removed_offline': '🏰 Serveur quitté',
    'role_add': '🛡️ Rôle ajouté',
    'role_remove': '⚠️ Rôle retiré',
    'direct_message': '✉️ Nouveau message',
    'keyword_ping': '🔔 Mention détectée',
    'spy_message': '👁️ Message cible',
    'spy_voice_join': '🔊 Vocal rejoint',
    'spy_voice_leave': '🔊 Vocal quitté',
    'spy_voice_move': '🔊 Vocal déplacé',
    'ghostping': '👻 Ghost ping',
    'spy_deleted': '🗑️ Message supprimé',
    'backup_success': '✅ Sauvegarde terminée',
    'command_used': '⌨️ Commande utilisée'
  };
  
  return titles[action] || '🌙 Eclipse';
}

// État de la fenêtre (pour savoir si on doit notifier)
let isWindowFocused = true;
let isWindowVisible = true;

export function updateWindowState(focused: boolean, visible: boolean): void {
  isWindowFocused = focused;
  isWindowVisible = visible;
}

export function shouldNotify(): boolean {
  // Notify seulement si la fenêtre n'est pas visible ou pas focus
  return !isWindowFocused || !isWindowVisible;
}
