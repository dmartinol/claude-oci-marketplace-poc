#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  printf 'Usage: %s <plugin-directory> <output-archive>\n' "$0" >&2
  exit 2
fi

plugin_dir=$1
archive_path=$2
manifest_path="$plugin_dir/.claude-plugin/plugin.json"

if [[ ! -f "$manifest_path" ]]; then
  printf 'Plugin manifest not found: %s\n' "$manifest_path" >&2
  exit 1
fi

python3 - "$manifest_path" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as manifest_file:
    manifest = json.load(manifest_file)

for field in ("name", "version"):
    if not isinstance(manifest.get(field), str) or not manifest[field].strip():
        raise SystemExit(f"Plugin manifest must have a non-empty {field!r}")
PY

mkdir -p "$(dirname "$archive_path")"
tar \
  --create \
  --gzip \
  --file "$archive_path" \
  --directory "$plugin_dir" \
  --sort=name \
  --mtime='@0' \
  --owner=0 \
  --group=0 \
  --numeric-owner \
  --pax-option=delete=atime,delete=ctime \
  .

printf 'Packaged %s -> %s\n' "$plugin_dir" "$archive_path"
