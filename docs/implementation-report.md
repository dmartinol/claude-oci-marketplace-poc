# MVP Implementation Report

This report records evidence for P1–P5 tasks in [plan.md](plan.md). The P0 feasibility findings remain in [feasibility-report.md](feasibility-report.md). Full implementation was approved at G1 on 2026-10-14.

## T101 — Validated plugin scaffold

**Result:** Pass

The maintained marketplace now includes the root `oci-catalog.json`, the manager mod, a shared deterministic OCI/catalog helper, an install helper, and a `SessionStart` hook that requests Claude's standard `reloadSkills` behavior.

Commands and observed results:

```text
$ claude plugin validate --strict .
✔ Validation passed

$ claude plugin validate --strict ./plugins/oci-marketplace
✔ Validation passed

$ claude plugin marketplace update claude-oci-marketplace
✔ Successfully updated marketplace: claude-oci-marketplace

$ claude plugin update oci-marketplace@claude-oci-marketplace
✔ Plugin "oci-marketplace" updated from 0.1.1 to 0.2.0 for scope user. Restart to apply changes.

$ claude -p '/oci-marketplace' --max-budget-usd 0.05
oci-marketplace: OCI Marketplace manager
Commands:
  /oci-marketplace browse
  /oci-marketplace add <git-url>
  /oci-marketplace install <skill@marketplace>
  /oci-marketplace updates
  /oci-marketplace installed
```

The packaged startup hook returned `{"hookSpecificOutput":{"hookEventName":"SessionStart","reloadSkills":true}}`. The manager is installed from the registered Git marketplace and its namespaced command is available in a fresh stock Claude session.

## T102 — Structural validation

**Result:** Pass

The plugin tests validate required catalog fields, tagged OCI references, duplicate rejection, same-name skills in separate marketplaces, standard-only marketplace exclusion, metadata parsing, and shell-argument quoting. The installation helper also has a disposable shell fixture that injects fetch, digest mismatch, invalid artifact, and activation failures.

```text
$ claude plugin test ./plugins/oci-marketplace
9 pass
0 fail

$ sh plugins/oci-marketplace/tests/install-script.test.sh
PASS: install activates a valid artifact; fetch, digest, validation, and activation failures preserve the prior installation.
```

Strict marketplace and plugin validation passed without registry credentials. Claude reported a non-gating README advice to add the one-line marketplace install command; T502 will replace the pending README sections with verified setup guidance.

## T201 — Marketplace discovery and catalog loading

**Result:** Pass

The manager reads `claude plugin marketplace list --json`, uses each registration's `installLocation`, ignores registrations without `oci-catalog.json`, validates present catalogs, and keys entries as `<skill-name>@<marketplace-name>`. Unit fixtures load two catalogs with the same skill name and exclude a standard-only registration.

The hosted manager's real `/oci-marketplace browse` command resolved the sample from Claude's marketplace cache:

```text
OCI skills from registered marketplaces:
- claude-oci-demo@claude-oci-marketplace: Demonstrates OCI skill distribution and reload behavior | v0.1.1 | quay.io | sha256:3e842b281cf1d3bf0e8492ca6bcbd7e13b3cfb9c72e9383c1906d58b2d1802a3 | not installed

No skill selected.
```

The command ran headlessly, so the native selection dialog had no person to answer; the command returned the listing and no install was attempted. Catalog resolution used `skillctl inspect` only and did not pull artifact layers. Native ask/confirmation and tool-permission behavior was already demonstrated in T003 and is covered by the manager's mod tests.

## T202 — Installed-skill state

**Result:** Pass

Installed state is keyed by `<skill-name>@<marketplace-name>` in Claude's plugin store. Before displaying or using stored entries, the manager validates identity, repository/registry consistency, version, digest, and the deterministic install-directory name. It copies only supported fields into the in-memory result, so unrelated data such as a token is not retained or displayed. The record is written only after the permission-checked installer call returns successfully.

The interaction fixture installs a sample entry through the command flow, checks the complete persisted record, then reads it through a later `installed` command and confirms that version, registry, and digest are displayed. Separate cancel and permission/tool-error paths confirm that the existing record receives no writes.

```text
$ claude plugin test ./plugins/oci-marketplace
12 pass
0 fail
```

The test uses a mock successful installer call; actual artifact retrieval and atomic replacement are covered by T005 feasibility evidence and remain acceptance checks for T203/T204 respectively.

## T203 — Deterministic `skillctl` operations

**Result:** Pass

All `$.process.run` calls use argument arrays through the shared `runProcess` helper. Marketplace listing has the default 30-second bound; `skillctl inspect` has a 60-second bound. Nonzero exits surface stderr/stdout, malformed inspect output is rejected unless it includes a version and sha256 digest, and process timeouts propagate to the command's error result. Browse fixtures assert that the only `skillctl` operation is `inspect`; no pull is performed during metadata checks.

The existing T005 evidence verifies the production `skillctl 0.4.0` contract: metadata inspection resolves the sample digest without pulling layers; authenticated `skillctl pull` retrieves and unpacks the same supplied Quay artifact using the local credential stores. The manager delegates to that command and never reads, prints, or persists credentials. The T202 interaction fixture verifies native confirmation precedes the permission-checked installer call.

```text
$ claude plugin test ./plugins/oci-marketplace
14 pass
0 fail

$ claude plugin validate --strict .
Validation passed (with non-gating README setup advice; see T502)

$ claude plugin validate --strict ./plugins/oci-marketplace
Validation passed
```

These tests exercise process errors and timeout propagation with disposable mocks; an actual install through Claude's permission UI and the staged replacement are validated in T204/T303.

## T204 — Staged installation and replacement

**Result:** Pass

The deterministic installer pulls into a unique staging directory under the Claude skills root, checks that the pull digest matches the inspected digest, requires regular `SKILL.md` and `skill.yaml` files, and verifies the declared skill name before activation. It moves an existing target to a same-filesystem backup, activates the staged directory, removes the backup only after success, and restores the backup on activation failure. The target directory is marketplace-qualified. The manager writes installed state only after its permission-checked helper call succeeds, as verified by T202's success and failure interaction fixtures.

The disposable fixture exercised both a first install and v1-to-v2 replacement, then injected fetch, digest mismatch, missing SkillCard, wrong skill name, and activation failures while asserting the prior v1 files remained in place:

```text
$ sh plugins/oci-marketplace/tests/install-script.test.sh
PASS: install and replacement activate validated artifacts; fetch, digest, validation, and activation failures preserve the prior installation.

$ claude plugin test ./plugins/oci-marketplace
14 pass
0 fail
```

Failure injection uses a local `skillctl` stub and does not require registry access. T005 separately verified authenticated retrieval from the supplied Quay repository. End-to-end install through Claude and invocation of the sample remain T303 acceptance checks.

## T301 — Marketplace source registration

**Result:** Pass

`add <source>` passes the supplied source as a safely quoted argument to `claude plugin marketplace add --scope user`, then refreshes discovery through Claude's `marketplace list --json` output. The manager leaves source-format handling to Claude's command; the installed CLI help confirms it accepts URLs, paths, and GitHub repositories. A successful standard-only fixture reports that normal `/plugin` behavior is unchanged, while an OCI-enabled fixture appears in the refreshed catalog count. A Claude command error is returned clearly without attempting discovery refresh. The deterministic add runs through Claude's permission-checked Bash tool call.

```text
$ claude plugin marketplace add --help
Add a marketplace from a URL, path, or GitHub repo

$ claude plugin test ./plugins/oci-marketplace
16 pass
0 fail

$ claude plugin validate --strict ./plugins/oci-marketplace
Validation passed
```

The interaction test mocks Claude's command result and marketplace list to avoid changing live user registrations. T004 independently recorded a real user-scope registration and removal of a standard-only marketplace; T003 verified the permission-checked mod tool flow.

## T302 — Marketplace browser

**Result:** Pass

Browse loads and inspects entries from all registered OCI catalogs, then presents marketplace-qualified identities in Claude's native mod selection UI. The listing includes description, available version, source registry, resolved digest, and installed version/digest when present. Selecting an entry proceeds to the native install/update confirmation; cancelling there returns without calling the installer. Completing the browser with `Done` also returns inside Claude without pulling artifact layers.

The real manager's headless browse resolved `claude-oci-demo@claude-oci-marketplace`, version `0.1.1`, registry `quay.io`, and its sha256 digest without pulling layers (see T201 output above). In the interactive Claude session, the native chooser displayed that qualified identity and proceeded to the native install confirmation. A two-catalog fixture covers same-name identities and installed-state display; interaction fixtures cover selection/cancel, finishing browse, and zero pre-approval pulls.

```text
$ claude plugin test ./plugins/oci-marketplace
17 pass
0 fail
```

The real interactive browse reached its install confirmation but did not complete installation; T303 owns the end-to-end install and invocation check.

## T303 — Install and reload flow

**Result:** Pass

The live Claude Code 2.1.299 session browsed the registered catalog, selected `claude-oci-demo@claude-oci-marketplace`, confirmed v0.1.1 from `quay.io`, and then approved Claude's standard Bash permission prompt. That prompt displayed the deterministic installer and its repository, expected digest, staging path, marketplace-qualified target path, and rollback path. The installer retrieved and activated the artifact.

`/oci-marketplace installed` then reported:

```text
claude-oci-demo@claude-oci-marketplace: v0.1.1 | quay.io | sha256:3e842b281cf1d3bf0e8492ca6bcbd7e13b3cfb9c72e9383c1906d58b2d1802a3
```

The installed directory contained both `SKILL.md` and `skill.yaml`, with the expected skill name and instructions. `/reload-skills` completed; Claude reported 65 skills available and no count change. The next `/claude-oci-demo@claude-oci-marketplace` invocation returned the artifact's exact response, `T005 sample skill ready.` The successful browse response now refreshes its installed-status line after installation instead of showing the pre-install snapshot.

Before this live check, the earlier direct T005 copy at `~/.claude/skills/claude-oci-demo` was moved intact to `/tmp/claude-t303-legacy-skill` to avoid a duplicate skill name. The manager-installed skill remains active at `~/.claude/skills/claude-oci-demo@claude-oci-marketplace`.

Cancellation and denied-permission fixtures verify that only metadata inspection occurs before approval, the installer is not called after cancellation, and neither path changes installed state. Current automated results:

```text
$ claude plugin test ./plugins/oci-marketplace
18 pass
0 fail

$ sh plugins/oci-marketplace/tests/install-script.test.sh
PASS: install and replacement activate validated artifacts; fetch, digest, validation, and activation failures preserve the prior installation.
```

## T401 — Update detection

**Result:** Pass

The v0.2.0 sample source is in `examples/claude-oci-demo/v2`; it returns a visibly different response from v0.1.1. `skillctl build`, `skillctl push`, and remote `skillctl inspect` succeeded for the existing supplied repository with tag `0.2.0-draft`. The remote resolved digest is `sha256:df8e88e3f80f14d821150ce419298bb849d4b9aabddab83b954462e08dfd2e9a`, and the root OCI catalog now points to that tag. No new registry host or namespace was introduced.

The first push attempt used the remote reference before tagging the local build, and failed with `Resolve ... not found` before registry access. `skillctl tag dmartino/claude-oci-demo:0.2.0-draft quay.io/dmartino/claude-oci-demo:0.2.0-draft` added the correct local remote reference; the subsequent push succeeded.

The implementation now compares resolved digests for installed marketplace-qualified entries, reports unchanged skills without an alert, isolates same-name entries by marketplace, and surfaces per-skill inspection failures without hiding valid updates. Disposable tests cover those manual-check paths:

```text
$ claude plugin test ./plugins/oci-marketplace
20 pass
0 fail

$ skillctl validate examples/claude-oci-demo/v1
✓ examples/claude-oci-demo/v1/skill.yaml is valid

$ skillctl validate examples/claude-oci-demo/v2
✓ examples/claude-oci-demo/v2/skill.yaml is valid
```

After pushing the catalog and plugin version update, Claude refreshed the registered source and updated `oci-marketplace` from 0.2.0 to 0.3.0. A fresh Claude Code 2.1.299 session displayed the non-blocking `1 OCI skill update available` toast. The manual `/oci-marketplace updates` review then showed a native selection summary for `claude-oci-demo@claude-oci-marketplace`, v0.1.1 → v0.2.0. It was cancelled with Escape before the confirmation or retrieval step; the installed v1 remained active. Both live checks ran through `skillctl inspect` only.

```text
$ claude plugin marketplace update claude-oci-marketplace
✔ Successfully updated marketplace: claude-oci-marketplace

$ claude plugin update oci-marketplace@claude-oci-marketplace
✔ Plugin "oci-marketplace" updated from 0.2.0 to 0.3.0 for scope user. Restart to apply changes.

$ claude plugin test ./plugins/oci-marketplace
20 pass
0 fail
```

This records the digest-only startup and manual detection paths. Per-skill subset selection, session dismissal, and applying v2 remain T402/T403.

## T402 — Update indication and selection

**Result:** Pass

The live fresh-session check in T401 produced one non-blocking toast, and the manual review displayed one consolidated native update summary. A two-marketplace interaction fixture then produced one toast followed by one multi-select summary for two different installed skills. Selecting only `Update 1` changed the confirmation to “Apply 1 selected OCI skill update”; choosing `Not now` dismissed the alert for that session without calling the installer, pulling artifacts, or changing installed state. The dismissal fixture suppresses repeat review in the same session and offers the same update again under a new session ID.

```text
$ claude plugin test ./plugins/oci-marketplace
21 pass
0 fail
```

Multi-skill selection and next-session return use deterministic interaction fixtures. The live Claude UI showed the native summary with the published v0.1.1 → v0.2.0 update; no update was applied during T402.

## T403 — Selected update application

**Result:** Pass

The live Claude Code 2.1.299 session showed the native update selection summary. I selected the sole available update, `claude-oci-demo@claude-oci-marketplace` (v0.1.1 → v0.2.0), then confirmed applying one selected update. Claude's standard Bash permission prompt followed the native confirmation and showed the selected repository, expected digest, qualified install directory, and rollback path. After approval, the manager reported successful activation of v0.2.0 with digest `sha256:df8e88e3f80f14d821150ce419298bb849d4b9aabddab83b954462e08dfd2e9a`.

`/oci-marketplace installed` then reported the persisted v0.2.0 version, `quay.io` registry, and matching digest. The installed `SKILL.md` contains the v2 response. `/reload-skills` completed and Claude's next `/claude-oci-demo@claude-oci-marketplace` invocation returned exactly `T005 sample skill updated to v0.2.0.`

The two-marketplace interaction fixture selected only Update 1 and asserted that only its repository reached the installer; the other marketplace's v1 record remained byte-for-byte equivalent. A separate failed-update interaction fixture asserted that an activation error leaves the v1 installed-state record unchanged. The deterministic install fixture also injected retrieval, digest mismatch, invalid/missing metadata, wrong-name, and activation failures and verified that v1 files remain usable.

```text
$ claude plugin test ./plugins/oci-marketplace
23 pass
0 fail

$ sh plugins/oci-marketplace/tests/install-script.test.sh
PASS: install and replacement activate validated artifacts; fetch, digest, validation, and activation failures preserve the prior installation.

$ claude plugin validate --strict .
Validation passed

$ claude plugin validate --strict ./plugins/oci-marketplace
Validation passed

$ skillctl validate examples/claude-oci-demo/v2
✓ examples/claude-oci-demo/v2/skill.yaml is valid
```

The live flow used the already supplied Quay repository and a native Claude permission prompt. No credentials or machine-local configuration were staged.

## T501 — End-to-end demo rehearsal

**Result:** In progress — the second unique skill is published and both catalogs are live in an isolated Claude config; the first install uncovered a real unpack-path mismatch, now fixed and covered by tests. The two-update interaction is pending rerun with the updated plugin.

The clean-config setup used Claude Code 2.1.299 and `skillctl` 0.4.0. I created an isolated `CLAUDE_CONFIG_DIR`, added the supplied Git marketplace URL, installed `oci-marketplace@claude-oci-marketplace` at user scope, and confirmed the plugin was enabled at v0.3.0. The isolated config was removed after the check. The first clone attempt was blocked by the restricted network; the same supplied URL succeeded when retried with network access.

```text
$ skillctl --version
skillctl version 0.4.0

$ CLAUDE_CONFIG_DIR=/tmp/claude-p5-clean-20261014 claude plugin marketplace add --scope user --json git@github.com:dmartinol/claude-oci-marketplace-poc.git
{"command":"marketplace-add","outcome":"ok","marketplace":"claude-oci-marketplace", ... }

$ CLAUDE_CONFIG_DIR=/tmp/claude-p5-clean-20261014 claude plugin install oci-marketplace@claude-oci-marketplace --scope user
✔ Successfully installed plugin: oci-marketplace@claude-oci-marketplace (scope: user)
```

Strict repository and plugin validation passed. A strict-valid disposable standard-only marketplace was added to the live Claude user registration; the manager's browse output continued to list only `claude-oci-demo@claude-oci-marketplace`. The temporary marketplace registration and its fixture directory were removed afterward. T201/T402 fixtures already prove same-name entries retain marketplace-qualified identities, standard-only exclusion, and multi-update subset/dismissal behavior. T303 and T401–T403 record the live v1 install, v2 detection, selected update, permission, reload, and invocation.

The user approved publishing a second skill under the existing supplied Quay repository. Added `examples/claude-oci-guide/v1` and `v2` with distinct `claude-oci-guide` identity and visibly different responses. The tags below use the existing `quay.io/dmartino/claude-oci-demo` repository; no repository or namespace was invented:

```text
$ skillctl validate examples/claude-oci-guide/v1
✓ examples/claude-oci-guide/v1/skill.yaml is valid

$ skillctl validate examples/claude-oci-guide/v2
✓ examples/claude-oci-guide/v2/skill.yaml is valid

$ skillctl inspect quay.io/dmartino/claude-oci-demo:claude-oci-guide-0.1.0-draft
Version:      0.1.0
Digest:       sha256:53def93598a4af5848dbe4169dcf4aa67269fcc166e43030336e01ea87a5b3a5

$ skillctl inspect quay.io/dmartino/claude-oci-demo:claude-oci-guide-0.2.0-draft
Version:      0.2.0
Digest:       sha256:eed775096b6b1d87e7cde5ad255803f7952c8b83635e412f07cd15a2c96c19a1
```

The first build attempt passed `--tag` a `name:version` value instead of the version tag alone, and the resulting local references could not be tagged or pushed (`resolving ...: not found`). No remote tags were changed by those failed commands. Rebuilding with the version from `skill.yaml` as the tag produced valid local refs; both unique tags then pushed successfully and remote `skillctl inspect` resolved the digests above.

Added a second Claude marketplace fixture at `examples/claude-oci-guide-marketplace`. Strict validation reports the expected warning `Marketplace has no plugins defined`; normal validation and live user-scope registration succeed. In an isolated `CLAUDE_CONFIG_DIR`, the manager plugin was enabled at v0.3.0, both the supplied Git marketplace and the guide fixture were registered, and a real manager browse showed two distinct entries:

```text
claude-oci-guide@claude-oci-guide-marketplace: v0.1.0 | quay.io | sha256:53def93598a4af5848dbe4169dcf4aa67269fcc166e43030336e01ea87a5b3a5 | not installed
claude-oci-demo@claude-oci-marketplace: v0.1.1 | quay.io | sha256:3e842b281cf1d3bf0e8492ca6bcbd7e13b3cfb9c72e9383c1906d58b2d1802a3 | not installed
```

The native install confirmation appeared for the guide artifact. After confirmation, `skillctl pull` unpacked files under the OCI repository basename `claude-oci-demo`, while the installer had assumed the unpack directory was the skill name `claude-oci-guide`; activation correctly failed before replacing any existing skill. A first sandboxed attempt also confirmed the helper writes to Claude's normal `$HOME/.claude/skills` regardless of `CLAUDE_CONFIG_DIR`; the rehearsal was rerun with the required filesystem access. The installer now derives the unpack directory from the tagged repository path, validates the skill files and expected frontmatter name there, then moves it to the deterministic marketplace-qualified target. Direct installation of the published v1 artifact into a disposable `/tmp` target succeeded with the expected digest. The installer regression suite, all 23 plugin tests, and strict plugin validation pass after the fix.

This live install fixed the original T501 artifact-availability gap but did not yet complete the two-skill update acceptance: the corrected plugin still needs to be loaded into the rehearsal config, both v1 skills installed, both catalogs advanced to v2, and the selected updates invoked after `/reload-skills`. The first marketplace refresh fetched the new Git commit, but `claude plugin update` reported the installed v0.3.0 was already latest because the hook code changed without a plugin version change. Bumped the plugin to v0.3.1 so Claude can apply the fix; the catalog refresh and plugin update will be repeated after publishing that bump. No credentials or machine-local files were staged.

## T502 — README guidance

**Result:** Backlog — the README now documents the second skill artifact and marketplace fixture, but its clean two-update reproduction steps remain pending T501.

The README now documents the tested Claude Code and `skillctl` versions, strict validation, Git marketplace registration, manager installation, all five manager commands, standard-only behavior, the supplied v2 catalog reference, the confirmation and Bash permission sequence, and `/reload-skills` with new-session fallback. Clean-config marketplace registration and manager installation succeeded in T501. A fresh user has not yet reproduced the complete multi-update acceptance flow, so T502 is not marked Done.

## T503 — Final validation and verdict

**Result:** Backlog — final validation and security review must be rerun after T501/T502 because the installer and demo artifacts changed.

Final checks on this checkout:

```text
$ claude plugin test ./plugins/oci-marketplace
23 pass
0 fail

$ sh plugins/oci-marketplace/tests/install-script.test.sh
PASS: install and replacement activate validated artifacts; fetch, digest, validation, and activation failures preserve the prior installation.

$ claude plugin validate --strict .
Validation passed

$ claude plugin validate --strict ./plugins/oci-marketplace
Validation passed

$ skillctl validate examples/claude-oci-demo/v1
✓ examples/claude-oci-demo/v1/skill.yaml is valid

$ skillctl validate examples/claude-oci-demo/v2
✓ examples/claude-oci-demo/v2/skill.yaml is valid

$ git diff --check
PASS
```

A local-link scan passed across the six Markdown documentation files. A tracked-file scan found no credential-like tokens, private keys, auth files, environment files, or Claude local settings. `git ls-files .serena` returned no paths; `.serena/` remains untracked and was excluded from staging. Only the intended README and documentation files were staged for this audit commit.

**Verdict:** Go for the demonstrated single-skill OCI install-and-update MVP: the manager browses metadata, waits for native confirmation and Claude permission before retrieval, installs v1, detects and applies v2, and reloads/invokes the replacement. The full P5 acceptance run is not complete: a second unique OCI skill artifact is needed for a live two-catalog/multiple-update rehearsal and a clean-user replay of that scenario. Multi-marketplace identity and multi-update selection remain covered by deterministic tests. No additional registry coordinates were invented or published.

## Current implementation status

- P1 (T101–T102) is complete.
- P2 (T201–T204) is complete.
- P3 (T301–T303) is complete.
- P4 (T401–T403) and the final validation/security audit (T503) are complete. T501 and T502 remain in progress pending a second unique OCI skill for the live two-catalog update rehearsal and clean-user replay.

No credentials, authentication files, or `.serena/` contents were staged.
