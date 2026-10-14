#!/bin/sh
set -eu

if [ "$#" -ne 6 ]; then
  echo 'usage: install.sh repository digest skill-name stage-root target backup' >&2
  exit 64
fi

repository=$1
expected_digest=$2
skill_name=$3
stage_root=$4
target=$5
backup=$6
staged="$stage_root/$skill_name"
had_backup=0

finish() {
  result=$?
  trap - EXIT HUP INT TERM
  if [ "$result" -ne 0 ] && [ "$had_backup" -eq 1 ] && [ ! -e "$target" ] && [ -e "$backup" ]; then
    mv "$backup" "$target" || true
  fi
  rm -rf "$stage_root" || true
  exit "$result"
}
trap finish EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

mkdir -p "$stage_root" "$(dirname "$target")"
pull_output=$(skillctl pull "$repository" -o "$stage_root")
printf '%s\n' "$pull_output"
pulled_digest=$(printf '%s\n' "$pull_output" | sed -n 's/^Digest:[[:space:]]*//p' | head -n 1)
if [ "$pulled_digest" != "$expected_digest" ]; then
  echo 'Resolved digest changed during retrieval; the prior installation was preserved.' >&2
  exit 1
fi

if [ ! -f "$staged/SKILL.md" ] || [ -L "$staged/SKILL.md" ]; then
  echo 'Artifact is missing a regular SKILL.md file.' >&2
  exit 1
fi
if [ ! -f "$staged/skill.yaml" ] || [ -L "$staged/skill.yaml" ]; then
  echo 'Artifact is missing a regular skill.yaml file.' >&2
  exit 1
fi
awk -v expected="$skill_name" '
  NR == 1 { if ($0 != "---") exit 1; next }
  $0 == "---" { exit }
  /^name:[[:space:]]*/ { value = $0; sub(/^name:[[:space:]]*/, "", value); if (value == expected) found = 1 }
  END { exit !found }
' "$staged/SKILL.md"

if [ -e "$target" ]; then
  mv "$target" "$backup"
  had_backup=1
fi
mv "$staged" "$target"
if [ "$had_backup" -eq 1 ]; then
  rm -rf "$backup" || true
  had_backup=0
fi
echo "Activated skill at $target"
