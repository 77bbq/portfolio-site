# Portfolio Refresh Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for the main presentation work, with an independent content task and final review.

**Goal:** A natural, light robotics portfolio for recruiters and personal project browsing.

**Architecture:** Keep Astro's static rendering, Markdown collection and existing routes. Change presentation components and CSS; surface only supported project facts from existing content.

**Tech Stack:** Astro, TypeScript, CSS, Markdown, Vitest; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-23-portfolio-refresh-design.md`

## Global Constraints

- Preserve existing working changes and project body text.
- Preserve base-path handling, stage sections, dynamic counts, responsive images and accessible links.
- Never invent responsibilities, technologies, measurements or contact details.
- All work stays local; do not commit or publish.

## Review Focus

- Narrow screens and long titles must fit without horizontal scrolling.
- Portrait photos must show complete robot structure.
- Missing covers and incomplete content must remain readable.
- Optional facts and actions must remain conditional.
- Project identity, links and content collection must work for an added project and deployment prefixes.

### Task 1: Content facts and draft identity

Files: project frontmatter under `src/content/projects/`; existing content tests.

- [x] Preserve all project bodies; add concise, supported summaries and verified award metadata. Only RoboMaster has supported personal duties.
- [x] Rename DROID_SLAM draft and its slug consistently to droid-slam; existing content test currently fails on this mismatch.
- [x] Run unit tests and inspect changed frontmatter.

### Task 2: Presentation

Files: `src/pages/index.astro`, `src/components/{Header,Footer,ProjectGrid,ProjectCard}.astro`, `src/styles/global.css`, optional layout metadata.

- [x] Replace dashboard-like hero with compact personal introduction and useful project anchors.
- [x] Give graduate projects a horizontal layout and undergraduate projects a two-column photo layout, single-column on mobile.
- [x] Use restrained typography, separators and a text cover fallback; conditionally display project outcomes.
- [x] Add an output test that checks displayed outcomes against configured metrics, then build and run output tests.

### Task 3: Verification and review

- [x] Run type checking, unit/output tests, production build and site audit.
- [x] Inspect desktop/mobile screenshots and a detail page; verify overflow, navigation and imagery.
- [x] Obtain an independent final review and address material findings.

## Progress and decisions

- Initial unit run: 57 pass, 1 fails because the DROID_SLAM directory does not match its draft slug.
- User chose light presentation and both recruiter/personal audiences. Continue in the existing dirty workspace to preserve its current work; no worktree or commit operations.
- Full verification exposed an existing script issue: unquoted exclude globs expanded into positional test filters, causing output tests to run before the temporary project build. Quoted the patterns in package.json; full pnpm verify now passes, including 58 unit tests, 42 output tests, Astro diagnostics, extensibility and site audit.
- Independent review found low contrast in secondary text. Changed --quiet to #68645a; computed contrast is 5.504:1 on paper, 4.806:1 on the fallback background, and 4.991:1 on the deeper paper.
- Browser checks at 1440px, 390px and 320px: no overflowing main content or broken images. Inspected RoboMaster and DROID-SLAM details on mobile. Screenshots are in /tmp/portfolio-{desktop,mobile,detail,notes}.png.
- All eight project body hashes remained unchanged. Repeated original responsibilities in five projects still need author input; no substitute duties were invented.
