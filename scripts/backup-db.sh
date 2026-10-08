#!/usr/bin/env bash
# Sao lưu Postgres thành file .sql.gz, giữ 14 ngày.
# Chạy tay:   ./scripts/backup-db.sh
# Chạy tự động (3h sáng mỗi ngày): xem README ở cuối file này.
#
# Khôi phục (GHI ĐÈ dữ liệu hiện tại):
#   docker compose stop backend
#   gunzip -c ~/backups/quanlynoibo_YYYY-MM-DD_HHMM.sql.gz | \
#     docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
#   docker compose start backend
#
# Cron:  crontab -e  rồi thêm dòng
#   0 3 * * * /home/ubuntu/quanlynoibo/scripts/backup-db.sh >> /home/ubuntu/backups/backup.log 2>&1

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
cd "$REPO_DIR"

STAMP="$(date +%F_%H%M)"
OUT="$BACKUP_DIR/quanlynoibo_${STAMP}.sql.gz"
TMP="$OUT.tmp"

# Ghi ra file tạm rồi đổi tên, để backup dở không bị nhầm là file tốt.
# --clean --if-exists: file khôi phục tự xóa bảng cũ trước khi tạo lại.
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
  | gzip > "$TMP"

# Kiểm tra file gzip hợp lệ và không rỗng
gzip -t "$TMP"
if [ "$(stat -c %s "$TMP")" -lt 200 ]; then
  echo "$(date '+%F %T') LỖI: file backup quá nhỏ, bỏ qua" >&2
  rm -f "$TMP"
  exit 1
fi

mv "$TMP" "$OUT"
find "$BACKUP_DIR" -name 'quanlynoibo_*.sql.gz' -mtime +"$KEEP_DAYS" -delete

echo "$(date '+%F %T') OK $OUT ($(du -h "$OUT" | cut -f1))"
