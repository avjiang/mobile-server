#!/bin/bash
# Import CLI wrapper script
# Usage: ./import.sh --file=data.xlsx --tenant-id=123

cd "$(dirname "$0")"
node index.js import --direct "$@"
