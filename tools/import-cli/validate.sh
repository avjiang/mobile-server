#!/bin/bash
# Validate CLI wrapper script
# Usage: ./validate.sh --file=data.xlsx

cd "$(dirname "$0")"
node index.js validate "$@"
