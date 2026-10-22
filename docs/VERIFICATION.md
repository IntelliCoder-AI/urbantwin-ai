# Release verification — October 21, 2026

This records checks actually executed in the build workspace. It is not a claim of road-safety certification or exhaustive browser compatibility.

| Check                                         | Result                                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| TypeScript and production Vite build          | Passed                                                                                                  |
| JavaScript engine and recorded-evidence tests | 23 passed                                                                                               |
| Python controller unit tests                  | 3 passed                                                                                                |
| Production-bundle browser journey             | Desktop and mobile Chromium passed                                                                      |
| SUMO generation                               | 36 runs completed (30 evaluation + 6 replay)                                                            |
| SUMO safety counters                          | Zero reported colliding vehicles and teleports in those 36 runs                                         |
| Evaluation completion                         | All released trips completed by 600 s in all 30 SUMO evaluation runs                                    |
| Reproducibility spot-check                    | Normal scenario, seed 42, both SUMO controllers: route hash and all final metrics reproduced exactly    |
| Browser blockage regression                   | No perpendicular vehicle footprint overlaps in fixed/adaptive × three scenarios × demand 1×/2×, seed 42 |
| Public deployment                             | Vercel production reached READY; HTML returned HTTP 200 through the Vercel connector                    |

The browser journey exercises navigation, live play/pause, speed, reset camera, congestion overlay, single-junction mode, seed/scenario changes, the five-seed worker, JSON downloads, local assistant, SUMO source selection and responsive overflow checks. It collects uncaught JavaScript errors and requires none.

Screenshots in `docs/screenshots/` were captured from the running application using `scripts/capture.mjs`. The source includes a GitHub Actions workflow for TypeScript, JavaScript/Python tests and production builds.

## Verification limits

- Responsive Chromium viewports were tested; Safari, Firefox and physical mobile hardware were not tested.
- The managed workspace's outbound policy blocks direct access to Vercel deployment domains. Public HTML was fetched through the authenticated Vercel connector; the UI journey ran against the local production bundle. Deployment configuration has no password or SSO protection.
- The Three.js vendor bundle is about 310 kB compressed and triggers Vite's configured uncompressed chunk-size warning. Static city geometry is merged, vehicles are instanced, and repeated experiments run in a worker. No real-device frame-rate benchmark is claimed.
- SUMO reproducibility was rerun for one paired replay scenario, rather than repeating the entire 36-run suite. All five evaluation seeds are independently recorded, and the browser's deterministic-repeat test is automated.
- Official competition guide verification and recording the final narrated demonstration video remain outstanding.

## Feature and visual audit — October 22, 2026

Executed results: production TypeScript/Vite build passed; 23 JavaScript tests passed; 3 Python tests passed; all 6 desktop/mobile browser journeys passed (4.8 minutes), with no uncaught page errors.

The audit added regression coverage for restarting a completed 600-second run, inspecting exported JSON for matched timestamps, demand changes, intersection selection, strategy switching, all three SUMO replays, disabled replay configuration, trace-fetch failure recovery, and clearing assistant answers after scenario changes. Both desktop and mobile Chromium viewports are exercised. The original navigation, playback, batch evaluation, download and responsive-layout journey remains included.

Fixed two issues found during inspection: a completed live run's stopped interval was not recreated by Restart, and assistant answers could remain visible after changing the experiment. Completed runs now also receive an accurate completion description.

The city now uses shared detailed vehicle geometry (wheels, tapered glazing, roof and lights), stable paint colors, bounded interpolation between observed vehicle positions, warm directional shadows, varied building heights and facades, balconies, rooftop utilities, sidewalk trees, curbs and streetlights. Pause displays exact simulation positions. Rendering interpolation never predicts beyond the latest observed position; while running, its display can lag the metrics by up to one simulation sample. Physics, signal timing and evaluation data were not changed. Queue colors describe road overlays, not car paint.

Desktop, mobile and junction-detail screenshots are actual local browser captures. This is still a procedural synthetic district with simplified materials and straight vehicle routes, not photorealism or a surveyed Bengaluru reconstruction. Dedicated GPU/mobile hardware frame-rate profiling and direct public-domain browser testing remain unverified; the cloud network policy permits Vercel connector fetching but blocks browser access to that domain.
