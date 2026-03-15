<div align="center">

# Tickzy

**Real-time breakout detection for the National Stock Exchange of India.**

Track your watchlist and every Nifty 50 constituent — get instant alerts the moment a stock breaks out.

[![Next.js](https://img.shields.io/badge/Next.js_14-black?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Vercel-000?logo=vercel&logoColor=white)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Live](https://img.shields.io/badge/Live-tickzy.dev-blue)](https://tickzy.dev)

</div>

---

![Landing Page](screenshots/login-hero.png)

## What It Does

Tickzy monitors the NSE in real-time during market hours (09:15–15:30 IST). When a stock shows unusual activity — a price breakout, a moving average touch, a new 52-week high — it fires an alert instantly via browser push notification and logs it to a persistent feed.

One dashboard, zero noise. Scans your watchlist and every Nifty 50 constituent automatically.

## Features

<table>
<tr>
<td width="50%">

### Breakout Detection
Scans for stocks where the day's high exceeds the 5-day max **and** volume surges past 3x the 5-day average. Partial breaks (high-only or volume-only) are flagged separately as "On Radar."

### 8 Alert Types
True Breakout · Low Breakout · 52-Week High · 200 DMA Touch · 100 DMA Touch · 50 DMA Touch · 5 DMA Touch · Scan — each color-coded in the alert feed with type-specific metrics.

### AI Alert Builder
Describe an alert in plain English — *"Notify me when RELIANCE crosses its 52-week high on heavy volume"* — and the system creates it. Powered by natural language processing via GitHub Issues.

</td>
<td width="50%">

### Live Ticker
Real-time price streaming for starred stocks during market hours. Updates every 10 seconds with price flash animations, breakout badges, and volume indicators.

### Nifty 50 Scanner
Full interactive table of all 50 constituents with sortable columns, breakout strength bars (H% / V%), and one-click watchlist additions. Auto-refreshes every 3 minutes during trading.

### Push Notifications
Browser notifications fire the instant an alert triggers, with a 5-minute cooldown per stock to prevent spam. Works alongside the persistent in-app alert feed.

</td>
</tr>
</table>

## Screenshots

<details>
<summary><strong>Landing Page</strong> — Cinematic hero with GSAP scroll animations</summary>

![Landing Hero](screenshots/login-hero.png)

![Landing Features](screenshots/login-features.png)

</details>

<details open>
<summary><strong>Dashboard</strong> — Watchlist cards, alert feed, scan controls</summary>

![Dashboard](screenshots/dashboard.png)

</details>

<details>
<summary><strong>Full Dashboard View</strong></summary>

![Dashboard Full](screenshots/dashboard-full.png)

</details>

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) + React 18 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 3.4 + GSAP animations |
| Data Source | [`stock-nse-india`](https://www.npmjs.com/package/stock-nse-india) (NSE API wrapper) |
| Persistence | Upstash Redis (primary) + filesystem JSON (local fallback) |
| Validation | Zod |
| Auth | HMAC-SHA256 session cookies |
| Testing | Vitest + Testing Library |
| Deployment | Vercel (serverless) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/Zetta-tech/NSE-stock-data.git
cd NSE-stock-data

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials (see Environment Variables below)

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your configured credentials.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_USERNAME` | Yes | Login username |
| `AUTH_PASSWORD` | Yes | Login password |
| `ADMIN_USERNAME` | Yes | Admin username (can bypass lockdown) |
| `ADMIN_PASSWORD` | Yes | Admin password |
| `AUTH_SECRET` | Yes | Session signing key — generate with `openssl rand -hex 32` |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis URL (falls back to filesystem locally) |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis token |
| `GITHUB_TOKEN` | No | For AI alert builder (GitHub Issue creation) |
| `GITHUB_REPO` | No | Target repo for alert issues |

## Deployment

The app deploys to **Vercel** on push to `main`:

1. Set environment variables in the Vercel dashboard
2. Ensure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured (required in production)
3. Push to `main` — Vercel auto-builds and deploys

## Development

```bash
npm run dev          # Dev server (port 3000)
npm run typecheck    # Type check (must pass before PRs)
npm run lint         # ESLint
npm test             # Run test suite
npm run test:watch   # Watch mode
```

> **Note:** Use `npm run typecheck` to check for errors, not `npm run build` (which restarts the dev server).

## Learn More

For architecture details, alert internals, and API reference, see the [Wiki](https://github.com/Zetta-tech/NSE-stock-data/wiki):

- [Architecture](https://github.com/Zetta-tech/NSE-stock-data/wiki/Architecture) — Stack, data flow, persistence, caching
- [Alert System](https://github.com/Zetta-tech/NSE-stock-data/wiki/Alerts) — 8 alert types, detection logic, lifecycle
- [API Capability Map](https://github.com/Zetta-tech/NSE-stock-data/wiki/API-Capability-Map) — NSE API methods and usage
- [Development Guide](https://github.com/Zetta-tech/NSE-stock-data/wiki/Development) — Environment setup, commands, testing
- [Code Standards](https://github.com/Zetta-tech/NSE-stock-data/wiki/Code-Standards) — Component rules, data fetching patterns

---

<div align="center">
<sub>MIT Licensed. Live at <a href="https://tickzy.dev">tickzy.dev</a></sub>
</div>
