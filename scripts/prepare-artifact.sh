#!/usr/bin/env bash
set -euo pipefail

# Prepare a minimal deployable directory in ./dist for Next.js standalone output
# Requires: next.config.js with `output: 'standalone'` and a successful `npm run build`

ROOT_DIR=$(pwd)
BUILD_DIR="$ROOT_DIR/.next"
DIST_DIR="$ROOT_DIR/dist"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR/.next"

# Copy the standalone server and minimal node_modules into dist/
cp -R "$BUILD_DIR/standalone/"* "$DIST_DIR/"

# Ensure .next/static resides alongside the server bundle
mkdir -p "$DIST_DIR/.next"
cp -R "$BUILD_DIR/static" "$DIST_DIR/.next/static"

# Copy BUILD_ID so Next.js can verify a production build exists
if [ -f "$BUILD_DIR/BUILD_ID" ]; then
  cp "$BUILD_DIR/BUILD_ID" "$DIST_DIR/.next/BUILD_ID"
fi

# Copy required Next.js manifests from the build output into runtime .next
# This avoids runtime ENOENT for routes/build/prerender manifests when using standalone
for f in \
  "routes-manifest.json" \
  "build-manifest.json" \
  "prerender-manifest.json" \
  "app-build-manifest.json" \
  "images-manifest.json" \
  "middleware-manifest.json" \
  "app-path-routes-manifest.json"
do
  if [ -f "$BUILD_DIR/$f" ]; then
    cp "$BUILD_DIR/$f" "$DIST_DIR/.next/$f"
  fi
done

# Copy public assets if present (e.g., non-critical CSS, images)
if [ -d "$ROOT_DIR/public" ]; then
  cp -R "$ROOT_DIR/public" "$DIST_DIR/public"
fi

# Also include required server-side manifests under .next/server to avoid ENOENT
mkdir -p "$DIST_DIR/.next/server" "$DIST_DIR/.next/server/chunks"
shopt -s nullglob
for f in "$BUILD_DIR/server"/*.json; do
  cp "$f" "$DIST_DIR/.next/server/" || true
done
for f in "$BUILD_DIR/server/chunks"/*.json; do
  cp "$f" "$DIST_DIR/.next/server/chunks/" || true
done
shopt -u nullglob

# Include environment files if present
shopt -s nullglob
for envfile in "$ROOT_DIR"/.env*; do
  # Only copy regular files (skip directories)
  if [ -f "$envfile" ]; then
    cp "$envfile" "$DIST_DIR/" || true
  fi
done
shopt -u nullglob

echo "Prepared deployable artifact in $DIST_DIR"
