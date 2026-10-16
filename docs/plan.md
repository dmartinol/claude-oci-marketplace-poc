# Implementation Plan

Follow [requirements.md](requirements.md). Product choices are in [decisions.md](decisions.md); keep actual command/output evidence in the existing [feasibility report](feasibility-report.md) and [implementation report](implementation-report.md).

## Current scope and evidence

The clarified developer flow requires a generated native-compatible local marketplace, visible in both `/plugin` and `/marketplace-manager`, with no developer checkout of this repository. The bootstrap stays on `main`; the demo marketplace is published on `oci-demo-marketplace` in the same GitHub repository and is selected with the supported `#ref` URL form. Earlier manager-only OCI discovery is superseded.

Existing evidence: direct-directory ORAS push/pull and Claude validation pass locally on macOS. The current Linux rehearsal installed manager 0.6.0 by URL into a fresh profile, fetched the same-repository demo branch through the helper, extracted and registered its OCI plugin, installed and invoked v1, detected and applied a same-tag v2 digest, and retained v2 after a failed update. Configurable in-session polling is implemented and focused-tested; its interactive `/config` and same-session Mac rehearsal remain part of T613.

Use Done, In progress, Backlog, or Blocked. Only mark work Done with evidence. Keep one task In progress. Do not repeat unchanged checks or add production infrastructure.

## T600 — Align the product documents

**Status:** Done. **Requirements:** R1–R15.

- [x] Align the requirements, D22, this plan, README, example guidance, and demo guide with the clarified flow; retain historical reports with a scope notice.

## T607 — Verify ORAS artifact and Claude plugin feasibility

**Status:** Done. Registry/native CLI evidence passes, and the user confirmed all manual Mac `/plugin`, component invocation, and restart checks passed. See the [Mac confirmation](feasibility-report.md#mac-manual-verification-confirmation-2026-10-15). **Requirements:** R1, R3–R8, R10, R12.

Use the configured Mac, supplied registry and credentials, and the existing complete manager or demo plugin. Do not request a prebuilt artifact from the developer.

- [x] Direct-directory ORAS push/pull and Claude validation pass locally. See the [direct-directory check](feasibility-report.md#direct-directory-oras-check-macos-2026-10-15).
- [x] Publish the directory to the configured registry and inspect its manifest with ORAS.
- [x] Pull registry layers by digest: after the Mac operator applied the observed CDN host policy, both versions pulled and validated successfully.
- [x] Generate and validate a native-compatible marketplace using local plugin paths, register it under the published name, and install through Claude. The disposable local probe retains original fixture/OCI provenance; real Git provenance belongs to T609.
- [x] Verify fresh-process CLI discovery and native replacement with v2; an injected failed pull leaves v1 installed and its source unchanged.
- [x] User confirmed marketplace visibility in `/plugin`, version 0.2.0 component invocation, and the same behavior after restarting on macOS.
- [x] Record commands, output, and blockers. Reuse prior mod/permission evidence where unchanged.

The spike can use installed CLI tools and a small disposable fixture; it does not require building the full manager first.

## G3 — Report the spike and obtain implementation approval

**Status:** Cleared. T607 evidence was reported and the user confirmed the remaining Mac checks passed. The active user instruction to implement all incomplete tasks authorizes the implementation work; do not request the same authorization again.

- [x] Report the spike before implementation and receive authorization for the proven path.

## T608 — Prepare the copyable demo and publishing instructions

**Status:** Done. **Requirements:** R2–R4, R15. **Depends on:** Existing example sources and installed tools; this documentation/fixture task is independent of G3 under the user’s instruction to execute all unblocked work. Product implementation still depends on G3.

Evidence: [T608 copied-example and bootstrap check](implementation-report.md#t608--copyable-examples-and-url-bootstrap-2026-10-15).

- [x] Keep complete v1/v2 example plugins with distinct responses.
- [x] Provide brief direct-folder ORAS commands and a GitHub marketplace JSON example using `source`.
- [x] Verify copied examples with installed tools and install the manager by URL without a manual checkout or repository scripts.

## T609 — Materialize and register OCI marketplaces

**Status:** Done. **Requirements:** R3–R7, R9–R12, R15. **Depends on:** G3.

Evidence: [T609 helper materialization](implementation-report.md#t609--materialize-and-register-oci-marketplaces-2026-10-15). The bundled helper is implemented; UI wiring is T611.

- [x] Replace the legacy payload backend with deterministic ORAS calls.
- [x] Implement `add <git-url>`: retrieve marketplace content, confirm, pull/extract/validate OCI plugins, write local plugin paths in a generated marketplace, and register with native Claude commands.
- [x] Preserve the published marketplace name, standard entries, and original Git/OCI provenance. Keep generated files in the active profile across restarts. Standard-only marketplaces use native registration.
- [x] Show one marketplace in both interfaces; listing makes no registry calls.

## T610 — Install and update through the native path

**Status:** Done. **Requirements:** R5–R8, R10, R12. **Depends on:** T609.

Evidence: [T610 native lifecycle](implementation-report.md#t610--native-installation-and-pinned-updates-2026-10-15).

- [x] Use the spike-proven Claude install/update path for manager actions and recognize installations made through `/plugin`.
- [x] Check tag metadata at startup, manual refresh, and the configured in-session interval without pulling layers.
- [x] Pull approved digests into staging, validate, and replace the generated plugin content and any native installation as required by the demonstrated path.
- [x] Keep the working plugin and recorded digest on failure. Restart activation is sufficient.

## T611 — Connect the manager UI

**Status:** Done. **Requirements:** R5, R9–R10, R13–R14. **Depends on:** T610.

Evidence: [T611 UI wiring](implementation-report.md#t611--manager-ui-and-native-tool-integration-2026-10-15).

- [x] Reuse the current mod command, confirmation, SessionStart, and Claude session-timer APIs.
- [x] Align labels/state with complete plugins; expose list, add, install, installed state, and update review.
- [x] Show a non-blocking notice, allow plugin selection, and honor session dismissal.
- [x] Require approval for downloads during add and update.

## T612 — Focused checks

**Status:** Done. **Requirements:** R3–R15. **Depends on:** T609–T611.

Evidence: [T612 focused checks](implementation-report.md#t612--focused-checks-2026-10-15).

- [x] Complete focused deterministic helper and UI checks for source parsing, generated local paths and provenance, native registration/install calls, standard compatibility, native-installed plugin discovery, metadata-only checks, approval before pulls, selected digest-pinned updates, startup notice behavior, paged selection, and keeping the working plugin on failure.
- [x] Keep the checks focused; periodic polling and its interval are covered in T615, and no broad production test framework was added.

## T613 — Rehearse the developer flow

**Status:** In progress. **Requirements:** R1–R16. **Depends on:** T608–T612, T615.

The supplied Quay demo tag was found to contain the POC repository root and has been republished from the v2 plugin directory; see the [artifact-root correction](implementation-report.md#t613--correct-the-demo-artifact-root-2026-10-15). The remaining Mac acceptance steps below still need an interactive run.

- [x] Complete the fresh-profile Linux rehearsal: validate both registered marketplace rows, native install, v1/v2 invocation, metadata-only update detection, and failed-update preservation. See [T613 same-repository developer flow](implementation-report.md#t613--same-repository-developer-flow-2026-10-15).
- [ ] On Mac, install the manager by URL in a fresh Claude profile; add the demo branch through `/marketplace-manager` and approve its confirmation/permission prompts; verify the generated marketplace in `/plugin` and the manager; invoke v1 after restart.
- [ ] Select the one-minute poll setting in `/config`; publish v2 to the same tag while the Claude session remains open; observe and approve the periodic update notice; restart and invoke v2.
- [ ] Confirm the standard-only bootstrap remains listed and the manager recognizes native installed state.

Follow the step-by-step [Mac acceptance run](demo/README.md#mac-acceptance-run-t613); no developer checkout is part of this flow.

## T614 — Finalize the short demo guide

**Status:** Done. **Requirements:** R15–R16, POC acceptance. **Depends on:** T608–T612; the T613 Linux rehearsal supplies command evidence.

- [x] Finalize and review the short walkthrough with the same-repository branch URL, direct ORAS commands, native UI expectations, verified v1/v2 responses, and simple cleanup. See [T614 final demo guide](demo/README.md) and [T614 guide review](implementation-report.md#t614--final-demo-guide-2026-10-15). README and example guidance are consistent. The final Mac manager UI check remains in T613 and does not change the published commands or cleanup path.

## T615 — Add configurable session update polling

**Status:** Done for implementation and focused checks; the live Mac `/config`/same-session demonstration remains in T613. **Requirements:** R7, R9, R13–R14, R16. **Depends on:** T611.

- [x] Implement and focused-check a five-minute default and one-minute demo choice; check tag metadata on Claude's session timer, stop the timer at session end, and avoid repeating a notice for an unchanged digest. No daemon or layer download was added. See [T615 configurable polling](implementation-report.md#t615--configurable-session-update-polling-2026-10-15).
- [ ] Complete the live Mac `/config` and same-session demonstration as part of T613.

## T616 — Browse marketplace details in the mod UI

**Status:** Backlog. **Requirements:** R1, R7, R9–R12, R17. **Depends on:** T611; use the current Mac Claude Code installation for the UI feasibility check before implementing the pane.

The manager currently returns marketplace and plugin metadata as JSON from its deterministic helper, while the mod presents a text list and native question dialogs. Add a read-only browser using Claude Code's supported mod UI. Keep native `/plugin`, existing manager commands, local-only inspection, and the standard Claude permission path intact.

- [ ] First verify that the target stock macOS Claude Code version can open and render the supported mod pane from an installed marketplace-manager plugin. Record the exact version and observed behavior. If this surface is unavailable, report the blocker and keep the text command usable; do not reach into undocumented Claude UI internals.
- [ ] Add `/marketplace-manager browse` to open the registered marketplace list and select a marketplace for details. Handle empty lists, invalid marketplace data, long names/references, and multiple marketplace/plugin entries.
- [ ] Render marketplace source and classification, then its plugin identities, descriptions, versions, installed state/scope, and sources. For OCI plugins show original tagged reference, registry, and recorded digest from local provenance; label it as the recorded digest, not a live registry check.
- [ ] Keep browsing local-only: no Git fetches, ORAS manifest calls, or layer downloads. Preserve `/marketplace-manager list` as a text fallback and do not override `/plugin`.
- [ ] Keep browse read-only. Existing install/update actions continue through their existing confirmations, permission prompts, and commands.
- [ ] Add focused UI/helper coverage for selecting a marketplace, rendering standard and OCI entries, project-scoped installed state, and no network/ORAS call during inspection. On the supported Mac, manually confirm pane rendering and that native `/plugin` still lists and installs the generated marketplace.
- [ ] Record implementation and Mac verification evidence in the existing implementation report before marking T616 Done.

## Historical work

Earlier catalog, individual-skill, and manager-only raw-source implementation remains historical evidence. Its approval and passing tests do not establish the generated-marketplace workflow. OpenShell is an optional contributor environment, not a developer prerequisite for using this POC.
