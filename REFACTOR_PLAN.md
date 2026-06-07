# Plan de refactoring — Remplacement de discord.js-selfbot-v13

## État actuel

**Phase 1 ✅ Terminée** — Création du client Discord custom :
- `core/discord/types.ts` — Interfaces compatibles (230 lignes)
- `core/discord/DiscordREST.ts` — Client HTTP avec headers officiels (360 lignes)
- `core/discord/DiscordGateway.ts` — WebSocket gateway (320 lignes)
- `core/discord/DiscordUserClient.ts` — Façade unifiée (520 lignes)
- `core/discord/index.ts` — Exports

Les 4 modules compilent sans erreur à côté du code existant. Aucun fichier existant n'a encore été modifié pour les utiliser.

## Corrections appliquées (avant Phase 1)

| Fichier | Correctif |
|---------|-----------|
| `src/components/ui/button.tsx` | Import `@radix-ui/react-slot` corrigé |
| `src-tauri/Cargo.toml` | Dépendances restructurées, plugins déplacés dans `[dependencies]` |
| `src-tauri/tauri.conf.json` | CSP ajoutée, URL updater corrigée, `bundle.targets` → `nsis` |
| `src-tauri/src/lib.rs` | `unwrap()` remplacés par `let _ =`, `#[cfg_attr(mobile)]` → `#[cfg(not(target_os = "android"))]`, chemin Node.js corrigé |
| `src-tauri/capabilities/desktop.json` | Scope shell corrigé (`core/dist/index.js` + `../core/dist/index.js`) |
| `src-tauri/capabilities/default.json` | Simplifié à `core:default` + `shell:default` |
| `src-tauri/src/discord_extractor.rs` | Code Windows gated avec `#[cfg(target_os = "windows")]`, fallback Linux |
| `src/app/page.tsx` | Classes Tailwind dynamiques corrigées, `onClick` ajoutés aux boutons danger zone |
| `src/app/globals.css` | `--font-geist-sans` → `--font-inter` |
| `core/package.json` | Dépendances nettoyées (React retiré, runtime déplacé hors devDeps) |

---

## Phase 2 — Adaptation du code existant

### 2A. `core/discord/DiscordManager.ts` (~2065 lignes, ~50 changements)

**1. Import — Ligne 6-13**
```
Remplacer: import { Client as SelfbotClient, TextChannel, Message, VoiceState, GuildMember } from 'discord.js-selfbot-v13'
Par:       import { DiscordUserClient, IMessage, IChannel, IGuildMember, IVoiceState } from './DiscordUserClient'
```

**2. Propriété — Ligne 71**
```
Remplacer: private selfbot: SelfbotClient | null = null;
Par:       private selfbot: DiscordUserClient | null = null;
```

**3. `initSelfbot()` — Lignes 163-177**
```
Remplacer: this.selfbot = new SelfbotClient({ ws: { properties: { os: 'Windows', ... } } })
Par:       this.selfbot = new DiscordUserClient({ os: 'Windows', browser: 'Discord Client', device: 'desktop', /* + champs étendus */ })
```

**4. `setupSelfbotEvents()` — Lignes 226-317**
```
Tous les selfbot.on('event', handler) restent identiques.
Les types IMessage, IGuild, IVoiceState sont déjà compatibles.
```

**5. `stealthReply()` — Ligne 621-665**
```
Remplacer: (channel as any).send(...) → channel.send(...)
Plus besoin de cast.
```

**6. `setupTrollServiceHandlers()` — Lignes 180-221**
```
Les handlers utilisent msg.channel.id, msg.deletable, msg.delete(), msg.react(), msg.reply().
Toutes ces méthodes existent sur IMessage — pas de changement.
```

**7. Méthodes de modération, ghostping, mimic, etc.**
```
Remplacer: (channel as TextChannel).send(...) → channel.send(...)
Remplacer: (channel as any).sendTyping() → channel.sendTyping()
Remplacer: (selfbot as any).api.post(...) → null (déjà migré vers rest.sendInteraction)
```

**8. Méthodes `getFriendCount()`, backup, etc.**
```
selfbot.relationships.friendCache — déjà peuplé par DiscordUserClient
selfbot.guilds.cache — déjà peuplé
```

### 2B. `core/services/AnimationService.ts` (~257 lignes, ~8 changements)

**1. Import — Ligne 6**
```
Remplacer: import { Client } from 'discord.js-selfbot-v13'
Par:       import { DiscordUserClient } from '../discord/DiscordUserClient'
```

**2. Propriété — Ligne 18**
```
Remplacer: private client: Client | null = null;
Par:       private client: DiscordUserClient | null = null;
```

**3. `setClient()` — Ligne 22**
```
Remplacer: setClient(client: Client | null)
Par:       setClient(client: DiscordUserClient | null)
```

**4. `setPresence()` — Tous les appels**
```
client.user.setPresence(...) — déjà compatible via IClientUser
```

**5. `RichPresence` import — Lignes 109, 162, 185**
```
Supprimer: const { RichPresence } = await import('discord.js-selfbot-v13')
           Le paramètre RichPresenceClass n'est jamais utilisé dans applyRpcFrame
Modifier:  applyRpcFrame(data, RichPresenceClass) → applyRpcFrame(data)
```

**6. `setActivity()` — Ligne 142, 177**
```
Déjà compatible.
```

### 2C. `core/commands.ts` (~1334 lignes, ~6 changements)

**1. Import — Ligne 1**
```
Remplacer: import { Client, Message, TextChannel, Permissions, DMChannel } from 'discord.js-selfbot-v13'
Par:       import { DiscordUserClient, IMessage, IChannel } from './discord/types'
```

**2. Signature des commandes**
```
Remplacer: client: Client → client: DiscordUserClient
Remplacer: message: Message → message: IMessage
```

**3. Cast `as TextChannel` — Lignes 134, 171, 175**
```
Remplacer: message.channel as TextChannel → message.channel (déjà typé IChannel)
```

**4. `Permissions.FLAGS.SEND_MESSAGES` — Ligne 1207**
```
Déjà opérationnel via l'implémentation custom de Permissions.
```

### 2D. `core/handlers/MessageHandler.ts` (~398 lignes, ~3 changements)

**1. Import — Ligne 18**
```
Remplacer: import { Client as SelfbotClient, Permissions } from 'discord.js-selfbot-v13'
Par:       import { DiscordUserClient, Permissions } from '../discord'
```

**2. Type `discordClient` — Ligne 30**
```
Remplacer: discordClient: SelfbotClient | null
Par:       discordClient: DiscordUserClient | null
```

### 2E. `core/services/BackupService.ts` (~199 lignes, ~2 changements)

**1. Import — Ligne 8**
```
Remplacer: import { Client } from 'discord.js-selfbot-v13'
Par:       import { DiscordUserClient } from '../discord'
```

### 2F. `core/EclipseCore.ts` (~506 lignes, ~5 changements)

**1. `selfbot.api.post('/entitlements/...')` — Ligne 384**
```
Remplacer: await (selfbot as any).api.post('/entitlements/gift-codes/' + code + '/redeem')
Par:       await this.discordManager.getSelfbot()!.getRest().redeemNitro(code)
```

**2. `channel.sendSlash(...)` — Ligne 444**
```
Remplacer: await (channel as any).sendSlash(disboardAppId, 'bump')
Par:       await rest.sendInteraction({ type: 2, application_id: disboardAppId, ... })
```

**3. `selfbot.api.interactions.post(...)` — Ligne 450**
```
Remplacer: await (selfbot as any).api.interactions.post({ body: { ... } })
Par:       await rest.sendInteraction({ type: 2, application_id: disboardAppId, ... })
```

### 2G. `core/services/QuestService.ts` (~643 lignes, ~8 changements)

**1. Tous les `(selfbot as any).api.users('@me').quests.get()`**
```
Remplacer: await (selfbot as any).api.users('@me').quests.get()
Par:       await rest.getQuests()
```

**2. `(selfbot as any).api.quests(id).accept.post()` — Ligne 164**
```
Remplacer par: await rest.acceptQuest(questId)
```

**3. `(selfbot as any).api.quests(id).heartbeat.post({body})` — Ligne 256**
```
Remplacer par: await rest.heartbeatQuest(quest.id, { videoId: ..., timestamp: ... })
```

**4. `(selfbot as any).api.quests(id).claim_reward.post()` — Ligne 366**
```
Remplacer par: await rest.claimQuestReward(questId)
```

**5. `(selfbot as any).options?.ws?.properties` — Ligne 96**
```
Remplacer par: selfbot.options.ws.properties (déjà accessible sans cast)
```

**6. `X-Super-Properties` malformé — Ligne 96**
```
Correction: l'en-tête est déjà géré en interne par DiscordREST (Base64 correct).
Supprimer le passage manuel de l'en-tête dans le code QuestService.
```

### 2H. `core/backup.ts` (~73 lignes, legacy)
```
Option A: Supprimer le fichier (BackupService.ts est le remplaçant)
Option B: Changer l'import Client → DiscordUserClient
Recommandation: Option A — supprimer.
```

### H. Nettoyage final
- Supprimer `discord.js-selfbot-v13` de `core/package.json` (dependencies)
- Supprimer `core/backup.ts` (legacy)
- Supprimer `(global as any).eclipseCore` et remplacer par injection de dépendances (meilleure pratique)
- Extraire ~300 lignes dupliquées entre `commands.ts` et `DiscordManager.ts` dans `shared/constants.ts`
- Mettre `strict: true` dans `core/tsconfig.json`

---

## Phase 3 — Renforcement anti-détection (à faire avec Phase 2)

| # | Fichier | Changement |
|---|---------|------------|
| 1 | Tous les délais fixes | Ajouter jitter 30% (`setTimeout(fn, N * (0.85 + Math.random() * 0.3))`) |
| 2 | `DiscordManager.ts` ghostping | Délai 500-1500ms avant delete (au lieu de 0ms) |
| 3 | `SniperService.ts` | Délai 500-2000ms avant react giveaway |
| 4 | `AnimationService.ts` | Supprimer `status: 'online'` des ticks (premier uniquement) |
| 5 | `DiscordManager.ts` AFK reply | Délai 800-2000ms random (au lieu de 1200ms fixe) |
| 6 | `commands.ts` `.clear`/`.purge` | Jitter sur les délais 600ms/500ms |
| 7 | `TrollService.ts` typing | Intervalle randomisé (7000-9000ms au lieu de 8000ms fixe) |
| 8 | `RateLimiter.ts` | `updateFromHeaders()` alimenté depuis les réponses REST |

---

## Phase 4 — Nettoyage et durcissement TypeScript

| # | Action |
|---|--------|
| 1 | Supprimer `discord.js-selfbot-v13` de `core/package.json` |
| 2 | Supprimer `core/backup.ts` (remplacé par BackupService.ts) |
| 3 | Dédoublonner ~300 lignes entre commands.ts et DiscordManager.ts → `shared/constants.ts` |
| 4 | Activer `strict: true` dans `core/tsconfig.json` |
| 5 | Remplacer `(global as any).eclipseCore` par injection de dépendances propre |

---

## Estimations

| Phase | Lignes modifiées | Complexité | Statut |
|-------|-----------------|------------|--------|
| Phase 1 - Client custom | ~1430 (new) | Élevée | ✅ Terminé |
| Phase 2 - Adaptation | ~500 | Modérée | ⬜ À faire |
| Phase 3 - Anti-détection | ~100 | Faible | ⬜ À faire |
| Phase 4 - Cleanup | ~200 | Faible | ⬜ À faire |
