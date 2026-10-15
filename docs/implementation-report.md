# MVP Implementation Report

> Scope notice: The current POC generates and registers a native-compatible local marketplace from GitHub OCI `source` entries, visible in both `/plugin` and `/marketplace-manager`, without a user checkout. Earlier checks below prove only the behaviors actually exercised; they do not establish this revised end-to-end flow. See [requirements](requirements.md), [D22](decisions.md#current-direction--d22-native-compatible-marketplace-poc), and the [current plan](plan.md).

The P1–P5 sections preserve evidence for the prior catalog-based implementation. The current raw-source revision is recorded in P6 and tracked in [plan.md](plan.md). P0 feasibility findings remain in [feasibility-report.md](feasibility-report.md). The prior flow was approved at G1 on 2026-10-14; revised source parsing was authorized at G2 on 2026-10-15.

## Scope revision — general marketplace management

On 2026-10-14, the user clarified that this product is a general marketplace manager, with OCI skill handling as an optional extension. Before T304, the `/oci-marketplace` implementation listed OCI skills but hid standard-only marketplace rows. Requirements R2, R10–R12, decisions D1, D2, D6, D11, and D14, and plan task T304 tracked the generic `/marketplace-manager` entry point and complete marketplace listing. T304 is implemented and live-validated. The earlier T503 audit covered only the OCI-focused scope and is superseded by the final T503 audit below.

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

**Result:** Blocked — the current environment can exercise the supported manager and marketplace workflows, but Quay rejects the supplied artifact requests with HTTP 401 and Claude model invocation reports that the profile is not logged in. The installed-v2 record/digest recheck and guide v2 invocation are not claimed complete.

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

The v0.3.1 install then succeeded for both v1 artifacts through the native confirmation and standard Bash permission prompt, and `/oci-marketplace installed` showed both marketplace-qualified records with the expected digests. This exposed a second clean-config issue: the helper wrote into the machine's default `~/.claude/skills`, while the `CLAUDE_CONFIG_DIR` session only discovered skills in its configured `skills/` directory. Qualified and unqualified invocation failed before reload; copying both files into the temporary config's `skills/` directory and running `/reload-skills` reported 15 skills (2 added), after which `/claude-oci-guide@claude-oci-guide-marketplace` returned exactly `T501 guide skill ready.`

The checkpoint also records that an in-sandbox `skillctl pull` from the supplied Quay repository failed at DNS resolution. Retrying the same live installation with network-enabled permissions succeeded. This was an execution-environment DNS restriction; the supplied repository and artifact reference were unchanged. The earlier Git clone network retry is a separate event.

The manager now chooses `<CLAUDE_CONFIG_DIR>/skills` when that environment variable is set and defaults to `~/.claude/skills` otherwise. The plugin is v0.3.2 so Claude loads this change. Unit tests assert the configured install path; all 23 plugin tests, strict plugin validation, and install failure-injection checks passed in the original demo environment. The supplied continuation checkpoint reports that v0.3.2 was loaded, both v1 skills were installed and updated through the manager, and both catalogs advanced to v2. The remaining checks are to re-read both installed records and invoke guide v2 after `/reload-skills`; those observations are unavailable in this checkout.

The user-provided continuation checkpoint reports that plugin v0.3.2 was loaded in the isolated profile, both marketplace-qualified skills were updated to v2, demo v2 returned `T005 sample skill updated to v0.2.0.`, and guide v1 had been invoked. It supplies the demo digest `sha256:df8e88e3f80f14d821150ce419298bb849d4b9aabddab83b954462e08dfd2e9a` and guide digest `sha256:eed775096b6b1d87e7cde5ad255803f7952c8b83635e412f07cd15a2c96c19a1`. The guide v2 response is expected to be `T501 guide skill updated to v0.2.0.` These are checkpoint claims; the installed records and guide v2 response could not be re-observed here.

Prior container resume checks (historical; superseded by the current recheck below):

```text
$ git rev-parse HEAD
e743ab92a70daaf1b12134d8b3dd4a3777e7cd45

$ git status --short --branch
## main...origin/main

$ claude --version
2.1.156 (Claude Code)

$ skillctl --version
bash: line 1: skillctl: command not found

$ ls -ld /tmp/claude-p5-final-20261014 /tmp/claude-p5-final-guide-marketplace-20261014
No such file or directory

$ claude plugin test ./plugins/oci-marketplace
error: unknown command 'test' (this Claude Code version suggests 'list')
```

The requested `/Users/...` checkout is not mounted in this environment; the available checkout is the same repository at the supplied `e743ab9` checkpoint. The global `/sandbox/.claude/skills` directory was inspected and is empty, so there were no rehearsal artifacts here to clean up. Neither `.serena/` nor `openshell/` exists in this checkout, and neither path is tracked. Prior live outputs and the supplied checkpoint are recorded above; rechecking installed records/digests, guide v2 invocation, and the live multi-update interaction requires the original rehearsal environment and supported tools. No artifact was republished.

### Current-environment recheck — 2026-10-14

This recheck ran on the updated `origin/main` checkout. It used Claude Code 2.1.299, `skillctl` 0.4.0, and disposable `CLAUDE_CONFIG_DIR` directories; the default profile was left unchanged. Its current registration output is empty:

```text
$ claude --version
2.1.299 (Claude Code)

$ skillctl --version
skillctl version 0.4.0

$ claude plugin marketplace list --json
[]
```

The supplied origin was added through `/marketplace-manager add https://github.com/dmartinol/claude-oci-marketplace-poc.git`. Claude cloned and validated it, the manager refreshed the complete list, and the native plugin manager installed `marketplace-manager@claude-oci-marketplace` version 0.4.0 at user scope. A fresh session without `--plugin-dir` then executed `/marketplace-manager list`. In a separate clean profile, a valid standard-only fixture and the supplied Git marketplace both appeared in the complete list with the expected classifications; `/marketplace-manager browse` showed only the OCI entry. A second clean profile added both OCI marketplaces; the list showed `claude-oci-demo@claude-oci-marketplace` and `claude-oci-guide@claude-oci-guide-marketplace` as separate catalog entries. Browse attempted metadata-only inspection and showed both identities without retrieving layers. These live manager checks succeeded; the OCI metadata checks failed on registry authentication as recorded below.

All four local demo skill fixtures validate with the installed `skillctl`:

```text
$ skillctl validate examples/claude-oci-demo/v1
✓ skill.yaml is valid
$ skillctl validate examples/claude-oci-demo/v2
✓ skill.yaml is valid
$ skillctl validate examples/claude-oci-guide/v1
✓ skill.yaml is valid
$ skillctl validate examples/claude-oci-guide/v2
✓ skill.yaml is valid
```

Metadata checks used only the supplied references from the catalogs and README:

```text
quay.io/dmartino/claude-oci-demo:0.1.1-draft                  → HTTP 401 Unauthorized
quay.io/dmartino/claude-oci-demo:0.2.0-draft                  → HTTP 401 Unauthorized
quay.io/dmartino/claude-oci-demo:claude-oci-guide-0.1.0-draft  → HTTP 401 Unauthorized
quay.io/dmartino/claude-oci-demo:claude-oci-guide-0.2.0-draft  → HTTP 401 Unauthorized
```

The first guide-v2 request briefly returned `invalid OCI Image Index: EOF`; an immediate retry returned the same 401 response as the other three tags. A `skillctl pull` of the supplied demo-v1 reference to a temporary path also failed with `401 Unauthorized`. No artifact layers were downloaded and no registry content was published or modified. The failure means the previously recorded checkpoint digests cannot be independently verified in this environment; installed-v2 records cannot be created for this recheck.

`claude -p /reload-skills` succeeded in a clean profile. Invoking the locally copied guide-v2 fixture immediately afterward failed with `Not logged in · Please run /login`, so the expected model response could not be observed. No login flow was attempted and no credentials were requested or exposed. The local fixture copy was temporary and removed automatically after the check.

The remaining blocker is external state: the supplied Quay artifacts are not readable with the credential stores available to this process, and the Claude print session has no model login. T501 therefore remains blocked on the v2 installed-record/digest checks and guide-v2 invocation. The standard-only classification, both-OCI-catalog listing, remote Git marketplace install, and supported CLI/tool versions were rechecked successfully.

## T502 — README guidance

**Result:** Blocked — the generic guide and all locally runnable steps passed a clean-profile replay. The supplied Quay registry returns HTTP 401, Claude is not logged in, and the available host is Linux rather than the macOS demo environment, so artifact installation, update approval, and invocation could not be replayed.

The guide now documents `/marketplace-manager list`, `add <source>`, OCI browse/install/update commands, and the boundary between the general marketplace list and OCI-only skill operations. It states that standard-only marketplaces remain visible in the manager and their standard plugins remain usable through native `/plugin`. The clean rehearsal adds the manager from the supplied HTTPS Git URL, creates two unique local OCI catalogs, registers those catalogs with the manager, and performs the documented v1-to-v2 tag switch. It uses only the supplied Quay repository and tags.

I replayed the README setup and snippets in a fresh `CLAUDE_CONFIG_DIR` and temporary catalog directory. Strict repository and plugin validation passed. The supplied Git marketplace cloned and installed `marketplace-manager@claude-oci-marketplace` version 0.4.0 at user scope. Both README-created local catalogs passed `claude plugin validate` with the expected no-plugins warning, and `/marketplace-manager add` and `list` showed both OCI-enabled entries. Executing the second README snippet changed both references to the documented v2 tags; both catalog manifests validated again. The manager's live `browse` attempted metadata-only checks and returned 401 for the supplied demo and guide tags. `/marketplace-manager updates` reported no installed skills in the clean profile. This confirms setup, manager registration/listing, and catalog-editing steps while leaving registry-dependent steps incomplete.

The first replay attempt inherited a pre-existing `REHEARSAL_DIR` from the environment rather than the temporary path intended for that test. It wrote the README's v1 fixture contents into that pre-existing directory; the following validation failed because it checked the separate temporary directory. After noticing, I stopped using the pre-existing directory and reran the guide with an explicitly isolated temporary `REHEARSAL_DIR`. At the user's direction, I restored the two external rehearsal catalogs' `skills[0].repository` references to the documented demo-v2 and guide-v2 tags, then reread both JSON files and verified the values. The machine-local location is omitted, and no external file was staged or committed.

The remaining guide acceptance item is a clean-user reproduction of registry-backed v1 install, v2 update/selection, reload, and invocation. T501 records the 401 responses and the missing Claude login. The guide is not marked complete while those steps remain blocked.

## Prior T503 — Final validation and verdict (superseded)

**Result:** Done — the final audit and verdict are recorded. T501 and T502 remain blocked on live checks that require the unavailable isolated macOS rehearsal environment.

The final implementation code did not change after the v0.3.2 validation recorded under T501. That supported Claude Code 2.1.299 run reported 23 plugin tests passing and the install failure-injection suite passing. The README and audit changes since then are documentation only. I reran the validators and installer failure checks in this container:

```text
$ claude --version
2.1.156 (Claude Code)

$ claude plugin validate --strict .
✔ Validation passed

$ claude plugin validate --strict ./plugins/oci-marketplace
✔ Validation passed

$ sh plugins/oci-marketplace/tests/install-script.test.sh
PASS: install and replacement activate validated artifacts; fetch, digest, validation, and activation failures preserve the prior installation.

$ claude plugin test ./plugins/oci-marketplace
error: unknown command 'test' (Did you mean list?)

$ skillctl validate examples/claude-oci-demo/v1
/bin/bash: line 1: skillctl: command not found
```

The plugin test rerun could not execute because this container's Claude Code 2.1.156 predates the `plugin test` command; the 23-pass result for the unchanged v0.3.2 code remains recorded under T501. `skillctl` is also absent here, so artifact validation and live Quay inspection were not repeated. T501 records that the in-sandbox Quay pull failed DNS and that the same live install succeeded after retrying with network-enabled permissions. No artifact was published again.

The README's two catalog-generation snippets were executed in a temporary directory. They produced the supplied v1 tags, changed them to the supplied v2 tags, and both catalog-only marketplace manifests passed validation with the expected no-plugins warning. A local Markdown link scan passed for 38 links across 11 files. The tracked-content scan covered 29 paths and found no credential material or local authentication/configuration files; `.serena/` and `openshell/` are absent and neither path is tracked. The final staged scan and `git diff --check` are recorded with the T503 commit.

| Demo acceptance scenario | Result | Evidence |
| --- | --- | --- |
| Validate the repository and add it from Git | Pass | T002 validation and live registration; clean-profile registration is recorded under T501. |
| Show and install the manager through `/plugin` | Pass | T002 live marketplace and plugin checks. |
| List every registered marketplace in the manager and classify standard-only versus OCI-enabled | Pass | T304 live isolated profiles show complete lists after standard-only and OCI-enabled adds; the current default profile list is empty. |
| Add a standard-only marketplace and exclude it from OCI entries | Pass | T301/T501 registration and live browse evidence. |
| Load two OCI marketplaces with distinct skill identities | Pass | T501 live browse listed the demo and guide entries under separate marketplace names. |
| Publish sample v1 with the supplied registry coordinates | Pass | T005 and T303 report `skillctl` build, push, inspect, and resolved digest evidence. |
| Browse and install v1 only after approval | Pass | T303 records native confirmation, Claude permission, then retrieval and activation. |
| Show version/source/digest and invoke after reload | Pass | T303 records demo v1; the supplied checkpoint also reports guide v1 invocation. |
| Detect published v2 | Pass | T401 records live demo digest detection; T501 records the second skill's published v2 digest. |
| Show one live multi-update summary, subset selection, and dismissal without retrieval | Partial | T402 interaction fixtures cover selection, dismissal, and no pull; the live Claude update summary had one item and was cancelled. |
| Apply a selected update through confirmation and permission, reload, and invoke v2 | Pass for demo | T403 records the complete live demo v2 flow. Guide v2 invocation and independent installed-record verification remain pending under T501. |
| Preserve installed v1 after fetch, digest, validation, or activation failure | Pass | T403 fixtures and the final install-script failure-injection run. |

**Historical verdict (superseded by T304):** At the time of this audit, the expanded MVP was not ready for a go recommendation because the generic command and complete marketplace list were not implemented. T304 has since completed those items and records live checks below. T501 and T502 still require their expanded-scope rechecks, and T503 must rerun after them. No registry coordinates were invented and no artifacts were republished.

## T304 — General marketplace manager

**Result:** Done.

The implementation now exposes one general `marketplace-manager` plugin and registers `/marketplace-manager`. Its `list` action reads `claude plugin marketplace list --json`, shows each registration's name and source, and classifies it by the presence of `oci-catalog.json` at Claude's reported `installLocation`. Standard-only entries stay visible in this list and are not parsed into OCI skill entries. `add <source>` invokes Claude's user-scope marketplace registration command and then renders the complete refreshed list. OCI browse/install/update actions remain on the same manager; standard plugin browsing and installation stay in Claude's `/plugin` interface.

### Validation and live evidence

The supported tools in this environment are:

```text
$ claude --version
2.1.299 (Claude Code)

$ skillctl --version
skillctl version 0.4.0

$ claude plugin marketplace list --json
[]
```

The last output is the current default profile's authoritative marketplace list. I tested registration and listing in a fresh temporary `CLAUDE_CONFIG_DIR`, leaving the default profile unchanged. On Claude Code 2.1.299, the actual plugin runtime loaded and executed `/marketplace-manager list` successfully. The command did not collide with a built-in command or alias; T003's earlier `/marketplace` built-in alias conflict remains the reason for the longer command name.

Through the manager command in that disposable profile, I added a temporary strict-valid standard-only marketplace and the repository marketplace, which contains the supplied OCI catalog. Each add refreshed the complete list:

```text
[standard add]
Successfully added marketplace: manager-live-standard (declared in user settings)
- manager-live-standard | directory: <temporary fixture path> | standard-only

[OCI add]
Successfully added marketplace: claude-oci-marketplace (declared in user settings)
- claude-oci-marketplace | directory: <repository path> | OCI-enabled
- manager-live-standard | directory: <temporary fixture path> | standard-only

[complete list]
- claude-oci-marketplace | directory: <repository path> | OCI-enabled
- manager-live-standard | directory: <temporary fixture path> | standard-only
```

The live `list` output also directs users to `/plugin` for standard plugins and to `/marketplace-manager browse` for OCI skills. Interaction tests prove the list uses only Claude's authoritative registration output, standard-only marketplaces are omitted from OCI browsing, and add performs user-scope registration then refreshes all rows after both standard-only and OCI-enabled adds. Existing OCI update/install tests continue to pass.

I also added the local repository marketplace and installed the renamed plugin through Claude's native plugin manager in a fresh profile. `claude plugin list` showed `marketplace-manager@claude-oci-marketplace`, version 0.4.0, enabled at user scope, and a new session without `--plugin-dir` successfully ran `/marketplace-manager list`.

```text
$ claude plugin validate --strict .
Validation passed

$ claude plugin validate --strict ./plugins/oci-marketplace
Validation passed

$ claude plugin test ./plugins/oci-marketplace
24 pass
0 fail

$ sh plugins/oci-marketplace/tests/install-script.test.sh
PASS: install and replacement activate validated artifacts; fetch, digest, validation, and activation failures preserve the prior installation.
```

The plugin marketplace entry now identifies the plugin as `marketplace-manager` version 0.4.0. README installation and command guidance use the generic plugin and command names. Historical OCI-only commands remain in earlier report sections as evidence for the superseded implementation and are labeled by their task and date.

## Current implementation status

- P1 (T101–T102) is complete.
- P2 (T201–T204) is complete.
- P3 (T301–T303) is complete.
- P4 (T401–T403) is complete.
- T304's general-marketplace implementation and live manager checks are complete.
- T501 and T502 remain blocked on the registry authentication and Claude model login recorded above.
- The final T503 audit and no-go recommendation are recorded below.

## T503 — Final validation and secret review

**Result:** Done. **Recommendation: No-go for full demo acceptance** until the supplied registry artifacts and Claude model are accessible and the outstanding T501/T502 checks pass.

The general marketplace manager is implemented and validated. The implementation, failure behavior, documentation, and repository content were checked after T304 and T502. The no-go recommendation is limited to the complete acceptance flow: no current Quay credentials were accepted and Claude model invocation required `/login`, so the current environment could not reproduce artifact installation/update or skill invocation.

### Final validation

```text
$ claude --version
2.1.299 (Claude Code)

$ skillctl --version
skillctl version 0.4.0

$ claude plugin validate --strict .
Validation passed

$ claude plugin validate --strict ./plugins/oci-marketplace
Validation passed

$ claude plugin test ./plugins/oci-marketplace
24 pass
0 fail

$ sh plugins/oci-marketplace/tests/install-script.test.sh
PASS: install and replacement activate validated artifacts; fetch, digest, validation, and activation failures preserve the prior installation.
```

`skillctl validate` passed for demo and guide v1/v2 directories. The README's strict setup, plugin install, catalog generation, manager `add`/`list`, and v1-to-v2 catalog edits were replayed in a clean temporary profile. The manager displayed both OCI catalogs. Registry inspection/browse and pull returned HTTP 401; the current profile's `claude plugin marketplace list --json` output was `[]`. A local guide-v2 invocation failed with `Not logged in · Please run /login`. These limits and the earlier successful T303/T403 live evidence are recorded under T501/T502; no artifact was published during this task.

The final documentation scan checked 39 local Markdown links across tracked Markdown files; all resolved. The current README contains only `/marketplace-manager` user commands and explains complete listing, standard-only visibility, `/plugin`, and the OCI extension boundary. Earlier `/oci-marketplace` command lines remain only in historical report evidence and are identified as superseded.

The tracked-file review found no credential, token, private-key, authentication-file, machine-local settings, `.serena/`, or `openshell/` matches. No pre-existing untracked repository files were present, and no external rehearsal files were staged. The external rehearsal-directory state issue encountered during T502 and its user-directed restoration to the documented v2 references are disclosed there; neither the external files nor their machine-local path are in the repository or commit.

### Acceptance outcome

| Acceptance area | Result | Evidence and limitation |
| --- | --- | --- |
| Validate and register the repository, then install the manager through Claude's marketplace manager | Pass | Current `origin` URL cloned in an isolated config; `marketplace-manager@claude-oci-marketplace` v0.4.0 installed and enabled. |
| Run the generic manager command without colliding with a built-in command | Pass | `/marketplace-manager list` executed from both a local plugin directory and the marketplace-installed plugin on Claude Code 2.1.299. |
| List every registered source and classify standard-only/OCI-enabled | Pass | Isolated live lists showed all registrations; the current default profile list is empty. |
| Add standard-only and OCI marketplaces and refresh the list | Pass | Live manager adds displayed the complete refreshed list after each add. |
| Keep standard-only entries out of OCI skills and retain native plugin use | Pass | Live browse excluded the standard-only row; interaction tests and T004 exercise native `/plugin` behavior. |
| List two OCI catalogs with distinct marketplace-qualified identities | Pass | Live list/browse showed both unique identities; metadata resolution was blocked by 401. |
| Validate supplied local demo v1/v2 artifacts | Pass | `skillctl validate` passed on all four local skill directories. |
| Resolve published demo and guide versions/digests now | Blocked | Current Quay inspection and pull requests return 401 Unauthorized; prior checkpoint digest claims could not be rechecked. |
| Install v1 through manager confirmation/permission, reload, and invoke | Historical pass; current recheck blocked | T303 records the earlier demo-v1 flow. The current profile cannot retrieve the supplied artifact and has no model login. |
| Detect and apply selected v2 updates, then invoke v2 | Partial | T401/T403 record the earlier demo-v2 flow; current registry metadata is unavailable. Multi-update selection/dismissal is covered by tests, while a live multi-update acceptance remains unverified. |
| Preserve installed content when retrieval, validation, or activation fails | Pass | Interaction and installer failure-injection tests pass. |
| Reproduce the complete README workflow in a clean macOS user environment | Blocked | The replay used an isolated Linux profile. Registry authentication, Claude model login, and a macOS host are unavailable. |

### Remaining limitations

- T501 remains blocked until the supplied Quay tags can be inspected/pulled and both installed-v2 records plus the guide-v2 invocation can be rechecked.
- T502 remains blocked until a clean user can complete the registry-backed install/update/reload/invocation procedure.
- The successful live multi-update summary with multiple available updates has not been observed; interaction tests cover subset selection and dismissal.
- During T502, an initial README fixture replay inherited a pre-existing external `REHEARSAL_DIR` and wrote the documented v1 fixture contents there. At the user's direction, both catalogs were restored to the documented v2 references and verified. No external files were committed.

**Final verdict: No-go for complete acceptance; revise the live rehearsal after Quay access and Claude login are available.** T503 itself is complete because its validation, secret review, acceptance outcomes, recommendation, and blockers are recorded.

No credentials, authentication files, or machine-local configuration files are staged or tracked. `.serena/` and `openshell/` were not staged or modified.

## P6 — OCI-source marketplace revision

This section records the 2026-10-15 source-format revision. It supersedes the catalog-based behavior described in P1–P5. The normative contract is in [requirements.md](requirements.md), and the user's strict-validation and catalog-retirement decisions are in [D15/D16](decisions.md#scope-revision--oci-source-marketplace-flow-2026-10-15).

### T601 — Compatibility decision

On Claude Code 2.1.299, a disposable local Git marketplace with `quay.io/dmartino/claude-oci-demo:0.2.0-draft` in `plugins[].source` failed `claude plugin validate --strict` because the source must begin with `./`. The corrected `oci-demo` spike fixture isolated that source error; registering the local Git directory with `claude plugin marketplace add` succeeded and `claude plugin marketplace list --json` returned its registration and install location. No plugin install, `skillctl pull`, or registry operation ran during registration.

The maintained OCI demo sample uses the required `claude-oci-demo` plugin name. Strict validation reports both the raw-source schema error and Claude's reserved third-party plugin-name error. Both are built-in validation constraints; per the user's direction, the marketplace manager reads and handles this extension-owned OCI declaration. Native `/plugin` is not used to discover OCI entries.

The sandbox cannot allocate a pseudo-terminal, is not the macOS demo host, and does not have the separate demo Git URL. T605 owns the live macOS rehearsal. See the [compatibility spike](feasibility-report.md#oci-source-marketplace-compatibility-spike) for exact commands and outputs.

### T602 — Registered marketplace discovery

The manager now reads only `.claude-plugin/marketplace.json` from each Claude-reported `installLocation`. It recognizes tagged raw OCI references in `plugins[].source`, ignores standard relative, Git, URL, and object sources, and reports malformed likely-OCI entries without hiding valid siblings. Marketplace classification remains complete: every Claude registration stays listed, including standard-only marketplaces, and valid OCI entries appear beneath the marketplace as `name@marketplace`.

The old root and guide `oci-catalog.json` fixtures and their parser are removed under D16. The demo and second-marketplace fixture now declare their OCI references directly in marketplace manifests. Older installed-state records that contain a `repository` field may still be read into canonical `source` state; this does not restore catalog-file support.

### T603 — OCI lifecycle through marketplace sources

Install, inspect, update, and installer calls now use the marketplace's raw `source` value. Installed records store `source`. The existing deterministic installer still stages and validates retrieved artifacts before activation and restores the prior installation after failure. The previous Claude lifecycle evidence in T006/T303 covers `SessionStart` reload behavior and the standard `/reload-skills` path; current source-based interaction fixtures cover direct install, native confirmation before the permission-checked installer, selected updates on changed digests, and dismissal/denial paths.

### T604 — Command and deterministic coverage

The `/marketplace-manager browse` command and chooser are absent from the dispatcher, argument hint, and user documentation. `/marketplace-manager list` prints OCI identities and sources for direct install. Standard plugin discovery remains in `/plugin`.

Validation and test commands:

```text
$ claude plugin validate --strict .
✔ Validation passed

$ claude plugin validate --strict ./plugins/oci-marketplace
✔ Validation passed

$ claude plugin test ./plugins/oci-marketplace
21 pass
0 fail

$ sh plugins/oci-marketplace/tests/install-script.test.sh
PASS: install/replacement, SessionStart skill reload, and fetch/digest/validation/activation rollback fixtures.
```

The 21 plugin tests cover raw source parsing, malformed references, standard-only and mixed marketplaces, multiple marketplace identities, non-retrieval during listing and metadata checks, direct installation by qualified identity, approval and permission denial, update selection on a changed digest, installed-state output, and error handling. The installer fixture checks the SessionStart reloadSkills response and covers retrieval, digest, unpack/validation, activation, and rollback failures.

At the time of this earlier check, strict validation against `examples/claude-oci-demo-marketplace` rejected the expected raw OCI `source` and the then-used `claude-oci-demo` plugin name. The fixture now uses `oci-demo-plugin`. The manager parser accepts raw OCI entries; deterministic tests exercise that shape without invoking Claude's built-in validator.

### T605–T606 — Live rehearsal and demo guide

The live acceptance rehearsal remains incomplete. Earlier Linux-sandbox reports record Quay HTTP 401 responses and missing Claude login; they do not establish the current Mac host's authentication state. The separate demo marketplace Git URL is still unresolved. A human-run guide now exists at `docs/demo/README.md`; it remains a draft until the registry-backed install/update flow is replayed successfully under T613.

The final local documentation scan resolved 53 relative Markdown links, and the bootstrap marketplace, manager plugin, demo marketplace, and guide marketplace JSON files parsed successfully.

## T608 — Project-owned v1/v2 plugin source and initial Linux packaging probe (superseded)

This source/package work was authorized by the user on 2026-10-15 and run on the current Linux ARM64 host with Claude Code 2.1.299 and GNU tar 1.35. It does not clear the T607/G3 registry gate.

Added complete plugin roots under `examples/oci-demo-plugin/v1` and `v2`. Each contains `.claude-plugin/plugin.json` and a `skills/demo/SKILL.md` component. The installed command is `/oci-demo-plugin:demo`, with version-specific responses. These are full plugin directories packaged together, not individual skillctl artifacts. The packaging and publish notes are in [the example README](../examples/oci-demo-plugin/README.md).

Strict validation passed for both source versions and both extracted archives:

```text
$ claude plugin validate --strict ./examples/oci-demo-plugin/v1
✔ Validation passed

$ claude plugin validate --strict ./examples/oci-demo-plugin/v2
✔ Validation passed

$ claude plugin validate --strict /tmp/oci-demo-plugin-v1-extracted
✔ Validation passed

$ claude plugin validate --strict /tmp/oci-demo-plugin-v2-extracted
✔ Validation passed
```

The deterministic packager uses GNU tar's sorted entries, fixed timestamps, and normalized ownership. Two v1 archive builds matched byte-for-byte; the v2 archive had a different digest:

```text
$ scripts/package-oci-plugin.sh examples/oci-demo-plugin/v1 /tmp/oci-demo-plugin-v1.tar.gz
Packaged examples/oci-demo-plugin/v1 -> /tmp/oci-demo-plugin-v1.tar.gz

$ scripts/package-oci-plugin.sh examples/oci-demo-plugin/v1 /tmp/oci-demo-plugin-v1-repeat.tar.gz
Packaged examples/oci-demo-plugin/v1 -> /tmp/oci-demo-plugin-v1-repeat.tar.gz

$ scripts/package-oci-plugin.sh examples/oci-demo-plugin/v2 /tmp/oci-demo-plugin-v2.tar.gz
Packaged examples/oci-demo-plugin/v2 -> /tmp/oci-demo-plugin-v2.tar.gz

$ sha256sum /tmp/oci-demo-plugin-v1.tar.gz /tmp/oci-demo-plugin-v1-repeat.tar.gz /tmp/oci-demo-plugin-v2.tar.gz
7d5a86b89d34d7488feb5d4838d763386cd3b97604f40b00c713af94ae8afae1  /tmp/oci-demo-plugin-v1.tar.gz
7d5a86b89d34d7488feb5d4838d763386cd3b97604f40b00c713af94ae8afae1  /tmp/oci-demo-plugin-v1-repeat.tar.gz
48e5cdb159c5381e95ceb837a11c99bc1f0718fb9383935c67ca3cbf5e02935d  /tmp/oci-demo-plugin-v2.tar.gz
```

The archive contains `.claude-plugin/plugin.json` at its root, followed by the complete `skills/demo` component. Extracted v1 and v2 directories passed strict validation. A fresh temporary `CLAUDE_CONFIG_DIR` registered a temporary local marketplace and installed the extracted v1 plugin using native Claude commands; `claude plugin list --json` reported version `0.1.0`, `enabled: true`, and user scope under that profile. This verifies Linux local activation, not an OCI registry install or interactive skill invocation.

Registry publication is not complete. The sandbox has no ORAS executable, Go toolchain, or network path to GitHub/Quay; see the [Linux T607 check](feasibility-report.md#linux-current-host-feasibility-check-2026-10-15). No artifact/layer media type was selected from registry evidence, no remote tag was written, and no registry digest was recorded.

### Correction — Direct ORAS folder publication (2026-10-15)

The Python/GNU-tar packaging script and reproducible-archive workflow above were an intermediate implementation and are superseded by [D20](decisions.md#d20--publish-plugin-directories-directly-with-oras). ORAS 1.3.4 publishes a plugin directory directly when run from that plugin root with `.`; it creates the gzip OCI layer and `oras pull` expands the plugin at the destination root. The script was removed. Current macOS local-layout evidence for v1/v2 and the manager plugin is in the [direct-directory ORAS check](feasibility-report.md#direct-directory-oras-check-macos-2026-10-15). Direct-directory publication and retrieval from the configured registry remain open T607/T608 checks.

## OpenShell ORAS installer alignment (2026-10-15)

User-requested environment change implementing R4/R5 and D17/D20: `openshell/Dockerfile` installs pinned ORAS 1.3.4 instead of skillctl, selects Linux amd64/arm64, verifies the release archive against the upstream checksum file, and checks `oras version`. `agent.sh` passes `ORAS_VERSION` and uses an ORAS-specific image tag. The Quay policy permits `/usr/local/bin/oras`. Registry checks use `oras manifest fetch --descriptor` only when the operator supplies `DEMO_PLUGIN_REF`; historical skill tags are no longer inspected. Credential storage remains unchanged. OpenShell guidance reflects these changes and labels its old catalog rehearsal as historical.

Validation in the Linux sandbox: `bash -n openshell/agent.sh`, `python3 openshell/vertex-config.test.py`, and `git diff --check` passed. Temporary mocked Podman/OpenShell executables verified default and overridden ORAS build arguments/image tags, tool-version checks, and metadata-only checks with and without a supplied reference. `rg -n 'skillctl|SKILLCTL' openshell` returned no matches. No Docker, Podman, or ORAS executable is installed here. Downloading `https://github.com/oras-project/oras/releases/download/v1.3.4/oras_1.3.4_checksums.txt` failed with curl exit 7 (connection to GitHub unavailable), so the image build and live registry check remain unverified. This environment-only change does not complete T607 or the full-plugin lifecycle tasks.

## T608 — Copyable examples and URL bootstrap (2026-10-15)

**Result: Done (R2–R4, R15).** This task prepares source and instructions; it does not claim the manager's new materialization flow is implemented. It was completed independently of the blocked registry pull, under the user's instruction to execute all unblocked tasks.

- All four example files (v1/v2 plugin manifests and skill files) are publicly available through GitHub; each was verified with `gh api repos/dmartinol/claude-oci-marketplace-poc/contents/<example-path> --jq .sha`.
- Copied both complete example roots to `/tmp/oci-copy-examples-k4fotslb`. Executed both shell publishing snippets from the example README with only `--oci-layout` added to ORAS commands and a temporary repository path. Both strict plugin validations, root-directory pushes, and metadata lookups passed using installed tools. No project script or POC checkout is required by the snippets.
- The example README now includes the short marketplace JSON declaration using the existing `source` field. The demo guide links directly to the four copyable source files.
- From `/tmp`, with a fresh `CLAUDE_CONFIG_DIR=/tmp/oci-bootstrap-spike-25fg5mjg`, executed:

```text
claude plugin marketplace add https://github.com/dmartinol/claude-oci-marketplace-poc.git --scope user --json
claude plugin install marketplace-manager@claude-oci-marketplace --scope user --json
claude plugin list --json
```

Both mutations returned `outcome: "ok"`. Listing reported `marketplace-manager@claude-oci-marketplace`, version `0.5.0`, `enabled: true`, installed under that isolated profile. Claude retrieved Git content internally; there was no manual clone or command run from a POC checkout.

The registry v1 direct-directory push is recorded under T607; its layer retrieval is blocked by the active Quay CDN network policy. The installed bootstrap still contains the legacy skill backend, so bootstrap installation alone is not proof of OCI marketplace materialization. macOS interactive end-to-end acceptance remains T613.
