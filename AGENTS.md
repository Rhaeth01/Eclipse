# Eclipse — Agent Documentation

## Project Overview

Eclipse is a desktop application (Tauri + Next.js + Node.js) designed as an advanced toolkit for Discord. It connects to Discord's Gateway via a **custom WebSocket client** — no third-party selfbot library.

**Key Characteristics:**
- **Language**: French (UI and codebase), English (commit messages)
- **Platform**: Windows (DPAPI token extraction), Linux supported for dev
- **Architecture**: Multi-process (Tauri window + Node.js backend via WebSocket)
- **Discord connection**: Custom Gateway + REST client (drops `discord.js-selfbot-v13`)
- **Design system**: Corona palette (amber/gold on deep black, Space Grotesk typography)

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

### Desktop (`src-tauri/`)
| Layer | Tech |
|-------|------|
| Framework | Tauri 2.10 (Rust) |
| Features | Tray icon, frameless transparent window, auto-updater |
| Security | CSP enabled, shell scope restricted |
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
| Dependencies | ws, zod, discord.js, better-sqlite3, fs-extra |

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
│   │   └── ui/
│   │       ├── GlassCard.tsx     # Solid-surface card with optional corona glow
│   │       ├── GlowButton.tsx    # Minimal amber button (no shine sweep)
│   │       ├── AnimatedTabs.tsx  # Spring-animated tab navigation
│   │       ├── Console.tsx       # Clean log viewer (no terminal clichés)
│   │       └── ConnectionStatus.tsx # Connection state indicator
│   ├── hooks/
│   │   ├── useWebSocket.ts       # WebSocket connection + reconnection
│   │   ├── useAnimation.ts       # Custom status animation
│   │   ├── useRichPresence.ts    # RPC/Rich Presence builder
│   │   ├── useQuests.ts          # Quest system
│   │   ├── useAutobump.ts        # Auto bump timer
│   │   └── useUpdater.ts         # Auto-update checker
│   └── lib/
│       ├── utils.ts              # cn() helper
│       ├── notification.ts       # Window focus tracking
│       └── websocket/types.ts    # Frontend WS message types
│
├── src-tauri/                    # Rust/Tauri Desktop
│   ├── src/
│   │   ├── main.rs               # Entry point
│   │   ├── lib.rs                # Setup, tray, Node.js spawn via resource path
│   │   └── discord_extractor.rs  # DPAPI token extraction (Windows)
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
│   │   └── constants.ts          # Shared data (ASCII art, jokes, etc.)
│   ├── services/
│   │   ├── AnimationService.ts   # Status + RPC animations
│   │   ├── AutoSlashService.ts   # Automatic slash command execution
│   │   ├── BackupService.ts      # Account backup
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
│   │   ├── DiscordREST.ts        # Custom HTTP REST client
│   │   ├── DiscordUserClient.ts  # Unified Gateway + REST facade
│   │   ├── DiscordManager.ts     # Selfbot + App Bot coordination
│   │   ├── types.ts              # Discord client interfaces
│   │   └── index.ts              # Barrel exports
│   ├── utils/
│   │   └── rateLimitHeaders.ts   # Rate limit header parsing
│   ├── commands.ts               # Text command handler (.prefix)
│   ├── tsconfig.json             # ES6, CommonJS, strict: true
│   └── package.json
│
├── .github/workflows/
│   ├── ci.yml                    # TypeScript check on push
│   └── release.yml               # Windows build on tag v*
├── public/                       # Static assets
├── package.json                  # Root Next.js dependencies
├── next.config.ts                # Static export config
└── REFACTOR_PLAN.md              # Migration plan (archived)
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
   ┌────┴────┬──────────┬──────────┬──────────┐
   ▼         ▼          ▼          ▼          ▼
Discord  Animation  Database   TrollSvc   SniperSvc
Manager  Service   Service
   │
   ├── DiscordUserClient (custom Gateway + REST)
   │   ├── DiscordGateway (WebSocket gateway)
   │   └── DiscordREST (HTTP with official headers)
   │
   └── discord.js v14 (App Bot — slash commands)
```

### Custom Discord Client (`core/discord/`)

Replaces the deprecated `discord.js-selfbot-v13` with ~1400 lines of custom code:

- **DiscordGateway** — WebSocket identify with 20+ properties, heartbeat jitter, resume
- **DiscordREST** — HTTP client with official User-Agent, X-Super-Properties (Base64), rate limiting
- **DiscordUserClient** — EventEmitter facade, cache management, object builders

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

No glassmorphism, no gradient orbs, no noise textures, no scanlines. Solid surfaces with subtle borders.

---

## Build & Development

```bash
# Dev (all layers)
npm run dev:all

# Dev (frontend only)
npm run dev

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
git tag v0.1.0
git push origin v0.1.0
```

The CI:
1. Compiles core TypeScript + installs native deps on Windows
2. Builds Next.js static export
3. Runs `tauri build` (NSIS installer, signed with updater key)
4. Uploads `.exe` to GitHub Releases

The `.exe` bundles `core/dist/` and `core/node_modules/` as Tauri resources. At launch, Tauri resolves the resource path and spawns `node` on `core/dist/index.js`.

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

---

## Notes

- ⚠️ Selfbot usage violates Discord ToS. Use on a secondary account only.
- The auto-updater requires the repo to be **public** (GitHub blocks unauthenticated requests to private releases).
- The custom client is a drop-in replacement — the API surface matches `discord.js-selfbot-v13`.
