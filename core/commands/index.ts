/**
 * Point d'entrée du registre de commandes.
 * Crée le registre, enregistre toutes les catégories, et l'exporte.
 * DiscordManager crée son propre registre via createCommandRegistry() pour
 * pouvoir injecter le contexte au dispatch.
 */

import { CommandRegistry } from './CommandRegistry';
import { registerBasics } from './categories/basics';
import { registerFun } from './categories/fun';
import { registerText } from './categories/text';
import { registerImage } from './categories/image';
import { registerAdmin } from './categories/admin';
import { registerSpy } from './categories/spy';
import { registerVoice } from './categories/voice';
import { registerTroll } from './categories/troll';
import { registerUtils } from './categories/utils';
import { registerInfo } from './categories/info';
import { registerMisc } from './categories/misc';
import { registerAnimated } from './categories/animated';
import { registerRecovery } from './categories/recovery';
import { registerQuest } from './categories/quest';
import { registerAutoslash } from './categories/autoslash';
import { registerSniper } from './categories/sniper';
import { registerSettings } from './categories/settings';
import { registerNotify } from './categories/notify';

/**
 * Construit un registre de commandes complet avec toutes les catégories enregistrées.
 * À appeler une fois au démarrage de DiscordManager.
 */
export function createCommandRegistry(): CommandRegistry {
  const registry = new CommandRegistry();

  // Top-level + categories
  registerBasics(registry);
  registerFun(registry);
  registerText(registry);
  registerImage(registry);
  registerAdmin(registry);
  registerSpy(registry);
  registerVoice(registry);
  registerTroll(registry);
  registerUtils(registry);
  registerInfo(registry);
  registerMisc(registry);
  registerAnimated(registry);
  registerRecovery(registry);
  registerQuest(registry);
  registerAutoslash(registry);
  registerSniper(registry);
  registerSettings(registry);
  registerNotify(registry);

  return registry;
}

export { CommandRegistry } from './CommandRegistry';
export type {
  CommandContext,
  DiscordManagerLike,
  SubcommandDef,
  TopLevelDef,
  ContextMenuDef,
  CommandRegistrySnapshot,
} from './CommandRegistry';
