# Eclipse — Agent Documentation

## Project Overview

Eclipse is a desktop application (Tauri + Next.js + Node.js) designed as an advanced toolkit for Discord. It connects to Discord's Gateway via a **custom WebSocket client** — no third-party selfbot library.

**Key Characteristics:**
- **Language**: French (UI and codebase), English (commit messages)
- **Platform**: Windows (DPAPI token extraction), Linux supported for dev
- **Architecture**: Multi-process (Tauri window + Node.js backend via WebSocket)
- **Discord connection**: Custom Gateway + REST client
- **Design system**: Corona palette (amber/gold on deep black, Space Grotesk typography)
- **Status**: Beta (version 0.x) — forkable, contributions welcome
- **License**: Eclipse Non-Commercial License v1.0 (free, forkable, no commercial use)

---

## Progress (v0.3.0)

### Done

| Area | What |
|------|------|
| **Core** | Custom DiscordGateway + DiscordREST + DiscordUserClient (~1400 lines) |
| **Core** | Modular services: Animation, Database, Backup, Spy, Troll, Sniper, Quest, AutoSlash, State, BotSetup |
| **Core** | WebSocket server on port 4040 with Zod validation |
| **Core** | discord.js v14 App Bot for 57+ slash commands |
| **Core** | API-driven bot setup: createApplication, createBot, resetToken, authorize (DiscordREST) |
| **Core** | BotSetupService: fully automated 4-step bot setup orchestration |
| **Frontend** | Next.js 16 + React 19 + Tailwind CSS 4 + Framer Motion |
| **Frontend** | SetupWizard: 5-step onboarding with auto-setup + manual fallback |
| **Frontend** | Corona design system (amber #e69a00, Space Grotesk, solid surfaces) |
| **Frontend** | Rich Presence builder with animation queue |
| **Desktop** | Tauri 2.10: tray, frameless window, auto-updater, DPAPI token extraction |
| **Desktop** | setup_webview.rs: WebView2 portal with injected JS (banner, token detection, auto-fill) |
| **CI/CD** | GitHub Actions: TypeScript check on push, Windows build on tag |
| **Tests** | 51 tests: Vitest + React Testing Library (schemas, components, hooks) |
| **Docs** | README.md, AGENTS.md, LICENSE |

### In Progress / Planned

| Priority | Feature | Effort |
|----------|---------|--------|
| 🟡 | **Rich Presence avancé** — plateformes (Xbox/PS), types Spotify/Crunchyroll, valeurs dynamiques, animations bio/About Me | Large |
| 🟡 | **Plugin/Script engine** — TypeScript/JS, hot-reload, marketplace community | Large |
| 🟡 | **Theme system** — CSS custom, marketplace, Corona as default | Medium |
| 🟡 | **Notifications overhaul** — in-app center, webhooks, filters | Medium |
| 🟢 | **Multi-account** — alt account support | Medium |
| 🟢 | **Server cloner** — full guild replication | Medium |
| 🟢 | **Backup/Restore** — complete account backup (servers, friends, settings) | Small |
| 🟢 | **Web Login** — official Discord OAuth login for non-Windows | Small |
| 🟢 | **AutoSlash extended** — more auto slash features beyond AutoBump | Small |

---

## Technology Stack

### Frontend (`src/`)
| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (Static Export) |
| UI | React 19, Tailwind CSS 4, Framer Motion |
| Icons | Lucide React |
| Toasts | Sonner |
| Font | Space Grotesk (sans), JetBrains Mono (mono) |
| Tests | Vitest + @testing-library/react + jsdom |

### Desktop (`src-tauri/`)
| Layer | Tech |
|-------|------|
| Framework | Tauri 2.10 (Rust) |
| Features | Tray icon, frameless transparent window, auto-updater, WebView bot setup |
| Security | CSP enabled, shell scope restricted to `node` |
| Signing | Tauri updater signature (minisign) |

### Backend (`core/`)
| Layer | Tech |
|-------|------|
| Runtime | Node.js ≥ 22 |
| Language | TypeScript 5 (`strict: true`) |
| Discord client | Custom Gateway + REST (`core/discord/`) |
| Bot client | discord.js v14 (official, slash commands) |
| WebSocket | `ws` on port 4040 |
| Validation | Zod schemas |
| Database | SQLite via `better-sqlite3` |
| Tests | Vitest |

---

## Project Structure

```
.
├── src/                          # Next.js Frontend
│   ├── app/
│   │   ├── globals.css           # Corona design system
│   │   ├── layout.tsx            # Root layout + TitleBar
│   │   ├── page.tsx              # Main dashboard (login + tabs)
│   │   └── website/page.tsx      # Landing page
│   ├── components/
│   │   ├── TitleBar.tsx          # Custom frameless window controls
│   │   ├── QuestPanel.tsx        # Discord quest completion UI
│   │   ├── SetupWizard.tsx       # 5-step bot setup (welcome/instructions/token/auto/done)
│   │   ├── __tests__/            # Component tests
│   │   └── ui/
│   │       ├── GlassCard.tsx     # Solid-surface card with optional corona glow
│   │       ├── GlowButton.tsx    # Minimal amber button
│   │       ├── AnimatedTabs.tsx  # Spring-animated tab navigation
│   │       ├── Console.tsx       # Log viewer
│   │       └── ConnectionStatus.tsx # Connection state indicator
│   ├── hooks/
│   │   ├── useWebSocket.ts       # WebSocket connection + reconnection
│   │   ├── useAnimation.ts       # Custom status animation
│   │   ├── useRichPresence.ts    # RPC/Rich Presence builder
│   │   ├── useQuests.ts          # Quest system
│   │   ├── useAutobump.ts        # Auto bump timer
│   │   ├── useUpdater.ts         # Auto-update checker
│   │   └── __tests__/            # Hook tests
│   ├── test/
│   │   └── setup.ts              # Vitest setup (jest-dom matchers)
│   └── lib/
│       ├── utils.ts              # cn() helper
│       ├── notification.ts       # Window focus tracking
│       └── websocket/types.ts    # Frontend WS message types
│
├── src-tauri/                    # Rust/Tauri Desktop
│   ├── src/
│   │   ├── main.rs               # Entry point
│   │   ├── lib.rs                # Setup, tray, Node.js spawn, invoke handlers
│   │   ├── discord_extractor.rs  # DPAPI token extraction (Windows)
│   │   └── setup_webview.rs      # WebView2 portal + injected JS (banner, auto-fill, token detect)
│   ├── capabilities/             # Tauri v2 permission scopes
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── core/                         # Node.js Backend
│   ├── index.ts                  # Entry point
│   ├── EclipseCore.ts            # Orchestrator
│   ├── shared/
│   │   ├── types.ts              # WS protocol types
│   │   ├── schemas.ts            # Zod validation
│   │   ├── constants.ts          # Shared data (ASCII art, jokes, etc.)
│   │   └── __tests__/            # Schema tests
│   ├── services/
│   │   ├── AnimationService.ts   # Status + RPC animations
│   │   ├── AutoSlashService.ts   # Automatic slash command execution
│   │   ├── BackupService.ts      # Account backup
│   │   ├── BotSetupService.ts    # Automated bot app creation (API-driven, 4 steps)
│   │   ├── DatabaseService.ts    # SQLite operations
│   │   ├── Logger.ts             # Centralized logging
│   │   ├── QuestService.ts       # Discord quest completion
│   │   ├── RateLimiter.ts        # HTTP rate limiting
│   │   ├── SniperService.ts      # Nitro/giveaway sniper
│   │   ├── SpyService.ts         # User tracking
│   │   ├── StateService.ts       # State persistence
│   │   ├── TrollService.ts       # Troll features
│   │   └── WebSocketService.ts   # WS server
│   ├── handlers/
│   │   └── MessageHandler.ts     # WS message routing
│   ├── discord/
│   │   ├── DiscordGateway.ts     # Custom WebSocket Gateway client
│   │   ├── DiscordREST.ts        # Custom HTTP REST client (+ app creation endpoints)
│   │   ├── DiscordUserClient.ts  # Unified Gateway + REST facade
│   │   ├── DiscordManager.ts     # Selfbot + App Bot coordination + 57 commands
│   │   ├── types.ts              # Discord client interfaces
│   │   └── index.ts              # Barrel exports
│   ├── utils/
│   │   └── rateLimitHeaders.ts   # Rate limit header parsing
│   ├── commands.ts               # Text command handler (.prefix)
│   ├── tsconfig.json             # ES6, CommonJS, strict: true
│   ├── vitest.config.ts          # Core test configuration
│   └── package.json
│
├── .github/workflows/
│   ├── ci.yml                    # TypeScript check on push
│   └── release.yml               # Windows build on tag v* (+ .exe, .sig, latest.json)
├── vitest.config.ts              # Frontend test configuration
├── public/                       # Static assets
├── package.json                  # Root Next.js dependencies
├── next.config.ts                # Static export config
├── LICENSE                       # Eclipse Non-Commercial License v1.0
└── README.md
```

---

## Architecture

### Communication Flow
```
┌──────────────┐  invoke()   ┌───────────────┐
│  Next.js UI  │◄───────────►│  Tauri (Rust)  │
│  (WebView)   │             │  DPAPI + tray  │
└──────┬───────┘             └───────────────┘
       │ ws://localhost:4040
       ▼
┌────────────────┐
│  EclipseCore   │────► WebSocketService
└───────┬────────┘
        │
   ┌────┴────┬──────────┬──────────┬──────────┬──────────┐
   ▼         ▼          ▼          ▼          ▼          ▼
Discord  Animation  Database   TrollSvc   SniperSvc  BotSetup
Manager  Service   Service                        Service
   │
   ├── DiscordUserClient (custom Gateway + REST)
   │   ├── DiscordGateway (WebSocket gateway)
   │   └── DiscordREST (HTTP + app creation API)
   │
   └── discord.js v14 (App Bot — 57+ slash commands)
```

### Bot Setup Flow
```
1. User clicks "Setup automatique" in wizard
2. Core creates app via POST /api/v9/applications
3. Core creates bot via POST /applications/{id}/bot
4. Core resets token via POST /applications/{id}/bot/reset
5. Core generates OAuth URL → user authorizes
6. Token saved → Slash Commands active
```

### Custom Discord Client (`core/discord/`)

Anti-detection measures:
- Identify payload matches official Discord desktop client
- All delays randomized (30% jitter)
- Presence updates throttled (max 1/15s)
- Ghostping with 500-1500ms delete delay

---

## Design System — Corona

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#070709` | Deep space void |
| `--card` | `#111114` | Lunar surface |
| `--primary` | `#e69a00` | Solar corona (amber) |
| `--secondary` | `#1e1e22` | Penumbra |
| `--muted-foreground` | `#7a7671` | Dim text |
| `--destructive` | `#d4656b` | Coral danger |
| `--font-sans` | Space Grotesk | Geometric, futuristic |
| `--font-mono` | JetBrains Mono | Timestamps, code, values |

---

## Build & Development

```bash
# Dev (all layers)
npm run dev:all

# Dev (frontend only)
npm run dev

# Tests
npm test               # frontend (38 tests)
cd core && npm test     # backend (13 tests)

# Build for production
npm run build          # Next.js → /out
cd core && npx tsc     # Backend TypeScript → /dist
npx tauri build        # Windows .exe (NSIS)

# Lint
npm run lint
```

**Prerequisites:** Node.js ≥ 22, Rust ≥ 1.77, [Tauri system deps](https://v2.tauri.app/start/prerequisites/)

---

## Release

Builds are automated via GitHub Actions (`.github/workflows/release.yml`):

```bash
git tag v0.3.0
git push origin v0.3.0
```

The CI:
1. Compiles core TypeScript + installs native deps on Windows
2. Builds Next.js static export
3. Runs `tauri build` (NSIS installer, signed with updater key)
4. Uploads `.exe`, `.sig`, and `latest.json` to GitHub Releases

The `.exe` bundles `core/dist/` and `core/node_modules/` as Tauri resources.

---

## Security

- **CSP**: `default-src 'self'` + explicit allowlist for Discord CDN and localhost WebSocket
- **Token storage**: `localStorage` (local app, no remote exposure)
- **WebSocket**: `localhost:4040` only, Zod validation on all messages
- **Shell scope**: Restricted to `node` binary, args validated by Tauri
- **Updater**: Minisign-signed, verified against pubkey in `tauri.conf.json`

---

## Common Issues

| Problem | Fix |
|---------|-----|
| Port 4040 in use | `netstat -ano \| findstr :4040` → `taskkill /PID <id> /F` (Windows) |
| Core not found | `cd core && npx tsc` (ensure `dist/` exists) |
| Token extraction fails | Discord desktop must be installed and logged in (Windows only) |
| Zod validation errors | Check `core/shared/schemas.ts` — logs show details |
| Bot setup API fails | Fallback manual mode available in wizard |

---

## Notes

- ⚠️ Selfbot usage violates Discord ToS. Use on a secondary account only.
- The auto-updater requires the repo to be **public** (GitHub blocks unauthenticated requests to private releases).
- Beta status (0.x) — the project is forkable under the Eclipse Non-Commercial License v1.0.
- Contributions welcome: open an issue or PR on GitHub.
