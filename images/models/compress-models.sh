#!/bin/bash
# Optimize model card thumbnails. See compress-models.py for details.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
python3 "$DIR/compress-models.py"
