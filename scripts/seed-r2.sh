#!/usr/bin/env bash
set -euo pipefail
BUCKET="furkancicekli-media"

put() {
  local file="$1" key="$2"
  echo "→ $key"
  npx wrangler r2 object put "$BUCKET/$key" --file "$file" --remote
}

# Gallery
for f in public/images/gallery/*.jpg; do
  [ -e "$f" ] || continue
  put "$f" "gallery/$(basename "$f")"
done

# About
for f in public/images/about/*.jpeg; do
  [ -e "$f" ] || continue
  put "$f" "about/$(basename "$f")"
done

# Hero
for f in public/images/hero/*.jpeg; do
  [ -e "$f" ] || continue
  put "$f" "hero/$(basename "$f")"
done

# Misc (profile + example)
for f in public/images/pp1.jpeg public/images/pp2.jpeg public/images/example.jpeg; do
  [ -e "$f" ] || continue
  put "$f" "misc/$(basename "$f")"
done

echo "Seed complete."
