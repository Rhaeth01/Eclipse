# Eclipse

<p align="center">
  <img src="assets/branding/eclipse_wordmark_transparent_cropped.png" alt="Eclipse" width="480" />
</p>

<p align="center">
  <em>Discord toolkit libre, open source et gratuit — parce que les outils puissants ne devraient pas être cachés derrière un paywall.</em>
</p>

<p align="center">
  <a href="https://github.com/Rhaeth01/Eclipse/releases/latest"><img src="https://img.shields.io/github/v/tag/Rhaeth01/Eclipse?label=release&color=e69a00" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache_2.0-blue" /></a>
  <a href="https://github.com/Rhaeth01/Eclipse/stargazers"><img src="https://img.shields.io/github/stars/Rhaeth01/Eclipse?style=flat&color=e69a00" /></a>
  <img src="https://img.shields.io/badge/status-beta-e69a00" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/tauri-2.10-FFC131?logo=tauri" />
  <img src="https://img.shields.io/badge/next-16.1-black?logo=nextdotjs" />
  <img src="https://img.shields.io/badge/typescript-5.9-3178C6?logo=typescript" />
  <img src="https://img.shields.io/badge/rust-1.96-DEA584?logo=rust" />
  <img src="https://img.shields.io/badge/node-22.19-339933?logo=nodedotjs" />
  <img src="https://img.shields.io/badge/license-Apache_2.0-blue" />
  <img src="https://img.shields.io/badge/tests-167%20passed-2d9e8a?logo=vitest" />
</p>

---

## Sommaire

- [Philosophie](#philosophie)
- [Installation](#installation)
- [Fonctionnalités](#fonctionnalités)
- [Commandes](#commandes)
- [Architecture](#architecture)
- [Développement](#développement)
- [Tests](#tests)
- [Build & release](#build--release)
- [Contribution](#contribution)
- [License](#license)
- [Disclaimer](#disclaimer)

---

## Philosophie

Eclipse est un **client Discord auto-hébergé, open source, et sous licence Apache 2.0**. Tout le code est visible, auditable, modifiable, et peut être utilisé commercialement.

Les outils de ce genre existent depuis des années, mais ils sont presque tous fermés, payants, opaques sur ce qu'ils font de vos tokens. **Eclipse prouve qu'on peut faire mieux** : un toolkit Discord complet, transparent, forkable à l'envie, sans paywall, sans tracking, sans clé de licence.

> **Status : beta.** Version `0.x` — développement actif. Les contributions et forks sont les bienvenus.

**Pourquoi selfbot ?** Eclipse se connecte à Discord via ton **compte utilisateur** (selfbot), ce qui permet des fonctionnalités inaccessibles aux bots classiques (RPC animé, sniper de Nitro, spy de messages supprimés, etc.). Voir le [disclaimer](#disclaimer).

---

## Installation

### Pour les utilisateurs

1. Télécharge la dernière release : [Eclipse_0.5.1_x64-setup.exe](https://github.com/Rhaeth01/Eclipse/releases/latest)
2. Installe — **Node.js est inclus dans l'installeur, aucun prérequis**
3. Lance Eclipse
4. Le token de ton compte Discord est extrait automatiquement (Windows) — ou saisis-le manuellement (Linux/Mac)
5. Optionnel : configure les Slash Commands via l'assistant intégré

### Pour les devs

```bash
git clone https://github.com/Rhaeth01/Eclipse.git
cd Eclipse
npm install && cd core && npm install && cd ..
npm run dev:linux     # Frontend + Core sans Tauri (Linux friendly)
# ou
npm run dev:all       # Frontend + Core + Tauri (Windows recommandé)
```

**Prérequis dev :** Node.js ≥ 22, Rust ≥ 1.77, [Tauri system deps](https://v2.tauri.app/start/prerequisites/)

---

## Fonctionnalités

### 🎭 Profil & Rich Presence
- Constructeur RPC complet : activité, détails, images, timestamps, boutons
- **Animations** : rotation automatique de frames configurables
- Custom status animé (texte + emoji)
- Live preview fidèle au rendu Discord

### 🤖 100+ commandes slash et contextuelles
Voir la [liste complète](#commandes).

### 🎯 Quest auto-completion
- Détection automatique des quêtes Discord en cours
- Complétion automatique (vidéo, stream, jeu) sans interaction
- Panel dédié pour suivre la progression et les récompenses

### 🔔 Notifications & surveillance
- Centre de notifications in-app
- Toasts desktop (Windows, macOS, Linux)
- Spy de messages supprimés/édité
- Tracking amis/serveurs hors-ligne (SQLite)
- Détection de mots-clés
- Ghostping detector

### ⚡ Automatisations
- Nitro sniper & giveaway joiner
- AutoBump (bump automatique de serveurs)
- Auto-exécution de slash commands
- Detection de raids

### 🎨 UI & UX
- Design Corona (ambre sur noir profond)
- Setup wizard 5 étapes (welcome → instructions → token → auto → done)
- Configuration manuelle **ou** automatique via WebView Tauri
- Thème unique et raffiné

### 💾 Données & backup
- Backup complet du compte (amis, serveurs, paramètres)
- Persistance d'état via SQLite
- Tous les tokens sont stockés localement (jamais transmis)

---

## Commandes

Le système de commandes est unifié dans un registre unique (`core/commands/`).
Les commandes préfixées (`.`) ont été supprimées — Eclipse utilise désormais
uniquement les slash commands modernes avec sous-commandes et autocompletion,
aligné sur la structure `/help` de Nighty.

| Catégorie | Commandes |
|-----------|-----------|
| **Basiques** | `/help`, `/ping` |
| **Fun** | `/fun roll`, `/fun coinflip`, `/fun 8ball`, `/fun choose`, `/fun love`, `/fun roast`, `/fun compliment`, `/fun joke`, `/fun rate`, `/fun ship`, `/fun spam`, `/fun react` |
| **Texte** | `/text mock`, `/text ascii`, `/text vaporwave`, `/text emojify`, `/text clap`, `/text nighty`, `/text reverse`, `/text uwu`, `/text shrug`, `/text tableflip`, `/text unflip`, `/text lenny` |
| **Image** | `/image cat`, `/image dog`, `/image meme` |
| **Admin** | `/admin clear`, `/admin purge`, `/admin role`, `/admin kick`, `/admin ban`, `/admin hackban`, `/admin unban`, `/admin slowmode`, `/admin lock`, `/admin unlock`, `/admin nuke` |
| **Spy** | `/spy toggle`, `/spy list`, `/spy remove`, `/spy clear`, `/spy snipe`, `/spy editsnipe` |
| **Voice** | `/voice joinvc`, `/voice leavevc`, `/voice tts` |
| **Troll** | `/troll mimic`, `/troll annoy`, `/troll fuckyou`, `/troll fakevirus`, `/troll hack`, `/troll disconnect`, `/troll deletesend`, `/troll typing`, `/troll reactroll`, `/troll autoreply`, `/troll dmall` |
| **Utils** | `/utils calc`, `/utils poll`, `/utils password`, `/utils color`, `/utils translate`, `/utils weather`, `/utils qr`, `/utils remind`, `/utils base64`, `/utils binary` |
| **Info** | `/info userinfo`, `/info avatar`, `/info serverinfo`, `/info stats` |
| **Misc** | `/misc afk`, `/misc ghostping`, `/misc uptime` |
| **Animated** | `/animated status start`, `/animated status stop`, `/animated rpc start`, `/animated rpc stop`, `/animated rpc set`, `/animated rpc clear` |
| **Recovery** | `/recovery backup create`, `/recovery backup list`, `/recovery backup load`, `/recovery backup delete` |
| **Quest** | `/quest list`, `/quest fetch`, `/quest start`, `/quest stop`, `/quest claim`, `/quest mock` |
| **AutoSlash** | `/autoslash bump enable`, `/autoslash bump disable`, `/autoslash bump status`, `/autoslash bump list` |
| **Sniper** | `/sniper toggle`, `/sniper status`, `/sniper whitelist` |
| **Settings** | `/settings stealth`, `/settings silent`, `/settings deploy`, `/settings status` |
| **Clone** | `/clone server` |
| **Script** | `/script list`, `/script load`, `/script run`, `/script unload`, `/script watch` |
| **Spotify** | `/spotify nowplaying`, `/spotify pause`, `/spotify resume`, `/spotify skip`, `/spotify status` |
| **Notify** | `/notify test`, `/notify webhook`, `/notify status` |
| **Context** | `Ghostping` (user), `Spy User` (user), `Translate` (message), `Copy Raw` (message) |

---

## Architecture

```
┌──────────────────┐  invoke()   ┌───────────────────┐
│  Next.js UI      │◄───────────►│  Tauri (Rust)      │
│  (WebView)       │            │  DPAPI + tray       │
└────────┬─────────┘            └───────────────────┘
         │ ws://localhost:4040
         ▼
┌──────────────────┐
│  EclipseCore      │────► WebSocketService
└────────┬─────────┘
         │
   ┌─────┴────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
   ▼          ▼          ▼          ▼          ▼          ▼          ▼          ▼          ▼
Discord    Animation  Database   TrollSvc   SniperSvc  BotSetup   Quest      Spy       AutoSlash
Manager    Service    Service                          Service    Service    Service   + Backup
    │
    ├── DiscordUserClient (custom Gateway + REST)
    │   ├── DiscordGateway (WebSocket gateway)
    │   └── DiscordREST (HTTP + app creation API)
    │
    └── CommandRegistry (single source of truth — 100+ slash + 4 context menus)
```

**Stack technique :**

| Couche | Tech |
|--------|------|
| Frontend | Next.js 16 · React 19 · Tailwind CSS 4 · Framer Motion |
| Desktop | Tauri 2.10 (Rust) — tray, frameless, auto-updater, WebView |
| Backend | Node.js 22 (bundlé) · custom Gateway + REST (~1600 lignes) |
| Validation | Zod schemas |
| Database | SQLite via `better-sqlite3` |
| Tests | Vitest + React Testing Library |

**Pourquoi un client Discord custom ?** Les libs selfbot classiques (`discord.js-selfbot-v13`) sont obsolètes et facilement détectables. Le client d'Eclipse imite parfaitement le client desktop Discord (User-Agent, X-Super-Properties, headers de requête).

---

## Développement

```bash
# Setup
npm install && cd core && npm install && cd ..

# Dev (Windows — full Tauri)
npm run dev:all

# Dev (Linux/Mac — frontend + core sans Tauri)
npm run dev:linux

# Tests
npm test              # frontend + core (167 tests)
cd core && npm test    # backend uniquement (139 tests)

# Lint
npm run lint

# Build production
npm run build         # frontend → /out
cd core && npx tsc    # backend TypeScript → /dist
npx tauri build       # installeur Windows (.exe)
```

### Développement sous Linux

Le dev Tauri complet nécessite Windows (DPAPI token extraction). Sous Linux :

1. `npm run dev:linux` démarre Next.js (port 3000) + Core (port 4040)
2. Ouvre `http://localhost:3000`
3. L'extraction DPAPI échoue → un champ "Token utilisateur Discord" apparaît
4. Colle ton token user Discord (récupérable via les DevTools du navigateur)
5. Optionnel : colle aussi ton app token pour les slash commands

---

## Tests

**167 tests** au total (4 skipped), lancés via Vitest :

```
npm test
```

- **Frontend** (28 tests) : composants (SetupWizard), hooks (useWebSocket)
- **Backend** (139 tests) : CommandRegistry + dispatch, EclipseCore, WebSocketService, BotSetupService, AutoSlashService, RateLimiter, SniperService, SpyService, TrollService, BackupService.restore, CloneService, ScriptService, SpotifyService, schemas Zod

Le build passe : `npm run build` + `npx tsc` (core) + `cargo check` (Rust).

---

## Build & release

Les builds Windows sont automatisés via GitHub Actions. Process :

```bash
# 1. Faire tous les changements
# 2. Bumper les 4 fichiers de version (package.json × 2, Cargo.toml, tauri.conf.json)
# 3. Commit "chore: bump version X.Y.Z"
# 4. Tag SUR CE COMMIT
git tag -a vX.Y.Z -m "vX.Y.Z - description"
git push origin vX.Y.Z
```

La CI :
1. Télécharge Node.js 22.19.0 portable → bundlé dans l'exe (zéro prérequis utilisateur)
2. Compile Rust + TypeScript + Next.js
3. Signe l'exe et génère `latest.json` pour l'auto-updater
4. Upload tout sur la [release GitHub](https://github.com/Rhaeth01/Eclipse/releases)

L'auto-updater notifie les utilisateurs quand une nouvelle version sort.

---

## Contribution

Toutes les contributions sont les bienvenues :

1. **Fork** le repo
2. Crée une branche (`git checkout -b feature/ma-feature`)
3. Commit (`git commit -m "feat: ajoute ma feature"`)
4. Push (`git push origin feature/ma-feature`)
5. Ouvre une **Pull Request**

**Avant de contribuer :**
- Vérifie que les tests passent (`npm test`)
- Suis le style existant (ESLint + Prettier)
- Ajoute des tests pour les nouvelles features

### Idées de features à contribuer
- Système de thèmes (CSS personnalisable, marketplace)
- Plugin/Script engine (TypeScript/JS)
- Multi-comptes (alt account support)
- Web Login OAuth (non-Windows)
- Server cloner, backup/restore étendu
- Rich Presence avancé (plateformes Xbox/PS, types Spotify, valeurs dynamiques)
- Notifications overhaul (centre in-app, webhooks)
- Voir les [issues GitHub](https://github.com/Rhaeth01/Eclipse/issues) pour les demandes en cours

---

## License

**Apache License 2.0** — voir le fichier [`LICENSE`](./LICENSE).

En résumé :
- ✅ Usage commercial
- ✅ Modification
- ✅ Distribution
- ✅ Usage privé
- ❌ Responsabilité (fourni tel quel)
- ❌ Garantie (fourni tel quel)
- ✅ Licence + copyright doivent être préservés
- ✅ Les modifications doivent être documentées

---

## Disclaimer

> ⚠️ **L'utilisation d'un selfbot viole les conditions d'utilisation de Discord.** Utilise cet outil **uniquement sur un compte secondaire** que tu acceptes de perdre. Discord peut détecter l'utilisation de selfbot et bannir ton compte à tout moment.
>
> Les auteurs d'Eclipse ne sont **pas responsables** des bans, suspensions, ou autres actions prises par Discord contre ton compte. Tu utilises cet outil **à tes propres risques**.

Discord est une marque de Discord Inc. Ce projet n'est **pas affilié** à Discord Inc.

---

<p align="center">
  Made with care for the Discord community — libre, ouvert, transparent.
</p>
