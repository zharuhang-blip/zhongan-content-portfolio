#!/usr/bin/env bash
# Compress portfolio videos for GitHub Pages: H.264 + AAC + faststart.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

compress_one() {
  local src="$1"
  local dst="$2"
  local max_h="${3:-1080}"
  local crf="${4:-28}"
  local maxrate="${5:-1800k}"
  local bufsize="${6:-3600k}"

  mkdir -p "$(dirname "$dst")"
  echo ">>> $src -> $dst"
  ffmpeg -y -i "$src" \
    -vf "scale=-2:min(${max_h}\,ih)" \
    -c:v libx264 -pix_fmt yuv420p -profile:v high -level 4.1 \
    -preset medium -crf "$crf" -maxrate "$maxrate" -bufsize "$bufsize" \
    -c:a aac -b:a 96k -ac 2 -ar 44100 \
    -movflags +faststart \
    "$dst"
  ls -lh "$src" "$dst"
}

# Vertical shorts / campaign: 720p-ish quality for web
compress_one "videos/ai-drama/ep01.mp4" "videos/ai-drama/ep01.web.mp4" 960 28 1600k 3200k
compress_one "videos/oder/campaign.mp4" "videos/oder/campaign.web.mp4" 720 28 1400k 2800k
compress_one "videos/理赔案例/上海淹水理赔案例.mp4" "videos/理赔案例/上海淹水理赔案例.web.mp4" 960 28 1600k 3200k
compress_one "videos/儿童安全出行/六一安全出行.mov" "videos/儿童安全出行/六一安全出行.web.mp4" 960 28 1400k 2800k
compress_one "videos/车小圈AI魔法课/车小圈讲AI第二集.mov" "videos/车小圈AI魔法课/车小圈讲AI第二集.web.mp4" 960 28 1600k 3200k
compress_one "videos/车小圈AI魔法课/车小圈讲AI第三集.mov" "videos/车小圈AI魔法课/车小圈讲AI第三集.web.mp4" 960 28 1600k 3200k
compress_one "videos/众安世界杯/足球小将众安.mp4" "videos/众安世界杯/足球小将众安.web.mp4" 960 28 1400k 2800k
compress_one "videos/众安世界杯/花式停球.mov" "videos/众安世界杯/花式停球.web.mp4" 960 28 1400k 2800k
compress_one "videos/大灾天气/雷电天气.mov" "videos/大灾天气/雷电天气.web.mp4" 960 28 1400k 2800k
compress_one "videos/险种小课堂/车险小课堂.mp4" "videos/险种小课堂/车险小课堂.web.mp4" 960 28 1400k 2800k
# Long documentary: keep lower res, stronger compress
compress_one "videos/personal/fengkou.mp4" "videos/personal/fengkou.web.mp4" 480 30 600k 1200k
# Festival already small — still remux/reencode for faststart consistency
compress_one "videos/24节气节日/小暑.mp4" "videos/24节气节日/小暑.web.mp4" 960 28 1200k 2400k

echo "DONE"
