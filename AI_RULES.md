# AI_RULES.md

This document defines the core architecture, technology stack, and library usage guidelines for the **openGym** application. All AI assistants and contributors must strictly adhere to these conventions.

---

## 1. Tech Stack (Core Technologies)

- **Frontend Core:** React 19 (`react`, `react-dom`) with Vite 8 bundler, written in modern JavaScript (ES modules, JSX).
- **Routing:** `react-router-dom` (v7) using `HashRouter` for universal compatibility across web, PWA, and mobile webviews.
- **State Management:** Zustand v5 (`zustand`), split into domain/sync state (`frontend/src/store/useStore.js`) and UI modal/sheet state (`frontend/src/store/useUI.js`).
- **Mobile & Hybrid App:** Capacitor v7 (`@capacitor/core`, `@capacitor/android`, `@capacitor/ios`) for native mobile builds, plus installable PWA with service worker caching.
- **Backend & Data Storage:** Zero-framework native Node.js HTTP server (`api/server.js`) with local persistence to flat JSON files (`data/db.json`, `data/state-*.json`).
- **Authentication & Security:** WebAuthn / Passkeys powered by `@simplewebauthn/server` for passwordless, credential-safe biometric sign-in without external identity providers.
- **Notifications & Device Hardware:** Backend `web-push` (VAPID) and `@capacitor/local-notifications` for rest timers and workout reminders; Screen Wake Lock API (`frontend/src/lib/wakelock.js`) to keep display awake during sessions.
- **UI & Design System:** Custom vanilla CSS design system (`frontend/src/index.css`) with CSS custom properties (tokens for dark/light themes, 8 user-selected accent colors, hairline borders, safe-area insets) and bespoke touch-optimized controls (`frontend/src/components/ui.jsx`).
- **Domain Logic & Testing:** Pure, isolated mathematical and workout algorithms (progression rules, Greyskull LP, 1RM estimates, effort/RIR/RPE parsing, history migrations) in `frontend/src/lib/`, tested with Vitest (`vitest`).
- **Internationalization (i18n):** Zero-dependency translation engine (`frontend/src/lib/i18n.js`) supporting 12 UI languages (`frontend/src/locales/`) and on-demand loaded exercise instructions (`frontend/src/instr/`).

---

## 2. Library Usage Rules & Architecture Guidelines

### UI & Styling
- **DO NOT** install or use external UI libraries (such as shadcn/ui, Radix UI, Material UI, Chakra, or Tailwind CSS).
- **USE** the existing custom component library in `frontend/src/components/ui.jsx` (`NumberField`, `TextField`, `TextArea`, `Segmented`, `Switch`, `Sheet`, `Btn`, `Card`, `Row`, etc.).
- **USE** CSS variables and tokens from `frontend/src/index.css`. Follow the design system rules:
  - Minimum touch hit targets of 44px for interactive controls.
  - One clean typographic hierarchy (predominantly regular weight; bold only for titles).
  - Neutral surface ramp (`--bg`, `--surface`, `--surface-2`, `--surface-3`) with accent color reserved for active states.
  - Hairline separators (`--hair`, `--sep`) instead of heavy border boxes.
  - Subtle micro-interactions (~2% active press scale, 140–220ms ease-out).

### Icons & Imagery
- **DO NOT** install external icon packages (such as `lucide-react`, `react-icons`, `@heroicons/react`) or use platform-dependent emoji for UI actions.
- **USE** `frontend/src/components/Icon.jsx` for all UI icons.
- If a new icon is needed, implement it as a 24×24 stroke-based SVG glyph inside `Icon.jsx` using `currentColor` and the project stroke conventions (`--icon-stroke: 1.7`).

### State Management
- **DO NOT** introduce Redux, MobX, Recoil, or complex React Context trees.
- **USE** Zustand:
  - `useStore` (`frontend/src/store/useStore.js`) for persistent user data, workout logs, weekly plans, routine structures, settings, and network sync.
  - `useUI` (`frontend/src/store/useUI.js`) for transient bottom sheets, confirmation dialogs, modals, and toasts.

### Routing & Navigation
- **USE** `react-router-dom` v7. Keep primary routes declared in `frontend/src/App.jsx`.
- Use views located in `frontend/src/views/` (`Home.jsx`, `Workout.jsx`, `Plan.jsx`, `Stats.jsx`, `History.jsx`, `Library.jsx`, `Settings.jsx`, `Admin.jsx`, etc.).
- Use `frontend/src/lib/nav.js` (`navTo`) when navigation must be triggered outside React components.

### Backend & Persistence
- **DO NOT** introduce heavy backend web frameworks (Express, NestJS, Fastify) or external database servers (PostgreSQL, MongoDB, Redis).
- **KEEP** the API minimal and self-contained in `api/server.js` using Node.js built-in modules (`http`, `crypto`, `fs`).
- Store all persistence files in the mounted `./data` directory.

### Mobile & Native Device Capabilities
- **USE** `@capacitor/*` plugins for native platform operations (filesystem backup, local notifications, share sheets).
- **USE** standard Web APIs (Screen WakeLock, Web Share, Web Push, Service Worker) when running in browsers/PWA mode. Always provide graceful fallbacks between native and web execution environments.

### Business Logic & Testing
- Keep all progression engines, calculation formulas, data parsers, and migrations as pure, side-effect-free functions under `frontend/src/lib/`.
- Test pure domain logic with Vitest (`vitest`) using adjacent test files (e.g. `*.test.js`). Run tests via `npm test` inside `frontend/`.

### Internationalization
- All user-facing strings must be localized using `t('key')` from `frontend/src/lib/i18n.js`.
- Add new translations across the locale files in `frontend/src/locales/*.js`.
