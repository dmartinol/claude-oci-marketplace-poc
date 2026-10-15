# Run Codex in OpenShell on macOS with Podman

This directory packages the setup developed for `dmartinol/claude-oci-marketplace-poc`: a Codex/Claude/ORAS workload image, an explicit OpenShell policy, and a Mac-side helper script. Claude Code uses Google Cloud Vertex AI with host Application Default Credentials (ADC); it does not use an Anthropic API key. Codex works on a clone under `/sandbox`; it does not modify your Mac checkout. Push changes from the sandbox and pull them on the Mac when ready.

The catalog rehearsal commands below are historical individual-skill tooling and do not implement the ORAS plugin workflow. Use [the current demo guide](../docs/demo/README.md) for full-plugin publication and feasibility checks.

## Baseline and validation status

The troubleshooting session used macOS arm64, Podman 6.0.0, OpenShell 0.1.4, and Codex CLI 0.162.1 (the original community image had 0.117.0). This bundle consolidates those commands and adds the project dependency/rehearsal patch. The Vertex ADC helper has local syntax and fixture checks. The current checkout environment has no `gcloud`, Podman, or OpenShell executable and no configured ADC, so it cannot run the live Vertex check or a sandbox replay. No Podman image build or complete end-to-end replay has been executed here. Check your installed CLI help if a later release changes flags.

The Dockerfile deliberately derives from the **retired NVIDIA community base image** for this POC. It updates Codex but does not modernize every dependency. `latest` is mutable and does not imply the latest agent CLI. For a maintained deployment, replace the base with an image you maintain and pin its digest. The explicit policy bypasses the invalid bundled image policy encountered during setup.

## Files

| File | Purpose |
| --- | --- |
| `Dockerfile` | Build Codex 0.162.1, Claude 2.1.299, and ORAS 1.3.4; no credentials are baked in |
| `policy.yaml` | OpenAI, Google Vertex AI/ADC, optional direct Anthropic API, Quay, and repository-scoped GitHub access |
| `rehearsal.py` | Generate fresh v1 catalogs and switch to already-published v2 tags |
| `agent.sh` | Mac-side lifecycle, Vertex ADC transfer, Git setup, and Codex launch |
| `vertex-config.py` | Validate user ADC and write Vertex launch settings inside the sandbox |
| `vertex-config.test.py` | No-network checks for credential validation and generated launch files |

Copy this directory into the repository as `openshell-agent/`. Run the following commands from that directory on your **Mac**, unless stated otherwise.

## 1. Prerequisites and installation

Install Homebrew and Podman/Podman Desktop first. Make sure the existing Podman machine is running:

```bash
podman machine list
# Only if your existing machine is stopped:
podman machine start
podman info
```

If there are no machines and this is a new Podman installation, initialize one with `podman machine init`, then start it. Do not create another machine just because a CLI connection fails.

Remove terminal-wide OpenCode-specific `XDG_CONFIG_HOME` and `XDG_DATA_HOME` exports from terminal/shell settings. For an existing terminal:

```bash
unset XDG_CONFIG_HOME XDG_DATA_HOME
```

The helper also clears those two variables for its own process, so it consistently uses the normal Podman and OpenShell state locations.

Install OpenShell:

```bash
bash agent.sh install
openshell --version
```

Equivalent official installer:

```bash
curl -LsSf https://raw.githubusercontent.com/NVIDIA/OpenShell/main/install.sh | sh
```

On macOS the installer uses Homebrew and starts a gateway service. This is a macOS guide, not a Linux installation recipe.

## 2. Build the image

The image now pins the project rehearsal versions: Claude Code 2.1.299 and ORAS 1.3.4, alongside Codex 0.162.1. Build-time checks require the matching versions and `claude plugin test --help`. The ORAS release download verifies the archive checksum and selects Linux arm64/amd64 automatically. Claude auto-updates are disabled; upgrade versions explicitly when needed. Model credentials are configured separately after sandbox creation.

```bash
bash agent.sh build
```

Equivalent command:

```bash
podman build --build-arg CODEX_VERSION=0.162.1 \
  --build-arg CLAUDE_VERSION=2.1.299 --build-arg ORAS_VERSION=1.3.4 \
  -t localhost/codex-project:0.162.1-claude2.1.299-oras1.3.4 .
```

Choose a different validated release consistently for build and creation:

```bash
export CODEX_VERSION=0.162.1
```

The host-side Podman build downloads npm packages outside the sandbox policy. Runtime package installation, SSH Git, and arbitrary dependency downloads are not enabled. The policy allows `aiplatform.googleapis.com` and `oauth2.googleapis.com` for Claude Code's Vertex AI model requests and ADC refresh, `api.anthropic.com` for direct Anthropic API sessions, and `quay.io` for ORAS. These host-level rules permit traffic to those hosts, not only a single API path or OCI repository; scope the supplied registry credentials appropriately. Redirected registry blob hosts are not pre-authorized; add only destinations observed in policy-denial logs if needed.

## 3. Configure and register the gateway

For a new configuration, use `~/.config/openshell/gateway.toml`:

```toml
[openshell]
version = 2

[openshell.gateway]
compute_driver = "podman"
```

Preserve existing configuration and merge this selection rather than overwriting unrelated settings. No bind-mount settings are needed for a sandbox-local clone.

```bash
bash agent.sh gateway
```

The helper creates the minimal file only if absent, restarts the Homebrew service, registers/selects `https://localhost:17670`, and retries gateway status for up to 30 seconds. With an existing file, confirm that it actually selects Podman.

Manual equivalents:

```bash
brew services restart openshell
openshell gateway add https://localhost:17670 --local --name openshell
openshell gateway select openshell
openshell status
```

A brief connection refusal immediately after restart can be a startup delay. Do not create a sandbox until status reports Connected and authenticated.

## 4. Create a sandbox with a retained shell

In **terminal A**:

```bash
bash agent.sh create
```

Equivalent:

```bash
openshell sandbox create \
  --name codex-sandbox \
  --from localhost/codex-project:0.162.1-claude2.1.299-oras1.3.4 \
  --policy ./policy.yaml \
  -- /bin/bash -l
```

Keep this terminal and Bash process open. Bash is the sandbox's canonical main process; Codex is launched separately. Quitting Codex with `/q` then leaves Bash running. Exiting Bash ends the main process and can put the sandbox into a terminal phase. We encountered a Completed/running-backend mismatch when Codex itself was the canonical process; avoid that lifecycle here.

## 5. Clone the project

In **terminal B**, on the Mac, from this directory:

```bash
bash agent.sh clone
```

Equivalent:

```bash
openshell sandbox exec -n codex-sandbox -- \
  git clone https://github.com/dmartinol/claude-oci-marketplace-poc.git \
  /sandbox/claude-oci-marketplace-poc
```

This public repository can be cloned anonymously. The helper leaves an existing checkout unchanged instead of deleting or resetting it.

## 6. Authenticate Codex

If the sandbox is not already authenticated:

```bash
bash agent.sh openai-auth
```

Enter your OpenAI API key at the hidden prompt. The script pipes it to `codex login --with-api-key` through stdin and does not embed it in command arguments or the image. API-key usage is billed through the corresponding API account. Check the sandbox CLI version and authentication separately from your Mac's installation.

## 7. Configure GitHub credentials and commit identity

Create a fine-grained GitHub PAT with resource owner `dmartinol`, the selected repository `claude-oci-marketplace-poc`, and **Contents: Read and write**. Add **Pull requests: Read and write** if required, and **Workflows: Read and write** if pushing workflow changes requires it. Repository permissions returned by the API do not independently prove the token has every write permission.

```bash
bash agent.sh github-auth
bash agent.sh identity "YOUR_GITHUB_COMMIT_FULL_NAME" "YOUR_GITHUB_COMMIT_EMAIL"
```

The script validates the PAT with `GH_TOKEN` and `gh api`, then sets Git's HTTPS credential helper. GitHub recommends `GH_TOKEN` for fine-grained PATs; `gh auth login --with-token` is documented primarily for classic tokens and failed with the fine-grained token in this setup.

The PAT is saved in plaintext at `/sandbox/.config/github-token`, with mode 600, outside the repository. It is available to the sandbox user and agent. Do not print it, commit it, upload it, or bake it into an image. Do not run the script with shell tracing. The run command loads `GH_TOKEN` for Codex and its `gh` subprocesses, so no manual token-loading instruction is required each time.

## 8. Verify and run

```bash
bash agent.sh verify
bash agent.sh run
```

The run command starts Codex in `/sandbox/claude-oci-marketplace-poc` with `--yolo`. This disables Codex's internal sandbox and command approvals; OpenShell's filesystem and network restrictions still apply. The nested Codex sandbox failed with `bwrap: No permissions to create a new namespace`, before Git could run.

Manual launch with automatic GH_TOKEN loading:

```bash
openshell sandbox exec -n codex-sandbox --tty \
  --workdir /sandbox/claude-oci-marketplace-poc -- \
  /bin/bash -c 'export GH_TOKEN="$(cat /sandbox/.config/github-token)"; exec codex --yolo'
```

Specify the intended work and publishing authority in your prompt. Token availability and `--yolo` do not replace a clear instruction about whether to commit, push to main, or open a PR.

Quit Codex with `/q`; relaunch with `bash agent.sh run`. Leave terminal A's shell running.

## 9. Configure and rehearse the Claude/OCI project

New images affect **new sandboxes**, not already-created ones. Keep the old sandbox and use `SANDBOX_NAME=codex-project-v2` in both Mac terminals while validating this build. Push/download existing work before deleting anything.

Before configuring Claude Code, prepare Google Cloud access for Claude on Vertex AI. The project needs billing enabled, the Vertex AI API enabled, access to the Claude model you will use in Model Garden, and quota in the selected region. Grant the account used for ADC `roles/aiplatform.user` (or an equivalent role containing `aiplatform.endpoints.predict`). On the Mac, install/configure `gcloud`, select the intended account, and create user ADC:

```bash
gcloud auth application-default login
```

Then run these from terminal B on the Mac:

```bash
# Required for an existing sandbox created with the previous policy.
bash agent.sh policy
bash agent.sh vertex-auth
bash agent.sh vertex-check
bash agent.sh quay-auth
bash agent.sh project-check
bash agent.sh rehearsal-init
bash agent.sh claude
```

For a newly created sandbox using the current `policy.yaml`, skip `bash agent.sh policy`. For an existing sandbox, the command replaces its active policy; save any local policy additions first.

Run `bash openshell/agent.sh policy` from the repository root in the **outer Mac terminal** to load this policy into the selected OpenShell gateway. If you are already in the `openshell/` directory, run `bash agent.sh policy`. This updates the active sandbox policy; it does not need to be run from inside the sandbox.

`vertex-auth` prompts for the Google Cloud project ID. It finds the host ADC file through `gcloud info`, validates that it is user ADC created by `gcloud auth application-default login`, and uploads it to `/sandbox/.config/vertex/application_default_credentials.json` with mode 600. Service-account keys and other ADC types are rejected and are not copied. The helper writes Vertex settings to `/sandbox/.config/vertex/env.sh`, also mode 600. The credential file is sensitive and remains in the sandbox; never print it, commit it, or include it in an image. Delete the sandbox when you are done if you no longer need those credentials.

Claude launches through `claude` source that settings file. `run` puts a small `claude` wrapper first on Codex's `PATH`; the wrapper loads Vertex settings only when Claude is launched, so Codex itself does not inherit Google credential environment variables. The generated `env.sh` sets `CLAUDE_CODE_USE_VERTEX=1`, `ANTHROPIC_VERTEX_PROJECT_ID`, `CLOUD_ML_REGION`, `GOOGLE_APPLICATION_CREDENTIALS`, and `ANTHROPIC_MODEL=claude-sonnet-4-5@20250929`, and clears Anthropic API-key/base-URL overrides. This pins each new Claude launch to Sonnet 4.5 even if Claude previously saved another model choice. The default region is `global`. If you set `VERTEX_REGION` to another supported location, add the corresponding Google Vertex endpoint host to `policy.yaml` before applying the policy. The model endpoint is selected by Claude Code from the region. The pinned native executable is `/usr/local/bin/claude`.

`vertex-check` makes one short Claude Code model request and succeeds only if the configured ADC, project, model access, region, and OpenShell network policy allow it. In the interactive session, `/status` should show `Google Vertex AI` as the API provider and the configured project and region. This sends a small billable request to Vertex AI. If it fails, check that model access is enabled in Model Garden and that the selected region has quota and supports the model.

The separate `claude_anthropic` policy rule allows the Claude executable to reach Anthropic's API directly. It permits that network route but does not configure Anthropic authentication. The Vertex launcher clears Anthropic API credentials and base-URL overrides; confirm `/status` shows `Google Vertex AI` when using Vertex. Remove the `claude_anthropic` rule from `policy.yaml` before applying it if the sandbox must be restricted to Vertex-only model egress.

`quay-auth` prompts for a Quay username (including a robot username if applicable) and password/token. It writes only that host's entry into the sandbox Docker/containers credential stores, preserving existing entries. It does not copy Mac credential helpers or unrelated host credentials. The files are mode 600; base64 encoding is not encryption. For existing-artifact rehearsal, grant registry read access; grant write only if publishing is part of the intended work.

`project-check` verifies Claude, ORAS, and Python versions and availability of `claude plugin test`. If `DEMO_PLUGIN_REF` is set in the Mac terminal, both `quay-auth` and `project-check` run `oras manifest fetch --descriptor` on that full-plugin reference without downloading layers. Set it from the supplied demo registry configuration and the project-owned tag described in [the demo guide](../docs/demo/README.md); historical skill artifact tags are not used. Without it, registry metadata checks are skipped with a message. It does not claim a full demo pass.

`rehearsal-init` uploads the bundled `rehearsal.py`, creates fresh state under `/sandbox/rehearsal`, validates the plugin/marketplace, registers the repository via **HTTPS**, installs the manager, and registers two local v1 catalogs. It refuses to overwrite an existing nonempty rehearsal profile or catalog tree. If registration fails midway, inspect the preserved profile and repair it rather than blindly rerunning initialization.

All launches use these sandbox-local values:

```text
CLAUDE_CONFIG_DIR=/sandbox/rehearsal/claude-config
REHEARSAL_DIR=/sandbox/rehearsal/catalogs
checkout=/sandbox/claude-oci-marketplace-poc
```

Do not reuse `/Users/dmartino/...` or Mac `/tmp/claude-p5-*` paths. Empty skills/installed records are expected in a fresh profile; create them by actually exercising the installation flow, not by copying Mac records.

In Claude, follow the repository README's rehearsal:

1. Check `/plugin`, then `/oci-marketplace browse`.
2. Install `claude-oci-demo@claude-oci-demo-rehearsal` and `claude-oci-guide@claude-oci-guide-rehearsal`, approving native confirmations and Claude's normal permission prompts.
3. Check `/oci-marketplace installed`, run `/reload-skills`, and invoke both qualified skills. Expect `T005 sample skill ready.` and `T501 guide skill ready.`.
4. In another Mac terminal run `bash agent.sh rehearsal-v2`.
5. Back in Claude, run `/oci-marketplace updates`, select/approve the updates, check installed versions/digests, reload skills, and invoke both v2 skills. Expect `T005 sample skill updated to v0.2.0.` and `T501 guide skill updated to v0.2.0.`.

The helper only changes catalog references to already-published tags; it does not publish artifacts or approve installations. Follow the current repository README/report for expected digests and acceptance evidence. `bash agent.sh claude` preserves Claude's native approvals; Codex's `--yolo` does not disable them.

A successful Linux rehearsal is new evidence. It does not retroactively validate the original Mac environment, and it does not automatically mark T501/T502/T503 complete. Record each observed outcome and remaining platform gap.

If Vertex requests fail because of network policy, inspect `openshell logs` for the denied endpoint and binary before adding rules. The bundled policy covers global Vertex model requests and OAuth token refresh; another region may require its specific Vertex hostname.

## Policy scope and updates

The policy permits Codex's OpenAI endpoints, HTTPS Git Smart HTTP operations for this exact repository, and `gh` REST calls to `/`, `/user`, and this repository's REST API subtree, plus Google Vertex AI/ADC endpoints and ORAS Quay endpoints. Local edits, branches, commits, and tests require no GitHub network access. Push requires both policy permission and valid Git credentials.

The policy does **not** enable GitHub GraphQL (`/graphql`), so some high-level `gh pr` commands may still be denied even with a valid PAT. Use repository-scoped REST calls via `gh api` or deliberately extend the policy after reviewing the required operation. Vertex AI and Quay rules are included, but Google Cloud authentication, model access, and interactive acceptance checks still need to be completed. Linux replay does not establish the original macOS-specific acceptance criteria.

To apply the bundled complete policy:

```bash
bash agent.sh policy
```

This replaces the base policy, so preserve custom additions before applying it. Network rules can be updated live. Keep changes in `policy.yaml` as well as the running sandbox so recreation retains them.

For an incremental addition, OpenShell 0.1.4 requires the target rule name and **all its binaries**. The API-root rule is already in this bundle; this example is only for an older policy missing it:

```bash
openshell policy update codex-sandbox \
  --rule-name project_github_api \
  --binary /usr/bin/gh \
  --add-allow 'api.github.com:443:GET:/' \
  --dry-run
```

After reviewing the preview, replace `--dry-run` with `--wait` to apply it.

Run the local configuration checks from this directory:

```bash
bash -n agent.sh
python3 vertex-config.test.py
```

## Diagnostics from the Mac

The sandbox console does not need clipboard sharing. Capture command output on the Mac:

```bash
bash agent.sh status
openshell logs codex-sandbox > /tmp/openshell-agent.log
openshell sandbox exec -n codex-sandbox \
  --workdir /sandbox/claude-oci-marketplace-poc -- \
  git fetch origin > /tmp/git-fetch.log 2>&1
cat /tmp/git-fetch.log
```

`openshell logs` includes supervisor diagnostics received by the gateway. These are distinct from `podman logs`; empty container logs do not imply that no supervisor diagnostics exist. Capture logs before restarting the gateway, which loses its in-memory log buffer.

For gateway startup problems:

```bash
brew services info openshell --json
plutil -p "$HOME/Library/LaunchAgents/sh.brew.openshell.plist"
tail -n 100 /opt/homebrew/var/log/openshell/openshell-gateway.err.log
tail -n 100 /opt/homebrew/var/log/openshell/openshell-gateway.out.log
```

Use the actual plist paths on your machine; `/opt/homebrew` is the Apple Silicon Homebrew prefix used in this session. Inspect logs before changing settings. A 403 can come from policy or GitHub; a successful PAT read does not establish push or workflow-write access. Do not enable HTTP credential tracing when sharing logs.

| Symptom | Next check |
| --- | --- |
| Podman Desktop running but CLI sees no machines | Remove unexpected XDG overrides; inspect machine and connection lists |
| Connection refused immediately after service restart | Retry status; inspect service logs if it persists |
| Missing `codex` executable | Confirm `--from` selects the custom image |
| `ConfigurationInvalid` / invalid image policy | Confirm explicit `--policy`; inspect `openshell logs` |
| Only older models listed | Compare CLI versions and authentication inside/outside the sandbox |
| `bwrap` namespace failure | Confirm the agent was launched with `--yolo` |
| GitHub API denied | Inspect the exact endpoint, executable, and policy decision |
| Git push authentication failure | Verify GH_TOKEN/PAT scope and credential helper |

## Recreate without losing work

Push or download uncommitted work before deleting a sandbox. This workflow assumes deletion discards its clone, credentials, and configuration; do not rely on deleted-sandbox recovery. Never delete simply to repair an authentication error.

For a second sandbox, set its name in both terminals:

```bash
export SANDBOX_NAME=codex-sandbox-2
```

Then repeat create, clone, authentication, identity, and run. Credentials are configured per sandbox, not inherited from the Mac or ChatGPT GitHub plugin. Gateway registration removal is also distinct from deleting a sandbox or stopping the Homebrew service.

## Sources

- [OpenShell 0.1.4 installation](https://docs.nvidia.com/openshell/v0.1.4/about/installation)
- [OpenShell policy management](https://docs.nvidia.com/openshell/dev/how-it-works/policies/manage-policies)
- [OpenShell logs](https://docs.nvidia.com/openshell/observability/accessing-logs)
- [Retired community image repository](https://github.com/NVIDIA/OpenShell-Community)
- [GitHub CLI authentication](https://cli.github.com/manual/gh_auth_login)
- [Codex CLI reference](https://learn.chatgpt.com/docs/cli/reference)

- [ORAS installation](https://oras.land/docs/installation/)
- [Claude native version pinning](https://code.claude.com/docs/en/setup)
- [Claude Code on Google Cloud Vertex AI](https://code.claude.com/docs/en/google-vertex-ai)
- [Google Cloud Application Default Credentials](https://cloud.google.com/docs/authentication/provide-credentials-adc)
