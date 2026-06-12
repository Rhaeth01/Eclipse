# Eclipse

> Discord toolkit open source — parce que les outils puissants ne devraient pas être cachés derrière un paywall.

<p align="center">
  <img src="https://img.shields.io/badge/tauri-2.10-FFC131?logo=tauri" />
  <img src="https://img.shields.io/badge/next-16.1-black?logo=nextdotjs" />
  <img src="https://img.shields.io/badge/typescript-5.9-3178C6?logo=typescript" />
  <img src="https://img.shields.io/badge/rust-1.96-DEA584?logo=rust" />
  <img src="https://img.shields.io/badge/tests-51%20passed-2d9e8a?logo=vitest" />
  <img src="https://img.shields.io/github/v/tag/Rhaeth01/Eclipse?label=release&color=e69a00" />
  <img src="https://img.shields.io/badge/status-beta-e69a00" />
</p>

---

## Philosophie

Eclipse est **libre, gratuit et open source**. Tout le code est visible, auditable et modifiable. Aucune clé de licence, aucun tracking, aucun serveur tiers. Tout tourne en local sur votre machine.

Les outils de ce genre existent depuis des années, mais ils sont presque tous fermés, payants, et opaques sur ce qu'ils font de vos tokens. Eclipse prouve qu'on peut faire mieux : un toolkit Discord complet, transparent, que n'importe qui peut inspecter, forker et améliorer.

> **Beta** — le projet est en développement actif. Le versioning `0.x` reflète cet état. Les contributions et les forks sont les bienvenus.

---

## Setup

L'application extrait automatiquement votre token Discord depuis le client desktop (DPAPI, Windows uniquement).

**Slash Commands :** assistant de setup automatique au premier lancement. Eclipse crée l'application Discord, configure le Bot, et récupère le token en quelques secondes — aucune manipulation manuelle du portail développeur.

> Le token Application est **optionnel** — toutes les fonctionnalités selfbot (RPC, animations, spy, troll, sniper…) fonctionnent sans. Seules les commandes `/slash` nécessitent un token bot.

---

## Fonctionnalités

### Rich Presence & Animations
- Constructeur RPC : activité, détails, images, timestamps, boutons
- File d'animation avec rotation automatique
- Custom status animé par keyframes
- Live preview fidèle au rendu Discord

### Commandes (57+ slash et contextuelles)
| Catégorie | Commandes |
|-----------|-----------|
| Fun | `/roll`, `/coinflip`, `/8ball`, `/choose`, `/love`, `/roast`, `/compliment`, `/joke`, `/rate`, `/ship` |
| Image | `/cat`, `/dog`, `/meme` |
| Texte | `/mock`, `/ascii`, `/vaporwave`, `/emojify`, `/clap`, `/nighty`, `/reverse`, `/uwu` |
| Utilitaires | `/translate`, `/weather`, `/qr`, `/calc`, `/poll`, `/password`, `/color` |
| Modération | `/kick`, `/ban`, `/hackban`, `/unban`, `/slowmode`, `/lock`, `/unlock`, `/nuke`, `/role`, `/purge`, `/clear` |
| Espionnage | `/ghostping`, `/spy`, `/snipe`, `/editsnipe`, `/deletesend`, `/typing` |
| Vocal | `/joinvc`, `/leavevc`, `/tts` |
| Troll | `/mimic`, `/annoy`, `/fuckyou`, `/fakevirus`, `/hack`, `/disconnect` |
| Auto | `/autobump`, `/stopbump`, `/bumpstatus`, `/afk` |
| Context | `Ghostping`, `Spy User` |

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
- **Backend** — Node.js, client Gateway + REST custom (~1400 lignes), zéro dépendance selfbot tierce
- **Design** — Palette Corona : fond `#070709`, accent ambre `#e69a00`, typo Space Grotesk
- **Tests** — 51 tests (Vitest + React Testing Library)

---

## Développement

```bash
npm install && cd core && npm install && cd ..

# Dev (UI + backend + Tauri)
npm run dev:all

# Tests
npm test              # frontend (38 tests)
cd core && npm test    # backend (13 tests)

# Build
npm run build         # frontend Next.js → /out
cd core && npx tsc    # backend TypeScript → /dist
npx tauri build       # installer Windows (.exe)
```

**Prérequis :** Node.js ≥ 22, Rust ≥ 1.77, [dépendances système Tauri](https://v2.tauri.app/start/prerequisites/)

---

## Release

Les builds Windows sont générés par GitHub Actions à chaque tag :

```bash
git tag v0.3.0
git push origin v0.3.0
```

L'auto-update est intégré — une notification apparaît dans le dashboard quand une nouvelle version est disponible.

---

## Licence

Eclipse est distribué sous licence **Eclipse Non-Commercial License v1.0**. Voir [`LICENSE`](./LICENSE) pour le texte complet.

En résumé :
- ✅ Usage personnel libre et gratuit
- ✅ Fork, modification, redistribution du code source
- ✅ Contributions bienvenues
- ❌ Usage commercial interdit sans autorisation explicite

> ⚠️ L'utilisation d'un selfbot viole les conditions d'utilisation de Discord. Utilisez cet outil sur un compte secondaire. Les auteurs ne sont pas responsables des bans ou suspensions.
