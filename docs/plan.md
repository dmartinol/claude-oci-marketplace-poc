# Implementation Plan

Follow [requirements.md](requirements.md). Product choices are in [decisions.md](decisions.md); keep actual command/output evidence in the existing [feasibility report](feasibility-report.md) and [implementation report](implementation-report.md).

## Current scope and evidence

The clarified developer flow requires a generated native-compatible local marketplace, visible in both `/plugin` and `/marketplace-manager`, with no developer checkout of this repository. Earlier manager-only OCI discovery is superseded.

Existing evidence: direct-directory ORAS push/pull and Claude validation pass locally on macOS. The current Linux spike also passes registry push/pull by digest, generated marketplace registration, native v1 install/v2 update, and failed-pull preservation. macOS interactive behavior and the complete manager workflow remain unverified. The current manager still uses the legacy individual-skill backend.

Use Done, In progress, Backlog, or Blocked. Only mark work Done with evidence. Keep one task In progress. Do not repeat unchanged checks or add production infrastructure.

## T600 — Align the product documents

**Status:** Done. **Requirements:** R1–R15.

The requirements, D22, this plan, README, example guidance, and demo guide describe the clarified flow. Historical reports retain their evidence with a scope notice.

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

The spike was reported before implementation. The user’s instruction to execute all tasks, followed by confirmation of the final Mac checks, supplies authorization for the proven path. Full implementation may proceed.

## T608 — Prepare the copyable demo and publishing instructions

**Status:** Done. **Requirements:** R2–R4, R15. **Depends on:** Existing example sources and installed tools; this documentation/fixture task is independent of G3 under the user’s instruction to execute all unblocked work. Product implementation still depends on G3.

Evidence: [T608 copied-example and bootstrap check](implementation-report.md#t608--copyable-examples-and-url-bootstrap-2026-10-15).

- [x] Keep complete v1/v2 example plugins with distinct responses.
- [x] Provide brief direct-folder ORAS commands and a GitHub marketplace JSON example using `source`.
- [x] Verify copied examples with installed tools and install the manager by URL without a manual checkout or repository scripts.

## T609 — Materialize and register OCI marketplaces

**Status:** Done. **Requirements:** R3–R7, R9–R12, R15. **Depends on:** G3.

Evidence: [T609 helper materialization](implementation-report.md#t609--materialize-and-register-oci-marketplaces-2026-10-15). The bundled helper is implemented; UI wiring is T611.

- Replace the legacy payload backend with deterministic ORAS calls.
- Implement `add <git-url>`: retrieve marketplace content, confirm, pull/extract/validate OCI plugins, write local plugin paths in a generated marketplace, and register with native Claude commands.
- Preserve the published marketplace name, standard entries, and original Git/OCI provenance. Keep generated files in the active profile across restarts. Standard-only marketplaces use native registration.
- Show one marketplace in both interfaces; listing makes no registry calls.

## T610 — Install and update through the native path

**Status:** Done. **Requirements:** R5–R8, R10, R12. **Depends on:** T609.

Evidence: [T610 native lifecycle](implementation-report.md#t610--native-installation-and-pinned-updates-2026-10-15).

- Use the spike-proven Claude install/update path for manager actions and recognize installations made through `/plugin`.
- Check tag metadata at startup/manual refresh without pulling layers.
- Pull approved digests into staging, validate, and replace the generated plugin content and any native installation as required by the demonstrated path.
- Keep the working plugin and recorded digest on failure. Restart activation is sufficient.

## T611 — Connect the manager UI

**Status:** In progress. **Requirements:** R5, R9–R10, R13–R14. **Depends on:** T610.

Reuse the current mod command, confirmation, and SessionStart architecture. Align labels/state with complete plugins; expose list, add, install, installed state, and update review. Show a non-blocking notice, allow plugin selection, and honor session dismissal. Downloads during add and update require approval.

## T612 — Focused checks

**Status:** Backlog. **Requirements:** R3–R15. **Depends on:** T609–T611.

Cover source parsing, generated local paths and provenance, native registration/install calls, standard compatibility, native-installed plugin discovery, metadata-only checks, approval before pulls, selected digest-pinned updates, and keeping the working plugin on failure. Prefer focused deterministic helper tests; no broad production test framework.

## T613 — Rehearse the developer flow

**Status:** Backlog. **Requirements:** R1–R15. **Depends on:** T608–T612.

Run the seven acceptance steps in requirements.md on the configured Mac with a fresh Claude profile. Use the published manager and a separate GitHub marketplace; copy examples without cloning the POC. Verify both plugin interfaces, v1 invocation, same-tag update notice, v2 after restart, and a failed update. Record concise command/output evidence without secrets.

## T614 — Finalize the short demo guide

**Status:** Backlog. **Requirements:** R15, POC acceptance. **Depends on:** T613.

Replace provisional guidance with verified commands, native UI expectations, v1/v2 responses, and simple cleanup. Keep README and examples consistent. Do not add separate per-release documentation.

## Historical work

Earlier catalog, individual-skill, and manager-only raw-source implementation remains historical evidence. Its approval and passing tests do not establish the generated-marketplace workflow. OpenShell is an optional contributor environment, not a developer prerequisite for using this POC.
