# TODOS

Design and technical debt tracked from review sessions.

---

## Landing Page (src/app/login/page.tsx)

### TODO: CSS custom properties for brand colors
**What:** Extract `#0D0D12`, `#C9A84C`, `#FAF8F5` and spacing values into CSS variables in `globals.css`. Replace all ~40 hardcoded hex occurrences in login/page.tsx.
**Why:** A single accent color change currently requires find-and-replace across the entire file. CSS variables make the design system maintainable.
**Pros:** Consistent theming, trivial color changes, opens door to dark/light mode variants.
**Cons:** Refactor-only, no user-visible change.
**Context:** Flagged during design review 2026-03-30. `Frontend-aesthetics.md` specifies "Use CSS variables for colors and spacing for consistency."
**Depends on:** None.

---

### TODO: Video poster images for demo and platform tour
**What:** Add `poster=` attribute to both `<video>` elements in login/page.tsx — the demo browser mockup (`/intro-video.mp4`) and the platform tour (`/platform-tour.mp4`).
**Why:** If either video fails to load (slow connection, missing file, video codec issue), both sections show as empty dark rectangles. These are the two most visually important sections on the landing page.
**Pros:** Graceful degradation, better first-paint experience before video loads.
**Cons:** Requires exporting static screenshots from the dashboard as `/public/demo-poster.jpg` and `/public/tour-poster.jpg`.
**Context:** Flagged during design review 2026-03-30. No `onerror` handler or `<source>` fallback currently exists.
**Depends on:** Screenshots of the dashboard at a good representative frame.

---

### TODO: Test iOS Safari protocol stacking section
**What:** The "How It Works" protocol section uses `h-screen` with `sticky top-0` on each card. Test this on iOS Safari (real device or BrowserStack).
**Why:** This combination has known rendering bugs on iOS Safari — sticky elements don't always release correctly, causing scroll jumps or cards that don't unpin properly.
**Pros:** Catch mobile Safari regression before users report it.
**Cons:** Requires iOS device or BrowserStack access. Fix may require switching `h-screen` to `h-[100dvh]` or restructuring the pinning approach.
**Context:** Flagged during design review 2026-03-30. Protocol stacking uses GSAP ScrollTrigger `pin: true` + `pinSpacing: false`.
**Depends on:** None.

---

### TODO: prefers-reduced-motion guards on GSAP animations
**What:** Wrap all `gsap.fromTo()`, `gsap.to()`, and `ScrollTrigger` animations in `login/page.tsx` in a `window.matchMedia("(prefers-reduced-motion: reduce)").matches` check. Elements should still appear in their final state — just without animated transitions.
**Why:** Users with vestibular disorders see all animated elements firing simultaneously on scroll. This is a WCAG 2.1 Level AA requirement (Success Criterion 2.3.3).
**Pros:** Accessibility compliance, better experience for ~35% of users who enable reduced motion.
**Cons:** Requires wrapping every GSAP block (~6 animations). Minor effort.
**Context:** Flagged during design review 2026-03-30, deferred by user. Affects: hero entrance, navbar morph, demo section, tour 3D reveal, philosophy word-by-word, protocol stacking.
**Depends on:** None.
