# Eclipse

> Discord toolkit — Rich Presence, animations, commandes furtives, espionnage.

<p align="center">
  <img src="https://img.shields.io/badge/tauri-2.10-FFC131?logo=tauri" />
  <img src="https://img.shields.io/badge/next-16.1-black?logo=nextdotjs" />
  <img src="https://img.shields.io/badge/typescript-5.9-3178C6?logo=typescript" />
  <img src="https://img.shields.io/badge/rust-1.96-DEA584?logo=rust" />
  <img src="https://img.shields.io/badge/tests-51%20passed-2d9e8a?logo=vitest" />
  <img src="https://img.shields.io/github/v/release/Rhaeth01/Eclipse?color=e69a00" />
</p>

---

## Setup

L'application extrait automatiquement votre token Discord depuis le client desktop (DPAPI, Windows uniquement).

**Pour les Slash Commands :** un assistant de setup pas-à-pas vous guide au premier lancement. Vous pouvez aussi configurer votre token Application manuellement ou automatiquement (WebView Tauri qui ouvre le portail développeur Discord).

> Le token Application est **optionnel** — toutes les fonctionnalités selfbot (RPC, animations, spy, troll, sniper, etc.) fonctionnent sans. Seules les commandes `/slash` nécessitent un token bot.

---

## Fonctionnalités

### Rich Presence & Animations
- Constructeur RPC complet : activité, détails, images, timestamps, boutons
- File d'animation avec rotation automatique
- Custom status animé par keyframes
- Live preview fidèle au rendu Discord

### Commandes
- **`/ghostping`** — mention fantôme (ping puis suppression)
- **`/spy`** — surveillance en temps réel d'un membre (voix, messages)
- **`/purge`** — suppression de vos derniers messages
- **`/mimic`** — usurpation d'identité via webhook
- **`/reactroll`** — réaction automatique persistante sur une cible
- **`/deletesend`** — censure et republication des messages d'une cible
- **`/autoreply`** — réponse simulée avec délai aléatoire
- **`/server_clone`** — clonage de serveur complet
- Et 30+ autres commandes slash et contextuelles

### Paramètres
- Mode furtif (réponses éphémères)
- Silent typing
- Nitro sniper, giveaway joiner, ping detection
- Backup automatique en JSON
- Tracking hors-ligne (amis/serveurs) via SQLite

---

## Architecture

```
┌─────────────┐     WebSocket      ┌──────────────┐     Gateway
│  Next.js UI │ ◄────────────────► │  Node.js Core │ ◄────────────► Discord
│  (Tauri)    │    ws://4040       │  (custom WS)  │   REST + WS
└─────────────┘                    └──────────────┘
```

- **Frontend** — Next.js 16 / React 19 / Tailwind CSS 4 / Framer Motion
- **Desktop** — Tauri 2.10 (Rust) avec tray icon, fenêtre transparente, auto-update, WebView de setup automatisé
- **Backend** — Node.js avec client Gateway + REST custom (zéro dépendance tierce)
- **Design** — Palette Corona : fond #070709, accent ambre #e69a00, typo Space Grotesk
- **Tests** — 51 tests (Vitest + React Testing Library) : composants, hooks, schemas Zod

---

## Développement

```bash
# Installer les dépendances
npm install
cd core && npm install && cd ..

# Lancer en mode dev (UI + backend + Tauri)
npm run dev:all

# Tests
npm test                 # frontend (38 tests)
cd core && npm test       # backend (13 tests)

# Build production
npm run build            # frontend Next.js
cd core && npx tsc       # backend TypeScript
npx tauri build          # installer Windows
```

**Prérequis :** Node.js ≥ 22, Rust ≥ 1.77, [dépendances système Tauri](https://v2.tauri.app/start/prerequisites/)

---

## Release

Les builds Windows sont générés automatiquement par GitHub Actions à chaque tag :

```bash
git tag v0.3.0
git push origin v0.3.0
```

La CI compile, signe et publie le `.exe` sur les [Releases GitHub](https://github.com/Rhaeth01/Eclipse/releases).

L'auto-update est intégré — une notification apparaît dans le dashboard quand une nouvelle version est disponible.

---

## Licence

Projet privé. Usage personnel uniquement.

> ⚠️ L'utilisation d'un selfbot viole les conditions d'utilisation de Discord. Utilisez cet outil sur un compte secondaire. Les auteurs ne sont pas responsables des bans ou suspensions.
