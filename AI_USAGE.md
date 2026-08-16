# AI Usage

I built this with Claude Code as an active collaborator throughout the whole project. I'm new to Django, React Native/Expo, and mobile development in general, so a lot of the collaboration was me asking "why" before moving forward, not just accepting code.

## What AI actually did

- **Scaffolding.** Django project/app setup, Expo Router project setup, dependency wiring (`uv`, `npm`), `.gitignore`, initial DRF/CORS/SQLite settings. Not something worth hand typing.
- **A meaningful share of the application code.** Backend views, serializers, models, and the mobile screens/components were largely written by Claude Code first, then reviewed and edited by me, not typed by me from scratch and AI-assisted after the fact.
- **Concept explanations, continuously.** I don't have a Django or React Native background, so I asked for explanations as we went: how Django's URL routing maps to view functions, what `@api_view` actually does, why `ModelSerializer` looks for a nested `Meta` class, how migrations work, how SQLite differs from a client-server database like MySQL, what YOLO's output format looks like, how Gemini's Interactions API structures multi-image input, how Expo Router's file-based routing and route groups work. I asked follow-up questions until I could restate the concept back correctly, not just until the code ran.
- **Debugging real, reproduced bugs**, not guessed fixes. Every backend/mobile bug we found came from actually running the app end-to-end on my phone against the real backend and observing what broke, then root-causing from there:
  - A VLM request that timed out on-device turned out to be sequential batched API calls summing their latency (~41s for one photo); fixing it to run concurrently surfaced a second, a shared `genai.Client()` isn't thread-safe, and concurrent calls raced on its HTTP connection.
  - The review screen getting laggy with 200+ pending items turned out to be `ScrollView` rendering every card at once regardless of what was on-screen; fixed with `FlatList` virtualization plus real pagination on the backend instead of returning every row per request.
  - The review screen was found to silently pre-fill the title/author fields with a low-confidence catalog guess even for books that weren't actually in the catalog (`status: "unmatched"`). This was a real correctness bug, not just a UX nit, since a user who didn't notice could confirm a book under the wrong catalog entry.

## Decisions I made myself, including ones that overrode the AI's suggestion

- The core design philosophy behind the matcher, that an uncertain match should route to human review rather than get silently auto-confirmed, and that false positives are worse than false negatives here. Claude Code helped translate that into the actual normalize → shortlist → score → disambiguate pipeline and its thresholds.
- I asked for the partial-review/resume-later feature (a `PendingDetection` table separate from confirmed `LibraryBook` rows) after realizing a user might not want to review everything at once.
- Detection confidence threshold, crop padding, and several matching thresholds were tuned by me against real test photos, not left at whatever the AI first suggested.

