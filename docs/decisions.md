# Product Decisions

This document records agreed product choices and unresolved feasibility questions. Normative behavior belongs in [requirements.md](requirements.md).

## Current direction — D22: native-compatible marketplace POC

The latest developer-flow clarification supersedes earlier manager-only OCI visibility and registration choices in D1, D2, D4, D6, D11, D14, and D15, and corresponding wording in the scope revision below. Historical decisions and evidence remain recorded rather than silently rewritten.

- The publisher keeps raw tagged OCI references in `plugins[].source` in a GitHub marketplace. ORAS publishes and extracts complete plugin directories, as in D17/D20.
- `/marketplace-manager add <git-url>` retrieves that content and, after approval, pulls/extracts the plugins, generates a local marketplace with native relative plugin paths, and registers it with supported Claude commands. Raw OCI sources need not pass native validation; the generated marketplace must.
- Preserve the published marketplace name and plugin identities. The generated marketplace is visible and installable in both `/plugin` and the manager, without a duplicate source registration. The manager keeps minimal original Git/OCI provenance alongside its files; Claude registrations remain authoritative for the visible list.
- Adding an OCI marketplace downloads its plugin bundles after confirmation and Claude permission. Listing and update checks do not download layers. Updates check the same OCI tags at session start or manual refresh and apply only after approval. Restart activation is sufficient.
- Users install the manager by URL and use installed tools. No POC checkout, repository scripts, or custom packager is required; copying example plugins is allowed. The configured demo coordinates remain environment inputs. OpenShell is contributor tooling only.
- The bootstrap and demo marketplaces may live in different branches of the same GitHub repository. The demo branch URL uses Claude's supported `repository.git#ref` form. A second repository is unnecessary for the POC.
- Keep the spike and implementation small. Prove the native registration/install/update path before implementing it; retain the feasibility/report/approval workflow in AGENTS.md. Earlier packaging approval is retained, not treated as proof of the new flow.

The current [requirements](requirements.md) and [plan](plan.md) govern implementation. Remote direct-directory retrieval and native CLI installation/update pass; the user also confirmed the Mac feasibility spike's marketplace visibility, component invocation, and restart behavior. T607 is complete. The current manager now passes a fresh Linux rehearsal using the same-repository demo branch; the final Mac manager UI check remains T613. Older open-question and status wording below is historical.

## Historical decisions

The sections below retain superseded product choices and tool names for traceability. They are not current setup instructions or dependencies for the intended ORAS workflow.

### Historical scope revision — OCI-source marketplace flow (2026-10-15)

The requirements revision on 2026-10-15 supersedes the catalog-based OCI declaration in D3 and every catalog-specific discovery rule in D5, D6, D11, D12, and D14. The current product contract is the raw tagged OCI reference in a marketplace plugin entry's `source` field, with a `name` and `description`; the user directed that `oci-catalog.json` be retired. Claude's registered marketplace list remains authoritative, and content is read from each registration's `installLocation`. The manager parses OCI entries; Claude's built-in validator and `/plugin` do not need to parse the extension value. Standard plugin sources remain native `/plugin` entries.

### D15 — Raw OCI-source declaration and renewed feasibility gate

The 2026-10-15 requirements define raw tagged OCI references in `plugins[].source` as the OCI marketplace contract. The manager plugin parses this field from Claude's registered marketplace content; the strict validator's rejection is expected because the built-in source schema does not understand the extension-owned OCI value. On Claude Code 2.1.299, `claude plugin validate --strict` reports `plugins.0.source: Invalid string: must start with "./"`, while local marketplace directory registration succeeds. The user clarified on 2026-10-15 that the built-in commands are expected to reject this field and that manager parsing is the intended product behavior. The built-in `/plugin` UI is reserved for standard plugin sources; the manager lists OCI identities for direct install. This validation behavior is recorded and does not block implementation.

### D16 — Retire the legacy catalog

Do not parse or support root `oci-catalog.json`. Marketplace OCI declarations use raw tagged references in `plugins[].source` with a plugin `name` and `description`. OCI demo fixtures declare the source directly; the bootstrap marketplace keeps its ordinary relative manager-plugin source. Previously installed state records may still be read for migration, but old catalog files do not contribute entries.

### D17 — ORAS distribution of complete Claude plugin bundles

The user clarified that skillctl builds OCI artifacts for individual skills, not complete Claude plugins, and selected ORAS for the plugin payload. Treat one raw OCI source entry as one complete Claude plugin directory. Publish from the plugin root with ORAS; ORAS creates the compressed layer, so the developer does not create a separate archive. Use ORAS for publication, metadata lookup, and retrieval; do not use skillctl for this plugin payload. The ORAS feasibility spike records the artifact type, standard layer type, directory layout, annotations, registry behavior, and persistent Claude activation path. Artifact title and version annotations must match plugin.json. Metadata checks must not retrieve artifact layers. The earlier G2 approval applied to skillctl-based individual skills and does not approve this changed workflow.

**Supersession:** D17 supersedes D12's skillctl payload contract, D13's skill-directory installation target, and OCI-skill-specific language in D1, D2, D7–D9, D11, and D14. Their evidence remains historical and does not prove full-plugin OCI packaging or activation. D15's manager-owned raw-source decision and D16's catalog retirement remain active.

### D18 — The project owns demo plugin sources and artifact tags

The POC must not depend on someone else supplying a complete plugin source, prebuilt artifact, or OCI tag. T607 uses the maintained `plugins/oci-marketplace` bundle already in this repository for the ORAS feasibility publication; it creates a spike tag as `marketplace-manager-<plugin-version>-oras-spike` in the repository named by the supplied demo registry configuration (currently evidenced plugin version: `0.5.0`). T608 adds the complete v1/v2 demo plugin source to this repository and uses the project-defined mutable tag `oci-demo-plugin-draft` for both versions. Publish each version directly from its plugin root. For OCI publication, the demo setup supplies the repository and local credentials; it does not supply plugin artifacts or tags. Historical skill artifact tags must not be reused. This decision does not authorize guessing a registry host, namespace, or repository.

### D19 — Initial Linux execution environment (superseded by D21)

This recorded the initial sandbox choice. The sandbox lacked ORAS and could not reach GitHub or Quay, so it did not complete registry checks. The user later clarified to run the work on the configured Mac host; see D21. This does not change R1: the first end-to-end product demo and T613 acceptance remain macOS.

### D20 — Publish plugin directories directly with ORAS

ORAS 1.3.4 accepts a directory operand. Run `oras push` from the plugin root with `.` so `oras pull` extracts `.claude-plugin/plugin.json` and all components directly into the destination root. ORAS creates a gzip-compressed layer using the standard media type `application/vnd.oci.image.layer.v1.tar+gzip` and marks it for unpacking. Use artifact type `application/vnd.dmartino.claude.plugin.v1` and manifest annotations `org.opencontainers.image.title` and `org.opencontainers.image.version`. Do not maintain a separate tarball or packaging script. The local OCI-layout check confirmed this behavior for v1 and v2; registry behavior for the direct-directory layer and digest-pinned pull remains to be recorded in T607.

### D21 — Use the configured Mac host for current T607/T608 work

After the Linux sandbox proved to lack ORAS and registry access, the user directed T607/T608 execution on this Mac host. ORAS 1.3.4, Claude Code 2.1.300, and Git 2.50.1 are available here. The local direct-directory OCI-layout check is recorded in the feasibility report. Linux sandbox results remain historical; Mac remains the first demo and acceptance target.

### D23 — Keep the bootstrap and demo marketplace in one repository

The user clarified that the POC should reuse one GitHub repository. Keep the native bootstrap marketplace on `main` and publish the demo marketplace configuration on branch `oci-demo-marketplace`. Add it with `https://github.com/dmartinol/claude-oci-marketplace-poc.git#oci-demo-marketplace`; Claude's documented `repository.git#ref` syntax selects the branch without a manual clone. The branch manifest is named `claude-oci-demo-marketplace` and declares the configured `quay.io/dmartino/claude-oci-demo:oci-demo-plugin-draft` reference in the normal `plugins[].source` field. The native bootstrap URL remains the repository's default branch. Both direct manager retrieval and registration of the generated marketplace were exercised from a fresh Linux profile.

## Accepted decisions

### D1 — Standard marketplace visibility

The regular `/plugin` UI remains Claude's native interface for standard marketplace plugins. The custom marketplace manager lists all registered marketplaces, including standard-only ones, and identifies OCI-enabled marketplaces. OCI plugin entries are listed and installed through the manager; standard plugin operations remain in `/plugin`.

### D2 — Marketplace add contract

The manager command is the generic `/marketplace-manager`, subject to validation against the supported Claude version's built-in command and alias set. It replaces the OCI-specific `/oci-marketplace` entry point; T003 found that `/marketplace` conflicts with a built-in alias. Its `list` action shows every Claude-registered marketplace; `add <source>` registers a standard or OCI-enabled marketplace at user scope through Claude's marketplace registration command and refreshes the complete list. OCI plugin installation and update are extensions of this general manager. On Claude Code 2.1.299, T304 loaded and executed `/marketplace-manager list` from the marketplace manager plugin without a built-in command collision.

### D3 — OCI catalog separation

OCI metadata lives in a separate extension-owned `oci-catalog.json` at the marketplace root. Claude's `.claude-plugin/marketplace.json` remains standard. The catalog is an object with a `skills` array; each entry requires non-empty `name`, `description`, and `repository` strings. The `repository` is a tagged OCI image reference.

### D4 — Marketplace source of truth

Claude's registered marketplace configuration is authoritative. The manager discovers compatible catalogs from those registrations and does not maintain an independent marketplace registry.

### D5 — Multiple catalogs and identity

Multiple OCI-enabled marketplaces are supported. Skills use the standard marketplace-style identity `<skill-name>@<marketplace-name>`. Skill names must be unique within one catalog; the same name in separate marketplaces remains distinct. A marketplace without `oci-catalog.json` contributes no OCI skills.

### D6 — Standard-only marketplace compatibility

Adding a valid Claude marketplace without an OCI catalog still succeeds. It appears in the manager's all-marketplace list as standard-only, remains available through `/plugin`, and contributes no OCI skill entries to the OCI browser.

### D7 — Update interaction

Available plugin updates produce a non-blocking indicator and one summary with per-plugin selection. Applying an update requires a native mod confirmation followed by Claude's standard permission flow.

Claude Code 2.1.296 supports this path with `$.ui.toast`, `$.ui.ask`, and a permission-checked `$.tool.call`. The manager may use `$.ui.status` while the permission request is pending.

### D8 — Alert dismissal

Dismissing an available-update alert suppresses it for the current session only. It returns at the next startup or manual refresh while the update remains applicable.

### D9 — Reload behavior

The recorded `SessionStart`, `reloadSkills`, and `/reload-skills` behavior applies to the historical individual-skill implementation only. D17 requires the ORAS feasibility spike to establish a supported plugin activation and reload path; the implementation must use that path and need not add custom hot reload.

### D10 — Feasibility gate

Agents complete the feasibility spike, report evidence and blockers, and stop for explicit approval before implementing the full workflow. Unsupported mod behavior is a blocker to report, not permission to silently replace the intended UX.

The skill-distribution spike was approved for full implementation on 2026-10-14; Gate G1 is cleared for that historical workflow. D17 introduced Gate G3 for the ORAS full-plugin workflow. On 2026-10-15, the user approved the direct-directory ORAS approach. That approval establishes the packaging direction; T607 still tracks outstanding remote registry retrieval and activation evidence.

### D11 — Registered marketplace discovery

The manager enumerates all registered marketplaces through Claude Code's `claude plugin marketplace list --json` output and uses those registrations as the authoritative all-marketplace list. Each entry's `installLocation` is the authoritative content location. A marketplace is OCI-enabled when its marketplace manifest contains a valid manager-owned raw OCI source; absence of one classifies it as standard-only. The manager does not create or maintain a second remote marketplace registry.

### D12 — Historical `skillctl` distribution contract (superseded by D17)

The prior POC used `skillctl` 0.4.0 to build, inspect, push, pull, and unpack individual OCI skill artifacts. This evidence is retained for the historical skill workflow only. D17 replaces it with complete plugin bundles and ORAS.

### D13 — Historical skill installation target (superseded by D17)

The earlier skill flow installed under `<CLAUDE_CONFIG_DIR>/skills` or `~/.claude/skills`. D17 requires the ORAS plugin flow to respect the active config directory through a supported plugin installation path, which T607 must establish.

### D14 — General marketplace manager with OCI extension

Marketplace listing and source registration are the manager's general-purpose core and apply to standard as well as OCI-enabled Claude marketplaces. The 2026-10-14 implementation layered individual-skill installation onto that core; D17 changes the OCI payload to complete plugins. Standard plugin browsing and installation continue through Claude's native `/plugin` interface.

## Open feasibility questions

No ORAS packaging or native CLI feasibility question remains open; T607/G3 are complete. T613 tracks the remaining interactive Mac rehearsal of the installed manager, including the confirmation and permission prompts, `/plugin` visibility, and same-tag update notice.

