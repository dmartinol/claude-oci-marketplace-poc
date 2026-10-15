# Claude Marketplace Manager POC Requirements

## Goal and developer flow

Demonstrate OCI distribution of a complete Claude plugin containing a developer's skill, using stock Claude Code on macOS.

1. The developer creates a Claude plugin, or copies a provided example.
2. From the plugin root, the developer uses ORAS to package and publish it to their Quay repository.
3. The developer publishes a Claude marketplace configuration on GitHub. For the POC, the bootstrap marketplace stays on `main` and the demo marketplace uses a branch in this same repository; no second repository is required. Each OCI plugin uses the existing `plugins[].source` field for its raw tagged OCI reference.
4. The developer installs marketplace-manager through Claude's native marketplace commands and adds their GitHub marketplace with `/marketplace-manager add <git-url>`.
5. After approval, the manager retrieves the marketplace content, pulls and extracts its OCI plugins with ORAS, and registers a generated local marketplace that Claude understands. Its plugin sources point to the extracted plugin directories.
6. The developer can view the marketplace and install its plugins through either `/plugin` or `/marketplace-manager`.
7. The developer publishes a new plugin version to the same OCI tag. At session startup, manual refresh, or the configured in-session polling interval, the manager detects the changed digest and offers an update. The developer approves it and restarts Claude to use the new version.

The developer never needs to clone this POC repository or run its development scripts. Claude and the manager may retrieve Git content internally. Copying example plugin files is allowed.

## Requirements

| ID | Requirement |
| --- | --- |
| R1 | Run on stock Claude Code, with macOS as the first demo environment. Do not fork Claude or override `/plugin`. |
| R2 | Publish marketplace-manager through this repository's valid bootstrap marketplace so the developer can install it by URL with native Claude commands. |
| R3 | The developer's GitHub marketplace declares OCI plugins in `.claude-plugin/marketplace.json` with `name`, `description`, and a raw tagged OCI reference in `source`, without `oci://`. Do not use `oci-catalog.json`. One OCI artifact contains one complete plugin. |
| R4 | Publish directly from the complete plugin root with ORAS and `.`. ORAS creates the gzip directory layer (`application/vnd.oci.image.layer.v1.tar+gzip`) and extracts it on pull. Use artifact type `application/vnd.dmartino.claude.plugin.v1` and manifest title/version annotations matching `.claude-plugin/plugin.json`. No separate archive or packager is required. |
| R5 | Use ORAS through a small deterministic helper for metadata lookup and retrieval. Reuse supported existing local credentials without printing or copying them into project state. Display plugin identity, version, registry, resolved digest, and installed state. |
| R6 | Adding an OCI marketplace shall, after manager confirmation and Claude permission approval, pull its plugins by the inspected digests, extract and validate them, generate a regular Claude-compatible local marketplace, and register it through supported Claude commands. Keep the published OCI sources intact; only the generated marketplace uses local plugin paths. Respect the active Claude config directory and retain the generated files across restarts. |
| R7 | Session startup, periodic polling, and manual refresh shall check OCI manifest metadata for changed tag digests without downloading plugin layers. Listing shall use local content without contacting the registry. Periodic checks respect the session dismissal behavior in R14. |
| R8 | Apply only approved plugin updates. Pull and validate replacements before changing the generated marketplace or installation. An unsuccessful update shall leave the previous working plugin and recorded digest usable. Restarting Claude to activate changes is acceptable. |
| R9 | Provide one marketplace-manager plugin, the existing mod UI and SessionStart hook, and a small deterministic helper. Use Claude's session timer for polling; stop it when the session ends. Do not add a daemon or external polling service. |
| R10 | `/marketplace-manager` shall support list, add by Git URL, install by `<plugin-name>@<marketplace-name>`, installed-state display, and update review/application. The generated OCI marketplace and its plugins shall also be visible and installable through native `/plugin`. |
| R11 | Standard-only marketplaces shall continue to use Claude's native registration and installation behavior and contribute no OCI operations. Preserve standard plugin entries when materializing a mixed marketplace. |
| R12 | Claude's registered marketplaces remain authoritative for the visible marketplace list. For a generated marketplace, retain a small local mapping to its original Git URL and OCI sources/digests so updates still work. Preserve the published marketplace name and plugin identities; do not show duplicate original/generated marketplace rows. Recognize plugins installed through `/plugin`. |
| R13 | Show a non-blocking update notice and a simple review allowing selection of plugins to update. Ask for confirmation and use Claude's standard permission flow before downloading replacements. |
| R14 | Dismissing an update notice suppresses it for the current session. A new session or manual refresh can show it again while the update remains available. |
| R15 | All developer operations shall work with installed tools and the installed manager, without a POC checkout or repository scripts. Provide short publishing instructions and copyable v1/v2 example plugins. |
| R16 | Configure `marketplace-manager.poll_interval_minutes` through Claude's plugin `/config` panel. Default to five minutes; offer one minute for demos. Apply a changed interval when the next session starts. |

## POC acceptance

Use the supplied demo registry repository, Git URLs, and local credentials. The project supplies copyable plugin examples and creates its own demo tag; never invent registry coordinates or commit secrets.

1. Record macOS, Claude Code, ORAS, and Git versions. Copy the example plugin and publish v1 with ORAS to the configured Quay repository.
2. Publish or use the GitHub marketplace on the `oci-demo-marketplace` branch of the same repository as the bootstrap. Its Git URL is `https://github.com/dmartinol/claude-oci-marketplace-poc.git#oci-demo-marketplace`, and its OCI reference is in `source`.
3. In a fresh Claude profile, install the manager by URL without cloning this repository.
4. Add the GitHub marketplace through the manager and approve extraction. Verify the generated marketplace passes Claude validation and appears in both `/plugin` and `/marketplace-manager`.
5. Install v1 through `/plugin`, restart, and invoke the example skill. Verify the manager recognizes its installed state. Also exercise manager installation using the same native path.
6. Select the one-minute interval for the demo, publish v2 to the same tag while Claude remains open, observe the notice during that session, approve the update, restart, and verify v2 behavior and the new digest.
7. Confirm a standard-only marketplace still works. Exercise one failed update and confirm v1 remains usable. Cover other failure branches with focused helper tests as needed.

Record commands, relevant output, digests, and blockers in the existing reports. This is a POC rehearsal, not a production certification exercise.

## Feasibility first

Finish the small feasibility spike before full implementation: publish and pull a complete directory from the configured registry with ORAS; generate and register a native-compatible local marketplace; install its plugin with Claude; and demonstrate persistence, an update, and restart behavior. Reuse existing evidence for unchanged UI and permission APIs rather than repeating it unnecessarily.

Record the actual commands and blockers in [feasibility-report.md](feasibility-report.md). Stop after the spike, report the result, and wait for explicit implementation approval as required by [AGENTS.md](../AGENTS.md). Earlier packaging approval does not prove this revised marketplace flow works.

## Keep it small

Use deterministic code for Git retrieval, ORAS, filesystem operations, validation, and native Claude commands. Do not edit undocumented Claude cache/settings formats. Keep the manager's own generated marketplace and provenance state small. Do not add a second marketplace service, custom archive tooling, migration framework, elaborate transaction system, or hot reload.

Out of scope: native OCI support in Claude, standalone skill artifacts, command-source adapters, signing, advisory processing, consumption tracking, polling while Claude is closed, persistent background services, and additional platforms. Git marketplace edits after initial registration need not trigger automatic synchronization for this demo; same-tag OCI plugin updates are the update scenario.

## References

- [Claude marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- [ORAS installation](https://oras.land/docs/installation/)
- [ORAS push](https://oras.land/docs/commands/oras_push/)
- [ORAS manifest fetch](https://oras.land/docs/commands/oras_manifest_fetch/)
- [ORAS pull](https://oras.land/docs/commands/oras_pull/)
