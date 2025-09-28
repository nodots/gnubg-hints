# Plan: Integrating `gnubg-hints` with the nodots-backgammon Ecosystem

## 1. Objectives and Success Criteria
- Provide nodots applications with GNU Backgammon-quality move, double, and take hints via the existing native addon API without blocking gameplay flows.
- Maintain type compatibility with the `@nodots-llc/backgammon-types` models consumed by `@nodots-llc/backgammon-core` while keeping GNU Backgammon logic isolated from the core game rules implementation.
- Deliver a production-ready package (or service) that can be deployed alongside other nodots services with automated testing, monitoring, and documentation.

Success will be measured by:
- End-to-end hint retrieval inside a nodots application using a real `BackgammonBoard` from the core library.
- Integration tests that exercise move hint, double, and take APIs across representative match states.
- Automated build artifacts (npm package or container image) published to the nodots package registry and deployable in staging.

## 2. Current State Assessment
1. **GNU Backgammon hint engine** – The `gnubg-node-addon` already wraps GNU Backgammon's evaluation logic in a Node.js native addon with async APIs for move, double, and take hints, using TypeScript types from `@nodots-llc/backgammon-types`.【F:gnubg-node-addon/README.md†L1-L93】
2. **nodots backgammon core** – The `@nodots-llc/backgammon-core` package provides gameplay state, move validation, and player turn management for nodots products, exporting board representations compatible with the hint addon.【e17a0a†L8-L89】
3. **Gaps** – There is no documented workflow to pull game state from `backgammon-core`, send it to the hint addon, and surface results to clients. Build/release automation for combining the repositories is also undefined.

## 3. Integration Strategy Overview
We propose a four-phase plan that separates discovery, infrastructure, product integration, and rollout.

### Phase A – Alignment & Architecture (1–2 sprints)
1. **Repository strategy** – Keep `gnubg-hints` as a standalone, GPL-licensed npm package that nodots applications consume as a dependency. Maintain the native addon source in this repository while incrementally porting surfaces to TypeScript definitions. Define a release pipeline (e.g., GitHub Actions) that builds multi-platform binaries, runs tests, and publishes tagged releases to the nodots npm scope (and mirrored public registry if required) with automated changelog generation.
2. **API compatibility matrix** – Verify that `BackgammonBoard` and related DTOs emitted by `backgammon-core` map cleanly to the hint requests defined by the addon. Capture any normalization/conversion requirements (e.g., checker ordering, cube owner enums) in documentation and unit tests.
3. **Resource management plan** – Benchmark addon initialization, concurrent request handling, and shutdown semantics so they can be embedded in stateless services or long-running Node.js workers. Define caching strategy for neural-network weights, thread pool sizing, and per-request timeouts.
4. **Security & licensing review** – Confirm GPL obligations when embedding GNU Backgammon in nodots offerings, and establish OSS attribution documentation and distribution requirements.

### Phase B – Infrastructure & Packaging (2–3 sprints)
1. **Build automation** – Create CI jobs that compile the native addon for Linux, macOS, and Windows targets with the Node.js versions supported by nodots. Publish artifacts to a private npm registry or attach to releases.
2. **Containerization** – If nodots uses container deployments, build a minimal image that bundles the addon, neural network weights, and any required runtime dependencies. Validate startup time and memory usage.
3. **Configuration management** – Externalize evaluation parameters (plies, move filters, pruning) and weight paths so they can be tuned per environment without code changes.【F:gnubg-node-addon/README.md†L21-L76】
4. **Observability hooks** – Standardize logging, metrics, and tracing around the addon using nodots conventions (e.g., `[Core]` logger structure). Ensure hint requests/responses can be correlated with gameplay events from `backgammon-core` logs.【e17a0a†L91-L168】

### Phase C – Application Integration (2–4 sprints)
1. **Core-library bridge** – Implement a TypeScript bridge module inside the nodots ecosystem that takes a `Play` or `Game` state from `backgammon-core`, derives the required hint request payload, and invokes the addon asynchronously. Include fallback logic when hints are unavailable.
2. **Feature flag rollout** – Wrap hint consumption in a configurable feature flag to allow gradual enablement across products. Support toggling move hints, cube actions, and take decisions independently.
3. **Client experience** – Update any UI/API layers (web, mobile, or backend services) to consume the new hints. Provide presentation models with rank, equity, cube decisions, and differences as surfaced by the addon.【F:gnubg-node-addon/README.md†L47-L92】
4. **Error handling** – Define retry/backoff strategies and user messaging when evaluations fail or time out. Capture diagnostics for debugging (input board state, dice, cube status) while respecting privacy/security policies.

### Phase D – Verification & Rollout (2 sprints)
1. **Testing strategy**
   - Unit tests for the bridge module converting between core game state and addon requests.
   - Integration tests simulating match scenarios that call the addon and verify hint ordering, cube decisions, and take/drop advice.
   - Performance tests measuring throughput under simultaneous hint requests.
2. **Staging validation** – Deploy to a staging environment, run shadow sessions comparing addon recommendations with baseline heuristics, and gather stakeholder sign-off.
3. **Operational readiness** – Finalize runbooks, SLOs, alerting thresholds, and on-call playbooks. Document upgrade procedures for neural-network weights and addon versions.
4. **Launch & feedback loop** – Roll out behind flags, monitor telemetry, collect player feedback, and schedule follow-up improvements (e.g., batch processing, offline caching).

## 4. Dependencies & Open Questions
- Confirm licensing/distribution obligations for combining GPL code with nodots commercial offerings.
- Determine long-term ownership for maintaining the native addon and GNU Backgammon updates.
- Decide whether hint evaluation should run server-side, client-side, or both (impacts build targets and packaging).
- Evaluate hardware requirements (CPU vs. GPU) for target platforms and potential need for horizontal scaling.

## 5. Deliverables Checklist
- ✅ Architectural decision record covering deployment model and licensing stance.
- ✅ CI/CD pipelines producing tested artifacts for all supported environments.
- ✅ Documentation for developers (setup, usage examples, troubleshooting) and operators (metrics, alerts, runbooks).
- ✅ Automated test suite integrated into nodots pipelines with coverage thresholds.
- ✅ Feature-flagged release across nodots applications with monitoring dashboards tracking hint usage and performance.

## 6. Timeline Snapshot (adjustable)
| Phase | Duration | Key Milestones |
| --- | --- | --- |
| A | 1–2 sprints | Compatibility matrix, architecture decision record |
| B | 2–3 sprints | Multi-platform builds, container image, config/observability |
| C | 2–4 sprints | Bridge module, client updates, feature flags |
| D | 2 sprints | Staging sign-off, operational readiness, production rollout |

Total estimate: 7–11 sprints depending on team capacity and licensing outcomes.
