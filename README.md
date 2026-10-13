# Claude OCI Marketplace POC

Browse, install, use, and update OCI-distributed skills entirely inside stock Claude Code. KISS: one plugin, one small catalog, one sample skill, and this README.

## Goal

Emulate a real marketplace experience inside Claude using a custom `/marketplace` entry point, a mod for deterministic UI/actions where supported, and a startup hook. Use `skillctl` to retrieve and unpack OCI images as ordinary Claude skills.

This is an extension-managed marketplace, not native OCI support in the built-in `/plugin` loader. Claude Code is mandatory. Do not fork the CLI, override `/plugin`, or use a command-source marketplace adapter as the primary UX.

## Requirements

| ID | Requirement |
| --- | --- |
| R1 | Run on stock Claude Code; macOS is the first demo environment. |
| R2 | Browse skills and select install/update actions inside Claude. Verify exact `/marketplace` naming and mod UI APIs in the initial spike. |
| R3 | Read a small catalog containing skill name, description, and OCI repository reference. Reuse Claude marketplace entry structure where useful; OCI fields belong to our extension, not Claude's schema. |
| R4 | Use `skillctl` to retrieve and unpack skills into ordinary Claude skill directories, reusing registry credentials. |
| R5 | Show installed version, source registry, and resolved digest. |
| R6 | Make installed/updated skills invocable, preferably without restarting. Verify discovery/reload behavior first. |
| R7 | Check for newer published versions on session startup and manual refresh. Download artifact content only during install/update. |
| R8 | Apply updates when the user selects update. Stage replacements; preserve the working installation on failure. |
| R9 | Deliver one plugin with mod UI where feasible, a SessionStart hook, and a small shared helper around skillctl. No daemon. |

## Demo acceptance

1. Build and publish sample skill v1 to a public Quay repository using skillctl.
2. Start Claude with our plugin installed.
3. Open the marketplace, browse, and install without leaving Claude.
4. Show version/digest and invoke the skill.
5. Publish v2 with visibly different behavior.
6. Discover it through manual refresh or the next session startup.
7. Select update inside Claude and invoke the updated skill.
8. Show that a failed fetch preserves the working installation.

The Quay namespace and credentials are supplied locally; do not invent a usable image reference or commit credentials.

## First task: feasibility spike

Before implementing the full workflow:

- Record actual `claude --version` and `skillctl version` on the demo machine.
- Verify mod availability and supported command/UI registration APIs.
- Verify the actual command name: plugin skills may be namespaced. Do not assume an unqualified `/marketplace` works.
- Distinguish a prompt-based skill from a deterministic UI command.
- Prove one action can call skillctl, unpack a skill, and make Claude discover it.
- Verify SessionStart and skill reload against the installed version, including newly created directories.
- Report evidence and blockers before changing the intended UX.

Documentation is a starting point; no local integration has been validated yet.

## Out of scope

Native OCI changes to `/plugin`; Compass integration or consumption tracking; registry webhooks/push notifications; background polling; multiple catalogs; security advisory processing; signature enforcement; platforms beyond the initial macOS demo.

This POC demonstrates distribution and updates, not a complete secure supply chain. Signing can follow after actual skillctl support is verified.

## Implementation guidance

Use minimal plugin metadata, a marketplace entry point, mod code if supported, a startup hook, a small deterministic helper, a catalog, and a sample skill. Keep file/registry operations in code rather than model-generated shell actions. No elaborate specification framework or per-release documents.

## Continue in local Codex

```bash
git clone git@github.com:dmartinol/claude-oci-marketplace-poc.git
cd claude-oci-marketplace-poc
```

Open this directory in Codex and use this prompt:

> Read README.md and implement the feasibility spike first. Claude Code is mandatory. Keep the POC simple and preserve the in-Claude marketplace UX. Check locally installed Claude and skillctl versions and actual APIs. Report feasibility evidence and blockers before implementing the remaining workflow. Use the configured demo registry; never commit credentials.

## References

- [SkillImage](https://skillimage.dev/)
- [skillctl source](https://github.com/redhat-et/skillimage)
- [Distribution slides](https://skillimage.dev/slides/oci-skill-distribution-deck.html)
- [Claude skills](https://code.claude.com/docs/en/skills)
- [Claude hooks](https://code.claude.com/docs/en/hooks)
- [Claude mods](https://code.claude.com/docs/en/plugins/mods/overview)
- [Marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference)
- [Official marketplace example](https://github.com/anthropics/claude-plugins-official/blob/main/.claude-plugin/marketplace.json)
