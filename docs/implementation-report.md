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

## Current implementation status

- P1 (T101–T102) is complete.
- P2 (T201–T204) is complete.
- T301 and T302 are complete. T303 remains pending its end-to-end install and reload evidence.
- P4–P5 remain pending their plan dependencies and end-to-end acceptance evidence.

No credentials, authentication files, or `.serena/` contents were staged.
