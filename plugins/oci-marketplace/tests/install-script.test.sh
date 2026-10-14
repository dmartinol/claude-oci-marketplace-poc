#!/bin/sh
set -eu

plugin_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
installer="$plugin_root/hooks/install.sh"
work=$(mktemp -d /tmp/oci-marketplace-install-test.XXXXXX)
trap 'rm -rf "$work"' EXIT HUP INT TERM
mkdir -p "$work/bin"

cat > "$work/bin/skillctl" <<'STUB'
#!/bin/sh
set -eu
[ "$1" = pull ]
repository=$2
shift 2
[ "$1" = -o ]
stage=$2
if [ "${TEST_MODE:-}" = fail-fetch ]; then
  echo 'simulated fetch failure' >&2
  exit 9
fi
mkdir -p "$stage/$TEST_SKILL"
printf '%s\n' '---' "name: $TEST_SKILL" 'description: temporary fixture' '---' "# $TEST_CONTENT" > "$stage/$TEST_SKILL/SKILL.md"
if [ "${TEST_MODE:-}" != missing-card ]; then
  printf '%s\n' 'apiVersion: skillimage.io/v1alpha1' > "$stage/$TEST_SKILL/skill.yaml"
fi
digest=${TEST_PULL_DIGEST:-$TEST_DIGEST}
printf 'Pulled %s\nDigest: %s\n' "$repository" "$digest"
STUB
chmod +x "$work/bin/skillctl"

cat > "$work/bin/mv" <<'STUB'
#!/bin/sh
set -eu
if [ "${TEST_MODE:-}" = fail-activate ] && [ "${1:-}" = "$TEST_STAGE_ROOT/$TEST_SKILL" ]; then
  echo 'simulated activation failure' >&2
  exit 7
fi
exec /bin/mv "$@"
STUB
chmod +x "$work/bin/mv"

digest="sha256:$(printf 'a%.0s' $(seq 1 64))"
export PATH="$work/bin:$PATH"
export TEST_SKILL=demo-skill TEST_DIGEST="$digest" TEST_CONTENT=v2

stage="$work/new-stage"
target="$work/skills/demo@marketplace"
backup="$work/skills/.backup"
TEST_MODE=ok TEST_STAGE_ROOT="$stage" "$installer" quay.io/example/demo:2.0.0 "$digest" "$TEST_SKILL" "$stage" "$target" "$backup" > "$work/new-install.out"
grep -q '# v2' "$target/SKILL.md"
[ ! -e "$stage" ]

for mode in fail-fetch missing-card mismatch fail-activate; do
  target="$work/skills/demo@marketplace"
  stage="$work/stage-$mode"
  backup="$work/skills/.backup-$mode"
  printf '%s\n' '---' 'name: demo-skill' 'description: installed v1' '---' '# v1' > "$target/SKILL.md"
  printf '%s\n' 'previous SkillCard' > "$target/skill.yaml"
  if [ "$mode" = mismatch ]; then
    if TEST_MODE=ok TEST_STAGE_ROOT="$stage" TEST_PULL_DIGEST="sha256:$(printf 'b%.0s' $(seq 1 64))" "$installer" quay.io/example/demo:2.0.0 "$digest" "$TEST_SKILL" "$stage" "$target" "$backup" > "$work/$mode.out" 2>&1; then
      echo 'digest mismatch unexpectedly succeeded' >&2
      exit 1
    fi
  elif TEST_MODE="$mode" TEST_STAGE_ROOT="$stage" "$installer" quay.io/example/demo:2.0.0 "$digest" "$TEST_SKILL" "$stage" "$target" "$backup" > "$work/$mode.out" 2>&1; then
    echo "$mode unexpectedly succeeded" >&2
    exit 1
  fi
  grep -q '# v1' "$target/SKILL.md"
  grep -q 'previous SkillCard' "$target/skill.yaml"
  [ ! -e "$stage" ]
  [ ! -e "$backup" ]
done

echo 'PASS: install activates a valid artifact; fetch, digest, validation, and activation failures preserve the prior installation.'
