# Project History: NSE Stock Scanner → Tickzy

This is the development history of what started as a personal stock breakout detection dashboard for the National Stock Exchange of India and grew into a public product called Tickzy. The app monitors a watchlist and all Nifty 50 constituents, detects unusual price and volume activity, fires browser notifications, and lets users build custom alerts in plain English. Built on Next.js 14, Upstash Redis, and the `stock-nse-india` NPM package, and deployed on Vercel.

---

## Phase 1: Initial Scanner (Feb 16, 2026 — PRs 1–9)

The entire application was built in a single day. Eight pull requests landed on February 16, each layering on a new capability.

### PR #1 — Add Nifty stock breakout scanner with real-time alerts
**Branch:** `claude/nifty-stock-scanner-mzC0A` | **Merged:** Feb 16

The complete first version: a scanner engine in `scanner.ts` that detects 5-day high and volume breakouts, an NSE data client using the `stock-nse-india` library, a dashboard with stock cards and an alert panel, and a notification bell with unread count. Default watchlist seeded with INFY, HDFCBANK, SBIN, HAL, RELIANCE.

### PR #2 — Revamp add-stock UX with Nifty 50 search and overhaul UI polish
**Branch:** `claude/nifty-stock-scanner-mzC0A` | **Merged:** Feb 16

The add-stock modal was rebuilt to search the full Nifty 50 list with keyboard navigation. The whole UI shifted to a deeper charcoal palette, glass-morphism header, animated progress bars on stock cards, and a shimmer loading indicator during scans.

### PR #3 — Add in-memory caching for historical stock data
**Branch:** `claude/add-historical-cache-WsR78` | **Merged:** Feb 16

Introduced a `historicalCache` Map keyed by symbol and date (IST timezone) to avoid redundant NSE API calls when the same stocks are scanned multiple times in a day. Different lookback windows cached separately.

### PR #4 — Make stale intraday data an explicit state instead of a silent fallback
**Branch:** `claude/add-historical-cache-WsR78` | **Merged:** Feb 16

When a live intraday fetch fails during market hours, results are now tagged `dataSource: "stale"` rather than quietly falling back. Stale results suppress breakout triggers and show a warning badge on affected stock cards.

### PR #5 — Add Close Watch auto-check feature for starred stocks
**Branch:** `claude/add-close-watch-feature-JWMWH` | **Merged:** Feb 16

Users can now star individual stocks for continuous monitoring. A 30-second polling loop scans only starred stocks, merges results into the main list without replacing full scan data, and de-duplicates alerts by tracking state transitions (not-triggered → triggered).

### PR #6 — (Minor housekeeping merge)
**Branch:** `claude/add-close-watch-feature-JWMWH` | **Merged:** Feb 16

### PR #7 — Fix visual distinction, notification spam, and state persistence
**Branch:** `claude/add-close-watch-feature-JWMWH` | **Merged:** Feb 16

Close Watch cards gained an amber left border, pulsing "Watching" badge, and GSAP star-toggle animation. A 5-minute per-symbol notification cooldown eliminated notification spam. State now persists to `data/state.json` so the watchlist and alerts survive server restarts.

### PR #8 — Make app Vercel-compatible with Upstash Redis persistence
**Branch:** `claude/add-close-watch-feature-JWMWH` | **Merged:** Feb 16

Replaced filesystem-only persistence with async store functions that use Upstash Redis when configured and fall back to local files in dev. Added `maxDuration` to API routes for Vercel timeout handling.

### PR #9 — Add dev dashboard with activity timeline, system state, and support mode
**Branch:** `claude/add-close-watch-feature-JWMWH` | **Merged:** Feb 16

A developer console was born: an activity timeline tracking every user action and system event, a Current State panel showing market status, last scan, data health, and cache stats. A hidden `?support=true` URL param enables raw log tables and expandable event JSON.

---

## Phase 2: UI Polish Iterations (Feb 17–21, 2026 — PRs 10–29)

After the initial build, a period of rapid UI iteration began — with multiple passes at the dashboard layout, visual design system, and feature additions baked in alongside cosmetic changes.

### PR #10 — Dashboard: add status strip, Close Watch hero section, animations and alert polish
**Branch:** `codex/implement-ui-improvements-for-dad-first-fintech` | **Merged:** Feb 17

Added a compact status strip at the top, split the watchlist into a pinned "Close Watch" hero section and a secondary "All Watchlist Stocks" section, and moved alerts into a receipt-style panel. Introduced GSAP list motion on watchlist updates.

### PR #11 — Refine dashboard flow and reduce visual clustering
**Branch:** `codex/...` | **Merged:** Feb 17

Replaced the dense multi-pill strip with a collapsible `SystemStatus` summary, made the primary CTA context-driven (Auto-check ON/OFF when market is open, Manual Scan when closed), and limited the live ticker to 5 Close Watch stocks.

> **Note:** PR #12 immediately reverted #11 (visual regression), and the changes were re-applied cleanly in subsequent PRs.

### PR #13 — Align dashboard styling with dark-lime cockpit direction
**Branch:** `codex/...` | **Merged:** Feb 17

Switched the global font to Manrope and updated CSS tokens to a dark neutral base with lime accent, moving the UI toward a deliberate "trading cockpit" aesthetic.

### PR #14 — Add Nifty 50 Index display and enrich activity timeline with actor/change tracking
**Branch:** `claude/add-close-watch-feature-JWMWH` | **Merged:** Feb 18

A live Nifty 50 index badge appeared in the header (with flash-on-change). Activity events now record `actor` (user/system/auto-check), `changes` (field/from/to diffs), and `snapshot` (what the system saw when the event fired).

### PR #15 — Auto-start live ticker when a stock is starred for Close Watch
**Branch:** `claude/add-close-watch-feature-JWMWH` | **Merged:** Feb 18

The ticker now activates automatically when any stock is starred, removing the need to manually press "Start".

### PR #16 — Respect market hours for live features and add API throttle KPI
**Branch:** `claude/add-close-watch-feature-JWMWH` | **Merged:** Feb 18

All live features (Nifty 50 polling, live ticker, auto-watch) now respect IST market hours: they auto-start at open and auto-pause at close. The dev dashboard gained an API Throttle KPI showing call rate vs the 3 req/s NSE best practice, plus API/cache/CDN split.

### PR #17 — Eliminate unnecessary NSE API calls after market hours
**Branch:** `claude/add-close-watch-feature-JWMWH` | **Merged:** Feb 18

Outside extended hours, `getMarketStatus()` returns immediately without hitting NSE. `getNifty50Index()` serves a cached closing value. The header makes only one fetch on mount (resolved from server-side cache), with no polling interval.

### PR #18 — (Minor housekeeping merge)
**Branch:** `claude/add-close-watch-feature-JWMWH` | **Merged:** Feb 19

### PR #19 — Add low-break alert: trigger when LTP falls below 10-day lowest low
**Branch:** `claude/add-close-watch-feature-JWMWH` | **Merged:** Feb 19

The first bearish alert type: fires when the real-time LTP drops below the minimum daily low of the past 10 trading days. Added `lowBreakTriggered`, `prev10DayLow`, and `lowBreakPercent` fields. Alert panel split into separate Breakout and Low-Break tables with distinct red styling.

### PR #20 — Fix low-break desktop notifications and notification bell styling
**Branch:** `claude/add-close-watch-feature-JWMWH` | **Merged:** Feb 20

Low-break alerts now fire from manual scans too (not just auto-check). Notification bell items gained distinct green (breakout) and red (low-break) badges with type-specific detail rows.

### PR #21 — Add /api/candles with Vercel CDN caching for historical candle data
**Branch:** `claude/add-close-watch-feature-JWMWH` | **Merged:** Feb 21

Historical candle data was moved behind a CDN-cacheable GET route (`s-maxage=3600, stale-while-revalidate=43200`), so repeated dashboard refreshes hit the Vercel edge instead of re-invoking the serverless function. The dev dashboard shows CDN hit/miss/stale counts.

> **Note:** PRs #22–#25 were a sequence of accidental merges and their immediate reverts (merge conflict chaos during the Nifty 50 table feature branch). They are preserved in history but changed no net behaviour.

### PR #26 — (Nifty 50 table branch re-merge after reverts)
**Branch:** `claude/add-nifty-50-table-twmSQ` | **Merged:** Feb 21

### PR #27 — Enhance Nifty 50 alerts, visual cues, loading UX, and Dev portal
**Branch:** `claude/add-nifty-50-table-twmSQ` | **Merged:** Feb 21

Nifty 50 table rows gained breakout glow borders, strength indicator bars for partial breaks, pulsing breakout dots, a market sentiment gauge (gainers/losers), and creative cycling loading messages. Activity logging added for Nifty 50-triggered alerts.

### PR #28 — Add comprehensive test suite with Vitest configuration and fixtures
**Branch:** `claude/add-nifty-50-table-twmSQ` | **Merged:** Feb 21

Introduced Vitest with contract tests covering: Nifty 50 API routes, market hours utilities, NSE client snapshot parsing, breakout detection logic, and alert deduplication.

### PR #29 — Modernize design system and component styles
**Branch:** `claude/add-nifty-50-table-twmSQ` | **Merged:** Feb 21

Updated color palette (accent `#00e68a`, warning `#f5a623`), switched typography to Satoshi/Clash Display, added ring-based borders and card elevation styles, refined all component styling for visual consistency.

---

## Phase 3: Layout & Features (Feb 22–25, 2026 — PRs 30–40)

With the core product stable, attention shifted to information architecture, layout, and adding the last pre-auth features.

### PR #30 — Redesign dashboard layout with NIFTY 50 rail and sidebar alerts
**Branch:** `claude/fintech-ui-redesign-bkQgO` | **Merged:** Feb 22

The dashboard was restructured into a two-column layout: a sticky alerts sidebar on the right and a new `nifty50-rail.tsx` horizontal scrolling component showing all Nifty 50 stocks with live data. The rail auto-refreshes every 3 minutes during market hours.

### PR #31 — Redesign dev console with two-column layout and action flow hero
**Branch:** `feat/dev-console-redesign` | **Merged:** Feb 22

The dev dashboard was restructured: activity timeline (62%) as the hero column, condensed sidebar (38%) with 7 state cards collapsed into a dense 2-column mini-grid and collapsible sections. CSS-only SVG grid background added.

### PR #32 — Add Vercel Speed Insights
**Branch:** `vercel/vercel-speed-insights...` | **Merged:** Feb 23

Installed and configured `@vercel/speed-insights` in the Next.js layout.

### PR #33 — Add retry logic for NSE API calls and persist scan results
**Branch:** `claude/fix-stock-live-rates-yjYZ5` | **Merged:** Feb 23

`withRetry()` now wraps every NSE API call: on failure it resets the NSE singleton (clears stale cookies) and retries once. Scan results persist to Redis so they survive page refreshes. Alert panel filtered to show only today's alerts.

### PR #34 — Surface Nifty 50 breakout discoveries on dashboard and fix dev stats tracking
**Branch:** `claude/fix-stock-live-rates-yjYZ5` | **Merged:** Feb 23

A `DiscoveryFeed` component shows Nifty 50 breakout stocks not in the user's watchlist, with one-click "Add to Watchlist". Browser notifications fire for Nifty 50 discoveries (with 5-minute cooldown). Nifty 50 fetch stats moved from in-memory to Redis to fix "Degraded" state caused by cross-Lambda isolation on Vercel.

### PR #35 — Fix skewed stock card grid layout
**Branch:** `fix/stock-card-grid-layout` | **Merged:** Feb 24

Cards in the same grid row were inconsistent heights due to variable content. Applied `flex-col h-full` layout with `mt-auto` anchoring for status pills and stale warnings at the bottom.

### PR #36 — Change volume alert to 3× average instead of max volume
**Branch:** `fix/stock-card-grid-layout` | **Merged:** Feb 24

The volume breakout condition was changed from "exceeds 5-day max volume" to "exceeds 3× the 5-day average daily volume" — a more meaningful signal. Updated scanner, baselines, Nifty 50 route, UI labels, and tests.

### PR #37 — Include high-only break symbols in scan results and fire alerts for them
**Branch:** `claude/fix-stock-live-rates-yjYZ5` | **Merged:** Feb 25

The Nifty 50 scan was silently discarding high-only breaks. They now create dedicated `"high-break"` alerts, appear in the discovery feed, and are distinguished from full breakouts in the alert panel (HB vs BO badges).

### PR #38 — Filter notifications to only true breakouts with volume
**Branch:** `claude/disable-high-only-notifications-RAAr4` | **Merged:** Feb 25

`notifyDiscoveries()` now filters on `fullBreakout === true` before sending browser notifications, reducing noise while keeping high-only breaks visible in the feed.

### PR #39 — Fix overlapping content in starred stock cards
**Branch:** `claude/disable-high-only-notifications-RAAr4` | **Merged:** Feb 25

Status badges (WATCHING, BREAKOUT, LIVE, STALE) moved from inline with the symbol name to their own row below, preventing collisions with the price display on starred cards.

### PR #40 — Add 3D tilt effect to stock cards on pointer movement
**Branch:** `claude/update-remote-url-Zu1JR` | **Merged:** Feb 25

Each stock card now tilts in 3D as the pointer moves across it, using GSAP `quickTo` with `power3` easing for smooth rotation (±8°). Resets to neutral on `pointerleave`.

---

## Phase 4: Auth & Security (Feb 25–27, 2026 — PRs 41–47)

The dashboard was previously open to anyone. Four days of security work locked it down properly.

### PR #41 — Add basic auth with cookie-based session
**Branch:** `claude/update-remote-url-Zu1JR` | **Merged:** Feb 25

`middleware.ts` now intercepts all routes and redirects to `/login` without a valid session cookie. `/api/auth` validates credentials from env vars and sets a 30-day HttpOnly cookie. Session token = HMAC-SHA256(AUTH_SECRET, AUTH_PASSWORD).

### PR #42 — Use Web Crypto API and fail closed on missing env vars
**Branch:** `claude/update-remote-url-Zu1JR` | **Merged:** Feb 25

Two security fixes: replaced `import { createHmac } from 'crypto'` with the Web Crypto API (Edge runtime compatible), and added an explicit guard that returns 500 before touching the request if any auth env var is missing.

### PR #43 — Redesign login page with cinematic UI
**Branch:** `gemini/login-page-redesign` | **Merged:** Feb 26

The login page was rebuilt with glassmorphism containers, GSAP entrance stagger animations, a noise texture overlay, and magnetic hover buttons. Added `lucide-react` for premium iconography.

### PR #44 — Add admin lockdown mode and session rotation controls
**Branch:** `claude/lockdown-session-rotation-d6fVP` | **Merged:** Feb 26

A floating admin controls panel (accessible from the header) lets an admin activate a timed lockdown (15m–24h) that blocks regular user access, and rotate all sessions to force re-authentication.

### PR #45 — Fix: don't grant lockdown bypass on login
**Branch:** `claude/lockdown-session-rotation-d6fVP` | **Merged:** Feb 26

Closed a hole where anyone with the password could log in via `/api/auth` (a public path) and receive a lockdown-bypass cookie during an active lockdown. The bypass cookie is now only issued from the admin panel.

### PR #46 — Separate admin credentials for lockdown bypass
**Branch:** `claude/lockdown-session-rotation-d6fVP` | **Merged:** Feb 26

Added `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars. During lockdown, regular credentials authenticate but remain blocked; admin credentials authenticate and receive the bypass cookie.

### PR #47 — Persist API stats to Redis with cache scope labels
**Branch:** `claude/lockdown-session-rotation-d6fVP` | **Merged:** Feb 27

API call tracking extracted to a dedicated `api-stats` module with Redis persistence via `hincrby` pipeline. Stats flush lazily on each `/api/state` poll. Dev dashboard gained scope badges (Per-Instance / Cross-Instance) and a Cumulative row showing all-time totals from Redis.

---

## Phase 5: AI Alert Builder + Alert Types (Mar 1–8, 2026 — PRs 48–84)

The biggest phase of the project. A natural-language alert builder was introduced, and six new alert types were implemented alongside major UI overhauls.

### PR #48 — Add Claude Code GitHub Workflow
**Branch:** `add-claude-github-actions-...` | **Merged:** Feb 28

Installed the Claude Code GitHub Actions workflow, enabling an AI coding agent to respond to issues and open PRs automatically.

### PR #50 — AI Alert Builder
**Branch:** `feat/alert-builder` | **Merged:** Mar 1

The centerpiece feature: a text input where the user types a plain-English alert request ("notify me when RELIANCE drops 3%") which creates a GitHub Issue tagged `agent:create-alert`. A Claude Code Action workflow picks up the issue, implements the alert, and opens a PR for review. Shipped with AGENTS.md, architecture docs, Claude skills, a Redis+FS storage layer, and the GitHub Actions workflow.

### PR #53 — Redesign AlertsSection into bento card with GSAP counter popovers
**Branch:** `feat/alert-builder` | **Merged:** Mar 1

The alerts section became a compact bento card with a header showing configured/WIP badge counts. Clicking a badge opens a GSAP-animated popover listing the alert types with their status.

### PR #54 — Add Low Breakout push alerts (high-only price break)
**Branch:** `feat/alert-builder` | **Merged:** Mar 1

Added `"low-breakout"` to the alert type union and wired it into the Nifty 50 route: fires when a stock breaks its high without volume confirmation. Shown as amber "LOW BREAK" in the notification bell.

### PR #55 — Modernize dashboard UI with Market Terminal aesthetic and GSAP animations
**Branch:** `feat/market-terminal-ui-modernization` | **Merged:** Mar 1

A comprehensive dashboard UI pass bringing a "market terminal" aesthetic, refined GSAP entrance animations throughout.

### PR #57 — Add 52-week high alert
**Branch:** `feat/alert-52-week-high` | **Merged:** Mar 1

Added `"week-high"` alert type. For watchlist stocks, fires when `todayHigh >= yearHigh` during a live scan. For Nifty 50 stocks, uses `dayHigh >= yearHigh` from the snapshot (works without a 5-day baseline). Deduped per symbol per day.

### PR #58 — Migrate agent workflow to OAuth, add alert status controls and builder hint
**Branch:** `feat/market-terminal-ui-modernization` | **Merged:** Mar 1

Switched the `agent-create-alert` workflow from API key to `CLAUDE_CODE_OAUTH_TOKEN` to route usage through subscription billing. Added "Mark Implemented" / "Reject" buttons to the dev dashboard. Added an info tooltip to the AlertBuilder with prompt tips.

### PR #59 — Derive configured alert types from implemented requests
**Branch:** `feat/market-terminal-ui-modernization` | **Merged:** Mar 1

`configuredAlertTypes` is now built at render time by merging the two built-in types with any alert requests marked `"implemented"`, so the CFG count updates automatically when a request is marked done.

### PR #60 — Update alert types section with count, naming, and refresh fixes
**Branch:** `feat/market-terminal-ui-modernization` | **Merged:** Mar 1

Renamed section header to "Alert Types", included all non-rejected requests in CFG count, added amber "BUILDING" status for in-progress types in the popover, and stripped "Create Alert:" prefix from display names.

### PR #61 — Implement tactile gallery with dynamic spotlight
**Branch:** `feat/tactile-gallery-ui-modernization` | **Merged:** Mar 1

Stock cards upgraded with `rounded-[2rem]`, deeper `bg-surface` background, and a dynamic spotlight that follows the pointer within each card for dramatic depth effects.

### PR #62 — Fix overflow-hidden to clip closeWatch warning strip
**Branch:** `feat/tactile-gallery-ui-modernization` | **Merged:** Mar 1

Fixed a regression from the card redesign where the warning stripe bled outside card bounds due to a missing `overflow-hidden`.

### PR #64 — 200-day moving average touch alert
**Branch:** `feat/alert-ma200-touch` | **Merged:** Mar 2

New `ma200-alert.ts` module: `checkMa200Touch()` fetches 200 days of history, computes the 200-day SMA, and fires a `"ma200-touch"` alert when the current close is within 1% of it. Wired into the scan pipeline after breakout and week-high checks.

### PR #65 — Fix alert types display, lifecycle sync, and agent registration
**Branch:** `fix/alert-types-display-and-lifecycle` | **Merged:** Mar 2

Fixed the popover to derive its list from fired alerts + `ALERT_TYPE_LABELS`, fixed clipping on overflow, and added an `alert-request-sync` GitHub workflow that auto-marks requests as `implemented` or `rejected` when the implementing issue is closed.

### PR #67 — Add 100-day moving average touch alert
**Branch:** `feat/alert-ma100-touch` | **Merged:** Mar 2

New `ma100-alert.ts` following the same pattern as the 200 DMA. Fires `"ma100-touch"` when close is within 1% of the 100-day SMA. Registered in `ALERT_TYPE_LABELS` as "100 DMA Touch".

### PR #68 — Replace popover alert types with always-visible inline chips
**Branch:** `fix/alert-types-inline-display` | **Merged:** Mar 2

Removed ~170 lines of GSAP popover state and replaced with always-visible inline pill chips in the card body. Active types show a green dot; building types show a pulsing amber "BUILDING" label. Simpler, always correct, and better for demos.

### PR #69 — Update landing page copy to match product pitch
**Branch:** `fix/alert-types-inline-display` | **Merged:** Mar 2

All landing page copy updated to reflect the actual product: 24/7 NSE-wide monitoring, instant push notifications, and the AI-powered alert builder.

### PR #70 — Enhance login page visuals for product demo
**Branch:** `feat/login-page-visual-enhancements` | **Merged:** Mar 2

Restored the abstract liquid gradient background on the hero. The AI Alert Builder feature card now shows animated filter token tags (Vol > Avg, 52W High) to visually represent plain-English alert inputs.

### PR #73 — Restore star/remove button click handling on stock cards
**Branch:** `feat/login-page-visual-enhancements` | **Merged:** Mar 2

Fixed a z-index stacking conflict where the card content area (`z-10`) was painting over the action buttons (`z-10`) because it appeared later in DOM order. Bumped buttons container to `z-20`.

### PR #75 — Add 50 DMA and 5 DMA touch alerts
**Branch:** `feat/ma50-ma5-dma-alerts` | **Merged:** Mar 2

Two more alert types in one PR: `"ma50-touch"` and `"ma5-touch"`, using the same 1% threshold as the 100/200 DMA variants. Registered in `ALERT_TYPE_LABELS` as "50 DMA Touch" and "5 DMA Touch".

### PR #76 — Surface fired alerts as a typed card feed in the dashboard
**Branch:** `feat/login-page-visual-enhancements` | **Merged:** Mar 2

Today's fired alerts now appear as a horizontal-scroll card feed below the alert-type chips. Each card shows badge, symbol, price, change %, and type-specific metrics (progress bars for breakouts, DMA price + gap % for moving average alerts). Per-type color system: green, amber, purple, sky, teal. Deleted the old `alert-panel.tsx` as dead code.

### PR #77 — Restore ALERT_STYLES config lost in merge
**Branch:** `fix/alerts-section-merge` | **Merged:** Mar 2

A merge conflict between #75 and #76 dropped the `AlertTypeStyle` interface and `ALERT_STYLES` constant, causing a build failure on Vercel. This PR restored the full config map, adding `ma50-touch` (indigo) and `ma5-touch` (rose) styles.

### PR #78 — Add comprehensive public README with screenshots
**Branch:** `fix/alerts-section-merge` | **Merged:** Mar 4

Documented the project publicly for the first time with a full README.

### PR #81 — Three-column dashboard layout
**Branch:** `gemini/dashboard-three-column-layout` | **Merged:** Mar 5

Dashboard refactored to a three-column layout for better information density.

### PR #82 — Creative alert differentiation with GSAP animations and grouped categories
**Branch:** `gemini/dashboard-three-column-layout` | **Merged:** Mar 5

Today's alerts grouped into semantic categories: Breakouts, New Highs, Moving Averages — each with a colored accent bar and gradient separator. Lucide icons per alert type with GSAP hover micro-animations (bounce, lift, rotation). Breakout cards get a scanning gradient edge glow while hovered.

### PR #83 — Implement low-breakout detection with red styling and 10-day baselines
**Branch:** `fix/alerts-section-merge` | **Merged:** Mar 5

Fixed a long-standing bug: the Nifty 50 route was firing low-breakout alerts on high-only breaks rather than actual low breaks. Added `minLow10d` and `maxVolume10d` to `StockBaseline`, wired the real bearish condition, and restyled low-breakout cards red with a `TrendingDown` icon.

### PR #84 — 5 system design improvements for reliability and efficiency
**Branch:** `fix/alerts-section-merge` | **Merged:** Mar 8

Five production reliability improvements from `docs/system-design-ideas.md`:
1. **Idempotent alert writes** — Redis `SET NX` guard with 30-minute time windows prevents duplicate alerts from concurrent Lambda invocations.
2. **Distributed scan debounce lock** — `acquireScanLock()` via Redis `SET NX EX 30` returns cached results with a countdown when a scan is already running. The scan button shows "Scan in progress... Xs".
3–5. Additional data integrity and API efficiency improvements.

---

## Phase 6: Public Launch — Tickzy (Mar 15–28, 2026 — PRs 85–89)

After six weeks of private use, the project was rebranded and prepared for public launch at tickzy.dev.

### PR #85 — Rebrand to Tickzy for public launch
**Branch:** `feat/tickzy-public-launch` | **Merged:** Mar 15

The app was renamed from "NSE Stock Scanner" to Tickzy across the README, login page, layout metadata, and AGENTS.md. Added an email registration system for early access signups (public `/api/register` and admin `/api/admin/registrations` endpoints). Added MIT License, `robots.txt`, and Open Graph meta tags with `metadataBase: tickzy.dev`. Renamed `ActivityActor` from `"dad"` to `"user"` throughout.

### PR #86 — Refine stock card animations and expand/collapse UX
**Branch:** `feat/tickzy-public-launch` | **Merged:** Mar 15

GSAP expand/collapse animations tuned with `expo.out` and `back.out(1.2)` easing. Expanded cards gain a state-aware right accent bar (green pulse for breakout, orange for stale/close-watch). Cleaned up decorative thumbnail areas for a simpler card design.

### PR #87 — Add demo browser mockup with intro video on landing page
**Branch:** `feat/tickzy-public-launch` | **Merged:** Mar 16

A scroll-animated browser mockup section on the landing page shows a platform demo video (1.9MB MP4, converted from a 13MB GIF). Middleware updated to exclude static asset extensions from auth processing.

### PR #88 — Add 3D platform tour section with deep-dive dashboard video
**Branch:** `feat/tickzy-public-launch` | **Merged:** Mar 16

A second landing page section below the features list: a scroll-triggered 3D isometric reveal (rotateX/Y, scale, `expo.out` easing) of a styled browser frame playing `platform-tour.mp4`, with a glossy `mix-blend-overlay` screen effect and ambient gold glow.

### PR #89 — Prepare for public launch
**Branch:** `cleanup/public-repo-prep` | **Merged:** Mar 28

Final cleanup before the repo went public: removed `.claude/` agent tooling from git tracking, documented the AI Alert Builder workflow in `docs/ALERTS.md`, and cleaned up `CLAUDE.md`.

---

*89 pull requests across 40 days, from zero to a deployed public product.*
