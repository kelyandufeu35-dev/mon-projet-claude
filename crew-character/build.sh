#!/bin/sh
# Construit les bundles (three.js + code) – nécessite `npm install` (three, esbuild)
set -e
cd "$(dirname "$0")"
ENTRY=${1:-video}
mkdir -p dist
./node_modules/.bin/esbuild src/demo/$ENTRY.js --bundle --minify --format=iife --outfile=dist/$ENTRY.js --log-level=warning
