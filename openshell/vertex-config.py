#!/usr/bin/env python3
"""Validate host ADC for Claude Code on Google Cloud Vertex AI."""
from __future__ import annotations

import json
import re
import shlex
import sys
from pathlib import Path


PROJECT_ID = re.compile(r"^[a-z][a-z0-9-]{4,28}[a-z0-9]$")
REGION = re.compile(r"^(?:global|[a-z][a-z0-9]*(?:-[a-z0-9]+)*)$")


def validate_project_region(project_id: str, region: str) -> None:
    if not isinstance(project_id, str) or not PROJECT_ID.fullmatch(project_id):
        raise ValueError("Invalid Google Cloud project ID; expected a 6–30 character project ID.")
    if not isinstance(region, str) or not REGION.fullmatch(region):
        raise ValueError("Invalid Vertex AI region/location.")


def load_settings(project_id: str, region: str, adc_path: Path) -> dict[str, str]:
    validate_project_region(project_id, region)
    try:
        adc = json.loads(adc_path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError("Application Default Credentials file was not found.") from exc
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError("Application Default Credentials file is unreadable or invalid JSON.") from exc

    if not isinstance(adc, dict):
        raise ValueError("Application Default Credentials must be a JSON object.")
    if adc.get("type") != "authorized_user":
        raise ValueError(
            "Unsupported ADC type. Run 'gcloud auth application-default login' "
            "to create user ADC; service-account keys and external credential files are not copied."
        )
    if not all(
        isinstance(adc.get(field), str) and adc[field]
        for field in ("client_id", "client_secret", "refresh_token")
    ):
        raise ValueError("User ADC is missing required fields; rerun 'gcloud auth application-default login'.")
    return {"project_id": project_id, "region": region}


def install_settings(settings: dict[str, str], root: Path) -> None:
    if not isinstance(settings, dict):
        raise ValueError("Vertex settings must be a JSON object.")
    project_id = settings.get("project_id", "")
    region = settings.get("region", "")
    validate_project_region(project_id, region)
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    root.chmod(0o700)

    credential = root / "application_default_credentials.json"
    values = {
        "CLAUDE_CODE_USE_VERTEX": "1",
        "CLOUD_ML_REGION": region,
        "ANTHROPIC_VERTEX_PROJECT_ID": project_id,
        "GOOGLE_APPLICATION_CREDENTIALS": str(credential),
    }
    env_file = root / "env.sh"
    exports = "".join(f"export {key}={shlex.quote(value)}\n" for key, value in values.items())
    env_file.write_text(
        "unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN ANTHROPIC_BASE_URL ANTHROPIC_VERTEX_BASE_URL\n" + exports,
        encoding="utf-8",
    )
    env_file.chmod(0o600)

    wrapper_dir = root / "bin"
    wrapper_dir.mkdir(exist_ok=True, mode=0o700)
    wrapper_dir.chmod(0o700)
    wrapper = wrapper_dir / "claude"
    wrapper.write_text(
        "#!/bin/bash\nset -euo pipefail\n"
        f". {shlex.quote(str(env_file))}\n"
        'exec /usr/local/bin/claude "$@"\n',
        encoding="utf-8",
    )
    wrapper.chmod(0o700)


def main(argv: list[str]) -> int:
    try:
        if len(argv) == 4 and argv[1] != "install":
            result = load_settings(argv[1], argv[2], Path(argv[3]))
            # Emit only non-secret settings. ADC JSON is uploaded separately by agent.sh.
            print(json.dumps(result))
            return 0
        if len(argv) == 3 and argv[1] == "install":
            value = json.load(sys.stdin)
            install_settings(value, Path(argv[2]))
            print("Vertex settings and Claude launcher installed with restrictive permissions.")
            return 0
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print("Usage: vertex-config.py PROJECT_ID REGION ADC_FILE | install CONFIG_DIR", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
