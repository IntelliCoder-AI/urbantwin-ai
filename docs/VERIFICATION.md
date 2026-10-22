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
