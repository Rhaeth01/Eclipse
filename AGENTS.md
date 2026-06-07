# Eclipse - Agent Documentation

## Project Overview

Eclipse is a hybrid desktop application (Tauri + Next.js + Node.js) designed as an advanced toolkit for Discord. It interfaces with the official Discord client through a selfbot architecture, providing profile customization tools, quality-of-life utilities, and various Discord server management features.

**Key Characteristics:**
- **Language**: French (UI and codebase)
- **Platform**: Windows (uses Windows DPAPI for token extraction)
- **Architecture**: Multi-process (Tauri frontend + Node.js WebSocket backend)
- **Connection**: Real-time WebSocket Gateway connection to Discord (not REST API)

## Technology Stack

### Frontend Layer
- **Framework**: Next.js 16.1.6 (Static Export mode)
- **UI Library**: React 19.2.3
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York style)
- **Language**: TypeScript 5
- **Icons**: Lucide React
- **Notifications**: Sonner (toast notifications)
- **UI Components**: Radix UI primitives
- **State Management**: React Hooks (useWebSocket, useAnimation, useRichPresence)

### Desktop Layer (Tauri)
- **Framework**: Tauri 2.10.0
- **Language**: Rust (Edition 2021)
- **Features**: System tray, window management, auto-updater
- **Security**: CSP disabled (`null`)
- **Window**: Frameless, transparent, centered (960x640 default)

### Backend Layer (Core)
- **Runtime**: Node.js
- **Language**: TypeScript (compiled to `core/dist/`)
- **WebSocket**: `ws` library on port 4040
- **Validation**: Zod schemas for type safety
- **Discord Libraries**:
  - `discord.js-selfbot-v13` - Selfbot client (user account automation)
  - `discord.js` - Official bot client (for slash commands)
- **Database**: SQLite via `better-sqlite3` (local cache/tracking)
- **Notifications**: `node-notifier` (Windows native notifications)

## Project Structure

```
.
├── src/                          # Next.js Frontend
│   ├── app/                      # App Router
│   │   ├── globals.css           # Tailwind + custom styles + animations
│   │   ├── layout.tsx            # Root layout with TitleBar
│   │   ├── page.tsx              # Main dashboard (login + app)
│   │   └── website/
│   │       └── page.tsx          # Landing page
│   ├── components/
│   │   ├── TitleBar.tsx          # Custom window controls
│   │   └── ui/                   # shadcn + custom components
│   │       ├── GlassCard.tsx     # Glassmorphism card component
│   │       ├── GlowButton.tsx    # Animated glow button
│   │       ├── AnimatedTabs.tsx  # Smooth animated tabs
│   │       ├── Console.tsx       # Terminal-style log console
│   │       └── ConnectionStatus.tsx # Animated connection indicator
│   ├── hooks/                    # Custom React hooks
│   │   ├── useWebSocket.ts       # WebSocket connection manager
│   │   ├── useAnimation.ts       # Custom status animation
│   │   └── useRichPresence.ts    # RPC/Rich Presence manager
│   └── lib/
│       ├── utils.ts              # cn() helper for Tailwind
│       └── websocket/
│           └── types.ts          # Shared WS types (frontend)
│
├── src-tauri/                    # Rust/Tauri Desktop
│   ├── src/
│   │   ├── main.rs               # Entry point
│   │   ├── lib.rs                # Tauri setup, tray, Node.js spawning
│   │   └── discord_extractor.rs  # DPAPI token extraction from Discord
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # Tauri configuration
│
├── core/                         # Node.js Backend (Modular Architecture)
│   ├── index.ts                  # Entry point (simple)
│   ├── EclipseCore.ts            # Main orchestrator class
│   ├── shared/                   # Shared types & validation
│   │   ├── types.ts              # TypeScript interfaces
│   │   └── schemas.ts            # Zod validation schemas
│   ├── services/                 # Business logic services
│   │   ├── Logger.ts             # Centralized logging
│   │   ├── WebSocketService.ts   # WS server with validation
│   │   ├── AnimationService.ts   # Status & RPC animations
│   │   ├── DatabaseService.ts    # SQLite operations
│   │   ├── BackupService.ts      # Account backup logic
│   │   ├── SpyService.ts         # User tracking/monitoring
│   │   └── TrollService.ts       # Troll features (reactroll, etc.)
│   ├── handlers/                 # Message handlers
│   │   └── MessageHandler.ts     # Routes WS messages to services
│   ├── discord/                  # Discord client management
│   │   └── DiscordManager.ts     # Selfbot + App Bot coordination
│   ├── commands.ts               # Text command handler (.prefix)
│   ├── backup.ts                 # Legacy backup (deprecated)
│   ├── tsconfig.json             # ES6/CommonJS target
│   └── package.json              # Separate dependencies
│
├── public/                       # Static assets
├── package.json                  # Root Next.js dependencies
├── next.config.ts                # Static export config
└── components.json               # shadcn/ui configuration
```

## Architecture Highlights

### Modular Core Architecture

Le backend a été refactorisé selon une architecture modulaire propre:

1. **EclipseCore** - Orchestrateur principal qui coordonne tous les services
2. **Services** - Chaque fonctionnalité isolée dans son propre service:
   - `WebSocketService` - Gère les connexions WS avec validation Zod
   - `AnimationService` - Gère les animations (Custom Status + RPC)
   - `DatabaseService` - Toutes les opérations SQLite typées
   - `BackupService` - Logique de sauvegarde du compte
   - `SpyService` - Tracking des utilisateurs cibles
   - `TrollService` - Features diverses (reactroll, deletesend, typing, autoreply)
3. **DiscordManager** - Gère les 2 clients Discord (selfbot + bot)
4. **MessageHandler** - Route les messages WS vers les services

### WebSocket Protocol (Typé)

Tous les messages WebSocket sont validés avec Zod:

```typescript
// Client -> Core
{type: 'init', token: string, appToken: string}
{type: 'start_animation', frames: AnimationFrame[], delay: number}
{type: 'set_rich_presence', name: string, appId: string, ...}
{type: 'create_backup'}

// Core -> Client
{type: 'discord_ready', user: DiscordUserInfo}
{type: 'toast', title: string, content: string}
{type: 'notification', action: NotificationAction, content: string}
{type: 'error', message: string}
```

### Frontend Hooks

Le frontend utilise des hooks React modulaires:

- `useWebSocket(url)` - Gère la connexion, les logs, les messages
- `useAnimation(wsHook)` - Gère les animations de statut
- `useRichPresence(wsHook)` - Gère la Rich Presence Discord

## Build and Development Commands

### Development
```bash
# Frontend only (Next.js dev server)
npm run dev

# Full stack (compile core + Tauri dev)
npm run dev:all

# Tauri only
npm run tauri dev
```

### Building
```bash
# Build Next.js for static export (outputs to /out)
npm run build

# Compile Core TypeScript
cd core && npx tsc

# Build desktop application
npm run tauri build
```

### Linting
```bash
npm run lint
```

## Runtime Architecture

### Process Model
1. **Tauri Process**: Hosts the WebView, manages window, spawns Node.js
2. **Node.js Core Process**: WebSocket server on `ws://localhost:4040`
3. **Discord Connections**:
   - Selfbot Client: User account automation (rich presence, animations)
   - App Bot Client: Slash commands registration and handling

### Communication Flow
```
┌─────────────────┐     invoke()      ┌──────────────────┐
│   Next.js UI    │ ◄────────────────► │   Tauri (Rust)   │
│  (WebSocket)    │                    │  (DPAPI Extract) │
└────────┬────────┘                    └──────────────────┘
         │
         │ ws://localhost:4040 (JSON + Zod validation)
         ▼
┌─────────────────┐
│   EclipseCore   │    ┌──────────────────────────────┐
│   (Orchestrator)│───►│     WebSocketService         │
└────────┬────────┘    └──────────────────────────────┘
         │
         ├─────────────┬─────────────┬─────────────┐
         ▼             ▼             ▼             ▼
┌─────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│DiscordManager│ │Animation │ │ Database │ │  Troll   │
│             │ │ Service  │ │ Service  │ │ Service  │
└──────┬──────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
       │             │            │            │
       ▼             ▼            ▼            ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ Discord  │  │   RPC    │  │ SQLite   │  │ Features │
│ Gateway  │  │ Updates  │  │  Cache   │  │          │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
```

### Auto-Login Flow
1. User provides Application Token (stored in localStorage)
2. Frontend calls Rust command `get_discord_token`
3. Rust extracts encrypted token from Discord's LevelDB using DPAPI
4. Token sent to Core via WebSocket `init` message
5. Core establishes dual Discord connections

## Key Configuration Files

### next.config.ts
- Output: `export` (static files)
- Images: `unoptimized: true` (required for static export)

### src-tauri/tauri.conf.json
- Dev URL: `http://localhost:3000`
- Frontend dist: `../out`
- Window: Frameless, transparent, decorations disabled
- Updater: Configured (GitHub releases)

### core/tsconfig.json
- Target: ES6
- Module: CommonJS
- Output: `./dist`
- Includes: `**/*.ts` (tous les fichiers TypeScript)

## Design System

### Glassmorphism UI
Le frontend utilise un design **glassmorphism** moderne avec :

- **GlassCard** : Cartes avec backdrop-blur, bordures subtiles et glow effects
- **GlowButton** : Boutons avec animations au hover, shine effects et ripple
- **AnimatedTabs** : Navigation avec transitions fluides spring physics
- **Console** : Terminal-style log viewer avec animations d'entrée/sortie

### Palette de couleurs
```css
--background: #0a0a0b        /* Fond principal */
--foreground: #fafafa        /* Texte principal */
--primary: #6366f1           /* Indigo-500 */
--secondary: rgba(255,255,255,0.08)
--muted: rgba(255,255,255,0.04)
--border: rgba(255,255,255,0.08)
```

### Animations (Framer Motion)
- **Page transitions** : `initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}`
- **Stagger children** : Délai progressif pour les listes
- **Spring physics** : `type: 'spring', bounce: 0.2`
- **Glow pulse** : Animation continue sur éléments actifs

### Effets visuels
- **Backdrop blur** : `blur(20px)` sur les cartes
- **Gradient overlays** : Dégradés subtils de blanc vers transparent
- **Box shadows** : Glow colorés selon le contexte (indigo, emerald, rose)
- **Noise texture** : Texture subtile pour le fond
- **Scanlines** : Effet terminal sur la console

### Responsive Design
- **Sidebar** : 256px fixe, collapsible sur mobile
- **Grid system** : 12 colonnes avec gap-6
- **Max-width** : 1280px pour le contenu principal

## Code Style Guidelines

### TypeScript
- Strict mode enabled in root, disabled in core
- Path alias `@/*` maps to `./src/*`
- Double quotes for strings
- Semicolons required
- Types partagés entre frontend et backend dans `core/shared/`

### Tailwind CSS
- Uses `@theme inline` for CSS variables
- Custom scrollbar styling in `globals.css`
- Dark theme by default (`dark` class on html)

### Component Patterns
- shadcn/ui components use `cva` (class-variance-authority)
- Custom `cn()` utility merges Tailwind classes
- Radix UI primitives for accessibility
- React hooks for state management (pas de contexte global)

### Backend Patterns
- Services avec injection de dépendances
- Event-driven architecture (EventEmitter)
- Validation Zod à la frontière (WebSocket)
- Logger centralisé avec niveaux (debug, info, warn, error)

## Security Considerations

### DPAPI Token Extraction
- Uses Windows `CryptUnprotectData` API
- Decrypts AES-GCM encrypted tokens from Discord's Local Storage
- Requires Discord desktop app to be installed and logged in

### Selfbot Usage
- Uses `discord.js-selfbot-v13` (unofficial, violates Discord ToS)
- Implements rate-limiting delays (600ms between actions)
- "Stealth mode" for ephemeral command responses

### Local WebSocket
- Validation Zod de tous les messages entrants
- Heartbeat pour détecter les déconnexions
- Pas d'authentification (localhost-only)

## Common Issues

### Port 4040 Already in Use
Error: `EADDRINUSE: address already in use :::4040`

**Fix (Windows)**:
```powershell
netstat -ano | findstr :4040
taskkill /PID <PID> /F
```

### Core Not Found
Ensure TypeScript is compiled:
```bash
cd core && npx tsc
```

### Validation Errors
Si vous voyez des erreurs de validation Zod:
- Vérifiez que les types dans `core/shared/schemas.ts` correspondent aux données envoyées
- Les logs du core montrent les détails des erreurs de validation

### Discord Token Not Found
- Discord desktop app must be installed and logged in
- Supports Discord Stable, PTB, and Canary
- Windows only (requires DPAPI)

## Database Schema (SQLite)

### Tables
```sql
-- Cache pour le tracking offline
friends_cache (
  id TEXT PRIMARY KEY, 
  username TEXT,
  updated_at INTEGER
)

guilds_cache (
  id TEXT PRIMARY KEY, 
  name TEXT,
  updated_at INTEGER
)

-- Persistance d'état de l'application  
app_state (
  key TEXT PRIMARY KEY,     -- 'eclipse_app_state'
  value TEXT NOT NULL,      -- JSON de l'état complet
  updated_at INTEGER
)
```

### Persistance d'État (StateService)
Sauvegarde automatique avec debounce (1s) :
- **Settings**: stealthMode, silentTyping
- **Spy Targets**: liste des utilisateurs surveillés par serveur
- **Trolls**: reactroll, deletesend, autoreply configurations
- **Animations**: frames custom status (optionnel)

**Restore au démarrage** : L'état est automatiquement restauré sauf :
- Typing indicator (risque de spam)
- Animations en cours (l'utilisateur doit relancer)

**Export/Import** : Possible via CLI ou WebSocket pour backup/restore manuel.

## File Outputs

- **Backups**: `core/backups/backup_{userId}_{timestamp}.json`
- **Database**: `core/eclipse_state.db`
- **Build**: `out/` (Next.js static export)
- **Logs**: `core/err.log`, `src-tauri/error.log`
- **Compiled Core**: `core/dist/*.js`

## Dependencies to Note

### Frontend
- `@tauri-apps/api` - Tauri bridge
- `@tauri-apps/plugin-updater` - Auto-updates
- `radix-ui` - Headless UI primitives
- `sonner` - Toast notifications

### Core
- `discord.js-selfbot-v13` - Unofficial selfbot library
- `discord.js` - Official bot client
- `better-sqlite3` - SQLite driver
- `ws` - WebSocket server
- `zod` - Schema validation

### Rust
- `aes-gcm` - Token decryption
- `winapi` - DPAPI access
- `tauri-plugin-*` - Various Tauri plugins

## Testing

No test suite is currently implemented. The project relies on manual testing during development.

## Deployment

The application is distributed as a Tauri desktop application:
1. `npm run build` - Builds Next.js to `/out`
2. `cd core && npx tsc` - Compile TypeScript core
3. `npm run tauri build` - Bundles into MSI/EXE installer
4. Auto-updater checks GitHub releases on startup
