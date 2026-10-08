#!/usr/bin/env bash
# Server tự cập nhật: kéo code cấu hình + image mới từ GHCR rồi khởi động lại
# phần nào thay đổi. Không cần mở SSH cho GitHub Actions.
#
# Chạy tay:   ./scripts/deploy-pull.sh
# Chạy tự động mỗi phút (crontab -e):
#   * * * * * flock -n /tmp/deploy-pull.lock /home/ubuntu/quanlynoibo/scripts/deploy-pull.sh >> /home/ubuntu/deploy.log 2>&1
#
# Chỉ ghi log khi có thay đổi hoặc có lỗi, nên file log không phình to.
# Đang chạy mà lỗi thì container hiện tại giữ nguyên, không bị dừng.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

ts() { date '+%F %T'; }

image_ids() {
  docker compose config --images | sort -u | grep '^ghcr.io/' | while read -r img; do
    docker image inspect --format '{{.Id}}' "$img" 2>/dev/null || echo none
  done
}

OLD_HEAD="$(git rev-parse HEAD)"
git fetch -q origin
git merge -q --ff-only '@{u}'
NEW_HEAD="$(git rev-parse HEAD)"

OLD_IMAGES="$(image_ids)"
docker compose pull -q backend frontend
NEW_IMAGES="$(image_ids)"

CODE_CHANGED=false
[ "$OLD_HEAD" != "$NEW_HEAD" ] && CODE_CHANGED=true
IMAGES_CHANGED=false
[ "$OLD_IMAGES" != "$NEW_IMAGES" ] && IMAGES_CHANGED=true

if [ "$CODE_CHANGED" = false ] && [ "$IMAGES_CHANGED" = false ]; then
  exit 0
fi

echo "$(ts) cập nhật: code ${OLD_HEAD:0:7} -> ${NEW_HEAD:0:7}, image đổi: $IMAGES_CHANGED"

docker compose up -d --remove-orphans

# Nginx chỉ nạp lại cấu hình khi container được tạo lại
if [ "$CODE_CHANGED" = true ] && git diff --name-only "$OLD_HEAD" "$NEW_HEAD" | grep -q '^nginx/'; then
  echo "$(ts) cấu hình nginx đổi, tạo lại nginx"
  docker compose up -d --force-recreate nginx
fi

docker image prune -f >/dev/null
echo "$(ts) xong"
docker compose ps --format 'table {{.Service}}\t{{.Status}}'
