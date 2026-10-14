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

## Current implementation status

- P1 (T101–T102) is complete.
- T201 is complete.
- T202 installed-state persistence is complete. T203 deterministic `skillctl` operations and T204 staged replacement remain under implementation.
- P3–P5 remain pending their plan dependencies and end-to-end acceptance evidence.

No credentials, authentication files, or `.serena/` contents were staged.
