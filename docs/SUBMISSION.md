# UrbanTwin AI — Zeta Innovate 2026 submission package

**Tagline:** Simulate the City. Solve the Congestion.

**Repository:** https://github.com/IntelliCoder-AI/urbantwin-ai

**Public application:** https://urbantwin-ai-omega.vercel.app (Vercel production deployment reports READY).

**Target:** November 1, 2026 (provided by the project owner; not independently verified as the official deadline).

## Project description

UrbanTwin AI is an interactive traffic intelligence laboratory that makes signal-control decisions visible and testable. A procedural 3D district inspired by Bengaluru lets users observe traffic, change demand, and compare conventional fixed-time signals with an explainable adaptive controller. Its Counterfactual Traffic Lab runs both strategies against matched synthetic inputs, showing not only average waiting, but queues, throughput, stops, worst waiting and approach equality.

## Problem statement

Traffic-signal proposals are difficult for non-specialists to assess. A visually persuasive demonstration can conceal unfair baselines, different traffic inputs, incomplete trips or unsupported improvement claims. UrbanTwin connects a navigable city to an explicit experiment: change the controller, hold demand constant, and inspect the outcomes and limitations.

## Innovation and differentiators

1. **A counterfactual rather than a standalone animation.** Two synchronized worlds share inputs and expose the effect of one control decision.
2. **Fast exploration plus independently reproducible SUMO evidence.** A live browser model responds to custom conditions; separately labeled SUMO traces provide microscopic simulation evidence without a server bill.
3. **Fairness beside efficiency.** Mean waits appear alongside worst accumulated waiting, directional equality and unfinished trips.
4. **Explainable intelligence without paid dependencies.** A queue-and-age controller makes decisions with visible safeguards. A local assistant interprets the current evidence rather than generating unsupported promises.
5. **Exportable evidence.** Matched seed results, route hashes, sample definitions and confidence intervals are downloadable and reproducible from source.

## Technical architecture

React + TypeScript + Vite; Three.js, React Three Fiber and Drei for 3D; Recharts for metrics; a Web Worker for repeated browser experiments; Python, SUMO 1.28.0 and TraCI for offline evaluation. Static deployment on Vercel. No database, external AI API or persistent backend is required.

See [methodology](METHODOLOGY.md) for network definitions, controller timing, metric denominators and evaluation results. The observed five-seed SUMO mean waiting reductions were 34.60%, 50.15% and 48.09% for normal, rush and incident demand, respectively, against the simple equal-split fixed baseline. These are synthetic-model results, not expected improvements on actual Bengaluru roads.

## Screenshots

- [Desktop city overview](screenshots/overview-desktop.png)
- [Mobile city overview](screenshots/overview-mobile.png)
- [Counterfactual lab and five-seed results](screenshots/counterfactual-lab.png)
- [Methodology and SUMO evidence](screenshots/methodology.png)

The screenshots are captures of the working application, not concept renders. Additional counterfactual and methodology captures can be included with the final competition materials.

## Demonstration video instructions (3 minutes)

Record at 1440×900 or 1920×1080, with system audio off and narration on. Use seed 42 and disclose synthetic data in the opening frame. Do not splice two different scenarios into one apparent before/after comparison.

- **0:00–0:20 — The question.** “What changes when the same traffic gets a different signal strategy?” Show the city overview and the synthetic-data/source labels. Orbit the district and select a junction.
- **0:20–0:45 — Working controls.** Pause, resume, switch signal strategy, then open Control center. Show the one-junction foundation and return to four junctions. Explain that changing the seed or demand starts a new matched experiment.
- **0:45–1:25 — Counterfactual lab.** Select rush hour, open the lab and play at 16×. Show the same clock, waiting curves, throughput, worst wait and fairness. Explain that partial-run values are not final conclusions.
- **1:25–1:55 — Repeated evidence.** Run the five-seed browser evaluation. Export the JSON. Switch to the recorded SUMO source, identify it as prerecorded, and show the separate SUMO evaluation in Methodology.
- **1:55–2:20 — Incident and interpretation.** Select the incident scenario. Show how the 90–180 s restriction affects queues. Ask the local assistant which intersection has the highest approaching demand and what to test next. For a concrete trade-off, the live browser model at seed 42, incident, demand 1×, four junctions and 600 seconds records mean waiting of 79.239 s fixed versus 46.612 s adaptive, but 1,897 stops fixed versus 2,272 adaptive. Lower waiting does not mean every metric improves. These numbers were reproduced on October 26, 2026; keep them separate from SUMO evidence.
- **2:20–2:45 — Why the evidence is credible.** Show matched seeds, route hashes, green limits and clearance intervals in the methodology/source. State the fixed-baseline limitation and the synthetic nature of the results.
- **2:45–3:00 — Close.** “A better city starts with a fair experiment.” Display the verified application and repository links. Future work: calibrated demand, multimodal routes and real-world validation.

## Submission checklist and unresolved requirements

- Working source, local setup, controller tests, simulation exports, screenshots and demo script are included.
- A final narrated demonstration video still needs recording; no video is claimed to have been produced.
- No official public Zeta Innovate 2026 Candidate Guide was located in the web search performed for this build. Verify eligibility, permitted tools, judging criteria, team size, video length, submission portal, intellectual-property conditions and deadline against the actual guide when supplied.
- This package does not submit an entry to the competition or imply official endorsement.

## Known limitations and future improvements

See README and methodology. Priorities are calibrated inputs, turning movements, pedestrian phases, two-wheelers and transit, stronger baselines, more seeds, real-device performance checks and independently reviewed signal safety. Persistent experiment storage can be added if collaboration justifies the operational cost.
