# Demo: publish and update a Claude plugin with OCI

This demo builds a complete Claude plugin from the project examples, publishes it to Quay with ORAS, and installs it through `marketplace-manager`. Then it pushes a new version to the same tag, reviews the update in Claude, and restarts to use the new plugin.

The manager is meant to make OCI delivery controlled and maintainable: it checks metadata before downloading, asks before installation, pulls by digest, validates the complete plugin, and preserves the working version if an update fails.

**Current status:** ORAS direct-folder push, pull, and Claude validation pass in a local OCI layout. Registry-backed directory retrieval and the manager's complete-plugin install/update flow are still being validated. Do not publish this guide as a passed end-to-end demo until those gates pass.

## Tools and prerequisites

- Stock [Claude Code](https://code.claude.com/docs/en/plugins/marketplace-reference), logged in through the isolated profile used below.
- [ORAS](https://oras.land/docs/installation/) 1.3.4 or later, [Git](https://git-scm.com/), `curl`, and `tar`.
- Push access to the Quay repository supplied for the demo, with ORAS using your existing local registry credentials.
- The bootstrap marketplace Git URL and the separate demo marketplace Git URL. The demo marketplace source points at the tag you publish.

No skillctl installation or separate archive-packaging script is needed. If you use your own Quay repository, point a demo marketplace you control at that repository and tag.

## The plugin

| Version | Invocation | Expected response |
| --- | --- | --- |
| v1 (`0.1.0`) | `/oci-demo-plugin:demo` | `OCI demo plugin version 0.1.0` |
| v2 (`0.2.0`) | `/oci-demo-plugin:demo` | `OCI demo plugin version 0.2.0` |

## 1. Download the example and publish v1

This downloads the source archive from GitHub; it does not clone the POC repository. Set `OCI_REPOSITORY` to the exact repository from the supplied demo configuration.

```bash
claude --version
oras version
git --version

export RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/claude-oci-demo.XXXXXX")"
export OCI_REPOSITORY="<repository-from-demo-configuration>"
export OCI_REF="${OCI_REPOSITORY}:oci-demo-plugin-draft"

curl -fL "https://github.com/dmartinol/claude-oci-marketplace-poc/archive/refs/heads/main.tar.gz" \
  -o "$RUN_DIR/poc.tar.gz"
tar -xzf "$RUN_DIR/poc.tar.gz" -C "$RUN_DIR"
export PLUGIN_ROOT="$RUN_DIR/claude-oci-marketplace-poc-main/examples/oci-demo-plugin/v1"

claude plugin validate --strict "$PLUGIN_ROOT"
(
  cd "$PLUGIN_ROOT"
  oras push "$OCI_REF" \
    --artifact-type application/vnd.dmartino.claude.plugin.v1 \
    --annotation org.opencontainers.image.title=oci-demo-plugin \
    --annotation org.opencontainers.image.version=0.1.0 \
    .
)
oras manifest fetch "$OCI_REF" --format json
```

Record the manifest digest and confirm artifact type, version annotation, and layer media type `application/vnd.oci.image.layer.v1.tar+gzip`. ORAS packages the directory during push; using `.` from the plugin root makes a pull extract `.claude-plugin/plugin.json` directly at its output root.

## 2. Start with a clean Claude profile

The profile keeps this run's login, marketplaces, and plugins separate from your normal Claude setup. Treat it as private; do not share its files or credentials.

```bash
export CLAUDE_CONFIG_DIR="$RUN_DIR/claude-profile"
export CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL=1
mkdir -p "$CLAUDE_CONFIG_DIR"
claude plugin marketplace list --json
claude plugin list
```

Confirm the profile has no registered marketplaces or plugins. If Claude asks you to log in, do so in this profile.

Add the POC bootstrap marketplace through Claude's native flow and install the manager:

```bash
claude plugin marketplace add https://github.com/dmartinol/claude-oci-marketplace-poc.git --scope user
claude plugin install marketplace-manager@claude-oci-marketplace --scope user
claude
```

## 3. Add the OCI demo marketplace and install v1

In Claude Code, add the separate demo marketplace by its published Git URL:

```text
/marketplace-manager add <demo-marketplace-git-url>
/marketplace-manager list
```

Confirm `claude-oci-demo-marketplace` is listed as OCI-enabled and contains `oci-demo-plugin@claude-oci-demo-marketplace`. Install it through the manager and approve both the manager confirmation and Claude's permission prompt:

```text
/marketplace-manager install oci-demo-plugin@claude-oci-demo-marketplace
/marketplace-manager installed
```

Open `/plugin` and confirm Claude reports the installed plugin. Exit Claude completely and start it again from the same terminal; plugin changes apply after restart. Invoke `/oci-demo-plugin:demo` and confirm the v1 response.

## 4. Publish v2 to the same tag and update

After v1 works, set `PLUGIN_ROOT` to the downloaded `examples/oci-demo-plugin/v2` directory and publish to the same `OCI_REF`:

```bash
export PLUGIN_ROOT="$RUN_DIR/claude-oci-marketplace-poc-main/examples/oci-demo-plugin/v2"
claude plugin validate --strict "$PLUGIN_ROOT"
(
  cd "$PLUGIN_ROOT"
  oras push "$OCI_REF" \
    --artifact-type application/vnd.dmartino.claude.plugin.v1 \
    --annotation org.opencontainers.image.title=oci-demo-plugin \
    --annotation org.opencontainers.image.version=0.2.0 \
    .
)
oras manifest fetch "$OCI_REF" --format json
```

Confirm the version annotation is `0.2.0` and the resolved manifest digest changed. Start a new Claude session and wait for the update notice. Then review and apply only this plugin's update:

```text
/marketplace-manager updates
```

Approve the update and Claude's permission prompt. Restart Claude, check `/marketplace-manager installed` and `/plugin`, then invoke `/oci-demo-plugin:demo`. Confirm the v2 response.

## Evidence and cleanup

| Gate | Result and evidence |
| --- | --- |
| Clean Claude profile and manager bootstrap | |
| OCI marketplace and plugin listed | |
| v1 install, digest, and response | |
| Same-tag v2 push changed version and digest | |
| Approved update and v2 response after restart | |
| Failed update preserved the working plugin | |

Keep evidence free of credentials and authentication files. When finished, exit Claude and restore the shell environment:

```bash
unset CLAUDE_CONFIG_DIR CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL
unset RUN_DIR OCI_REPOSITORY OCI_REF PLUGIN_ROOT
```
