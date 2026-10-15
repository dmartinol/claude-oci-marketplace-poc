#!/usr/bin/env bash
# Run on the Mac. Requires Bash 3.2+; never enable xtrace with credentials.
set -euo pipefail
set +x
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SANDBOX_NAME="${SANDBOX_NAME:-codex-sandbox}"
CODEX_VERSION="${CODEX_VERSION:-0.162.1}"
CLAUDE_VERSION="${CLAUDE_VERSION:-2.1.299}"
SKILLCTL_VERSION="${SKILLCTL_VERSION:-0.4.0}"
IMAGE="${CODEX_IMAGE:-localhost/codex-project:$CODEX_VERSION-claude$CLAUDE_VERSION-skillctl$SKILLCTL_VERSION}"
REPO_URL=https://github.com/dmartinol/claude-oci-marketplace-poc.git
PROJECT=/sandbox/claude-oci-marketplace-poc
# Prevent terminal-wide OpenCode XDG settings from hiding Podman/OpenShell state.
unset XDG_CONFIG_HOME XDG_DATA_HOME
need() { command -v "$1" >/dev/null || { echo "Missing command: $1" >&2; exit 1; }; }
remote() { openshell sandbox exec -n "$SANDBOX_NAME" -- "$@"; }
secret() {
  local label="$1"
  IFS= read -r -s -p "$label: " agent_secret </dev/tty
  printf '\n' >/dev/tty
  [ -n "$agent_secret" ] || { echo 'Empty credential' >&2; exit 1; }
}
case "${1:-help}" in
  install)
    [ "$(uname -s)" = Darwin ] || { echo 'This installer workflow targets macOS.' >&2; exit 1; }
    need brew; need curl
    installer=$(mktemp)
    trap 'rm -f "$installer"' EXIT
    curl -LsSf https://raw.githubusercontent.com/NVIDIA/OpenShell/main/install.sh -o "$installer"
    sh "$installer"
    ;;
  build)
    need podman; podman info >/dev/null
    podman build --build-arg "CODEX_VERSION=$CODEX_VERSION" \
      --build-arg "CLAUDE_VERSION=$CLAUDE_VERSION" --build-arg "SKILLCTL_VERSION=$SKILLCTL_VERSION" \
      -t "$IMAGE" "$BASE_DIR"
    ;;
  gateway)
    need openshell; need podman; need brew
    podman info >/dev/null
    config="$HOME/.config/openshell/gateway.toml"
    if [ ! -e "$config" ]; then
      mkdir -p "$(dirname "$config")"
      printf '[openshell]\nversion = 2\n\n[openshell.gateway]\ncompute_driver = "podman"\n' > "$config"
    else
      echo "Preserving $config; ensure it selects the podman compute driver."
    fi
    brew services restart openshell
    openshell gateway remove openshell
    openshell gateway add https://localhost:17670 --local --name openshell
    openshell gateway select openshell
    ready=false
    for attempt in $(seq 1 30); do
      if openshell status >/dev/null 2>&1; then ready=true; break; fi
      sleep 1
    done
    [ "$ready" = true ] || { echo 'Gateway not reachable after 30 seconds.' >&2; exit 1; }
    openshell status
    ;;
  create)
    echo 'Keep this shell open. Run clone/auth/run from a second Mac terminal.'
    openshell sandbox delete "$SANDBOX_NAME" || true
    openshell sandbox create --name "$SANDBOX_NAME" --from "$IMAGE" \
      --policy "$BASE_DIR/policy.yaml" -- /bin/bash -l
    ;;
  clone)
    remote /bin/bash -c 'if [ -e "$1" ]; then echo "Destination exists; leaving it unchanged: $1"; git -C "$1" status --short; else git clone "$2" "$1"; fi' bash "$PROJECT" "$REPO_URL"
    ;;
  openai-auth)
    secret 'OpenAI API key'
    printf '%s\n' "$agent_secret" | remote codex login --with-api-key
    unset agent_secret
    remote codex login status
    ;;
  github-auth)
    secret 'GitHub fine-grained PAT'
    printf '%s\n' "$agent_secret" | remote /bin/bash -c 'umask 077; mkdir -p /sandbox/.config; cat > /sandbox/.config/github-token; chmod 600 /sandbox/.config/github-token'
    unset agent_secret
    remote /bin/bash -c 'export GH_TOKEN="$(cat /sandbox/.config/github-token)"; gh api user --jq .login; gh api repos/dmartinol/claude-oci-marketplace-poc --jq .full_name'
    # Keep credentials scoped to github.com. The helper passes protocol stdin to gh.
    remote /bin/bash -c 'git config --global credential.https://github.com.helper '\''!f() { GH_TOKEN="$(cat /sandbox/.config/github-token)" /usr/bin/gh auth git-credential "$@"; }; f'\'''
    ;;
  claude-auth)
    need python3
    vertex_project="${ANTHROPIC_VERTEX_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}"
    IFS= read -r -p "Vertex project ID [${vertex_project:-required}]: " entered_project </dev/tty
    vertex_project="${entered_project:-$vertex_project}"
    [ -n "$vertex_project" ] || { echo 'Project ID required' >&2; exit 1; }
    # ADC is copied only after checking its type; no credential contents are printed.
    python3 "$BASE_DIR/vertex-config.py" "$vertex_project" | remote python3 -c '
import json,os,sys,shlex
from pathlib import Path
value=json.load(sys.stdin)
os.umask(0o077)
root=Path("/sandbox/.config/vertex"); root.mkdir(parents=True,exist_ok=True); root.chmod(0o700)
credential=root/"application_default_credentials.json"
credential.write_text(json.dumps(value["adc"])+"\n"); credential.chmod(0o600)
env=root/"env.sh"
settings=value["env"]
settings["GOOGLE_APPLICATION_CREDENTIALS"]=str(credential)
env.write_text("unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN\n"+"".join("export "+key+"="+shlex.quote(val)+"\n" for key,val in settings.items()))
env.chmod(0o600)
print("Vertex configuration and ADC saved; restart Codex to inherit them.")
'
    unset vertex_project entered_project
    ;;
  quay-auth)
    IFS= read -r -p 'Quay username (or robot username): ' quay_username </dev/tty
    [ -n "$quay_username" ] || { echo 'Empty username' >&2; exit 1; }
    secret 'Quay password or robot token'
    printf '%s\n%s\n' "$quay_username" "$agent_secret" | remote python3 -c '
import base64,json,os,sys
from pathlib import Path
username=sys.stdin.readline().rstrip("\n")
password=sys.stdin.readline().rstrip("\n")
if not username or not password: raise SystemExit("Empty registry credential")
os.umask(0o077)
auth=base64.b64encode((username+":"+password).encode()).decode()
for name in ("/sandbox/.docker/config.json", "/sandbox/.config/containers/auth.json"):
    p=Path(name); p.parent.mkdir(parents=True,exist_ok=True)
    value=json.loads(p.read_text()) if p.exists() else {}
    value.setdefault("auths", {})["quay.io"]={"auth":auth}
    p.write_text(json.dumps(value)+"\n"); p.chmod(0o600)
'
    unset agent_secret quay_username
    remote skillctl inspect quay.io/dmartino/claude-oci-demo:0.1.1-draft
    ;;
  rehearsal-init)
    remote mkdir -p /sandbox/rehearsal
    openshell sandbox upload "$SANDBOX_NAME" "$BASE_DIR/rehearsal.py" /sandbox/rehearsal/rehearsal.py --no-git-ignore
    remote python3 /sandbox/rehearsal/rehearsal.py init
    remote /bin/bash -c 'set -eu; export CLAUDE_CONFIG_DIR=/sandbox/rehearsal/claude-config; cd /sandbox/claude-oci-marketplace-poc; claude plugin validate --strict .; claude plugin validate --strict ./plugins/oci-marketplace; claude plugin marketplace add https://github.com/dmartinol/claude-oci-marketplace-poc.git --scope user; claude plugin install oci-marketplace@claude-oci-marketplace --scope user; claude plugin marketplace add /sandbox/rehearsal/catalogs/claude-oci-demo-rehearsal --scope user; claude plugin marketplace add /sandbox/rehearsal/catalogs/claude-oci-guide-rehearsal --scope user; claude plugin marketplace list --json'
    ;;
  rehearsal-v2)
    remote python3 /sandbox/rehearsal/rehearsal.py v2
    ;;
  claude)
    openshell sandbox exec -n "$SANDBOX_NAME" --tty --workdir "$PROJECT" -- \
      /bin/bash -c 'export CLAUDE_CONFIG_DIR=/sandbox/rehearsal/claude-config REHEARSAL_DIR=/sandbox/rehearsal/catalogs; if [ -s /sandbox/.config/anthropic-key ]; then export ANTHROPIC_API_KEY="$(cat /sandbox/.config/anthropic-key)"; fi; exec claude'
    ;;
  project-check)
    remote claude --version
    remote skillctl --version
    remote claude plugin test --help
    remote python3 --version
    remote skillctl inspect quay.io/dmartino/claude-oci-demo:0.1.1-draft
    remote skillctl inspect quay.io/dmartino/claude-oci-demo:claude-oci-guide-0.1.0-draft
    ;;
  identity)
    [ "$#" -eq 3 ] || { echo 'Usage: agent.sh identity "Full Name" "commit-email"' >&2; exit 1; }
    remote git config --global user.name "$2"
    remote git config --global user.email "$3"
    ;;
  run)
    # Load fine-grained PAT for all gh subprocesses launched by Codex.
    openshell sandbox exec -n "$SANDBOX_NAME" --tty --workdir "$PROJECT" -- \
      /bin/bash -c 'if [ -s /sandbox/.config/github-token ]; then export GH_TOKEN="$(cat /sandbox/.config/github-token)"; fi; if [ -s /sandbox/.config/anthropic-key ]; then export ANTHROPIC_API_KEY="$(cat /sandbox/.config/anthropic-key)"; fi; export CLAUDE_CONFIG_DIR=/sandbox/rehearsal/claude-config REHEARSAL_DIR=/sandbox/rehearsal/catalogs; exec codex --yolo'
    ;;
  verify)
    remote codex --version
    remote codex login status
    remote git -C "$PROJECT" status --short --branch
    remote /bin/bash -c 'export GH_TOKEN="$(cat /sandbox/.config/github-token)"; gh api user --jq .login'
    ;;
  policy)
    echo 'Replacing the base policy with the bundled file; save local policy customizations first.'
    openshell policy set "$SANDBOX_NAME" --policy "$BASE_DIR/policy.yaml" --wait
    ;;
  logs) openshell logs "$SANDBOX_NAME" ;;
  status) openshell sandbox get "$SANDBOX_NAME" ;;
  help|--help|-h)
    printf '%s\n' 'Usage: bash agent.sh COMMAND' \
      'Commands: install build gateway create clone openai-auth github-auth identity run verify policy logs status claude-auth quay-auth rehearsal-init rehearsal-v2 claude project-check' \
      'Defaults: SANDBOX_NAME=codex-sandbox CODEX_VERSION=0.162.1' \
      'create stays attached to Bash. Use another terminal for the remaining commands.'
    ;;
  *) echo "Unknown command: $1" >&2; exit 1 ;;
esac
