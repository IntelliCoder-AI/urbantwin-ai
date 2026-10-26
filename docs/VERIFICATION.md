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

The final visual review also found repeatedly restarted chart entrance animations during fast playback. Live chart paths now render immediately; the browser journey asserts both strategy curves are present. The production build and both desktop/mobile journeys passed again after that change.

## User audit fixes — October 26, 2026

Implemented bounded assistant intents with an off-topic response, junction ranking/ties/empty-demand handling, approach wait evidence, scenario mismatch guidance and explicit stops trade-offs. Added view paths with browser history and an application not-found page, seed draft validation plus explicit application, fixed timing labels, consistent 1/2/4/8/16× speeds, explicit adaptive-versus-fixed KPI text, a separate SUMO evidence panel, a polite live region for the 3D error fallback, and persistent GitHub/feedback footer links.

Reproduced the reported incident browser experiment (seed 42, demand 1×, four junctions, 600 s): fixed waiting 79.2389937107 s / 1,897 stops; adaptive waiting 46.6116352201 s / 2,272 stops. No traffic-engine or evidence files changed.

Identical final fixed-time states at junctions 03/04 are expected: their shared 72-second cycle (30+3+3 seconds per axis) leaves both at 24 seconds of East–West green at t=600. Empty queues reflect cleared demand. Inspected all three SUMO seed-42 traces: junctions 03/04 differ in 328–354 fixed-controller snapshots and 600 adaptive snapshots out of 601, so the display is not duplicating one junction's data. Browser incident final adaptive states also differ (24.5 vs 22.5 s North–South green).

Validation executed: 43 unit/evidence tests passed and the production build passed. The initial 12 desktop/mobile browser journeys passed 11 checks and caught a mobile CSS rule hiding footer links. After removing that rule, all six focused desktop/mobile audit journeys passed again (50.7 seconds). The other journeys had already passed, including five-seed batch/export, all SUMO replays, completion restart and failure recovery. A separate screenshot run collected zero console errors and zero uncaught page errors across Control center, assistant and methodology. Screenshots include seed validation, a junction-specific answer, and the visibly separate SUMO evidence panel. The same public-domain browser and physical-device limits above still apply.

## Follow-up: historical ranking and mixed-topic questions

Added cumulative per-junction detected stopped time at 0.5 s resolution to both engines and exports. Regenerated all six seed-42 SUMO runs (three scenarios × two controllers). Compared every regenerated frame with the previous traces after removing only the new `junctionWaiting` property: all pre-existing positions, queues, signal states and metrics matched exactly, as did demand hashes. The published five-seed evaluation tables were not regenerated or changed.

An independent single-junction geometric test integrates stopped observations and checks the new browser counter at every step, including frozen snapshot objects and reset behavior. The published browser incident waiting/stops outcome remains exactly reproducible. SUMO evidence checks enforce monotonic per-junction counters and ensure their sum does not exceed total released-cohort waiting. Mixed-topic tests cover traffic combined with recipes, stock recommendations, poetry, instruction overrides and an unrelated emoji. Scope rejection is conservative and may reject otherwise valid paraphrases.

Follow-up validation passed: production build; 53 JavaScript unit/evidence tests; 3 Python controller tests; 12 desktop/mobile browser audit journeys (4.5 minutes); and 2 additional desktop/mobile paired-playback/export journeys (37.6 seconds). The paired test actually advances both simulations, pauses them, checks matching frozen clocks, parses the current-run JSON, runs all five seeds, parses the batch JSON and verifies matched released cohorts and 600-second completion times. The end-of-run UI test asks both historical and current junction questions after 600 seconds and verifies different, appropriate answers. No uncaught page errors were recorded by these browser journeys.

The follow-up screenshot capture also recorded zero console errors and zero uncaught page errors; `docs/screenshots/cumulative-junction-evidence.png` shows the run-so-far answer with units and exclusions.
