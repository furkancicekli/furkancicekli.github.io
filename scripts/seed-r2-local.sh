#!/usr/bin/env bash
# Lokal Miniflare R2'yı repo'daki galeri görselleriyle doldurur.
# Üretim R2'ında bu görseller zaten var (scripts/seed-r2.sh ile yüklendi);
# lokal geliştirmede migration 0004'ün gallery_items seed'i bu anahtarları
# beklediği için temiz bir .wrangler/state sonrası bir kez çalıştırılmalı.
set -euo pipefail
cd "$(dirname "$0")/.."
for i in $(seq 1 20); do
  npx wrangler r2 object put "furkancicekli-media/gallery/craft-$i.jpg" \
    --file "public/images/gallery/craft-$i.jpg" --local --content-type image/jpeg >/dev/null
  echo "gallery/craft-$i.jpg"
done
echo "Lokal R2 galeri seed'i tamam."
