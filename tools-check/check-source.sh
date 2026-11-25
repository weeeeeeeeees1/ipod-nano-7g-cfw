#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
git ls-files -z '*.mjs' | xargs -0 -r -n 1 node --check
git ls-files -z '*.py' | xargs -0 -r python3 -m py_compile
git ls-files -z '*.sh' | xargs -0 -r -n 1 bash -n
