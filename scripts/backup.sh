#!/usr/bin/env bash
# ============================================================
#  backup.sh — Sao lưu TRÊN HOST (không dùng cloud ngoài)
#  - Dump PostgreSQL (chạy trong container docker) ra file .sql.gz
#  - Đồng bộ thư mục uploads/ (ảnh, tài liệu) sang thư mục backup
#
#  Dùng thủ công:   bash scripts/backup.sh
#  Đặt cron hằng ngày lúc 2h sáng:
#     0 2 * * * cd /media/libra/data1/tayninh_GIS && bash scripts/backup.sh >> backups/backup.log 2>&1
# ============================================================
set -euo pipefail

# Nạp biến môi trường nếu có .env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"
[ -f .env ] && set -a && . ./.env && set +a

POSTGRES_USER="${POSTGRES_USER:-tayninh}"
POSTGRES_DB="${POSTGRES_DB:-tayninh_gis}"
CONTAINER="${POSTGRES_CONTAINER:-tayninh_postgres}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="./backups"
DB_BACKUP="$BACKUP_DIR/db_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
UPLOADS_BACKUP="$BACKUP_DIR/uploads_${TIMESTAMP}"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Bắt đầu sao lưu..."

# 1) Dump database từ container postgres
echo " -> Dump database '$POSTGRES_DB'..."
docker exec "$CONTAINER" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$DB_BACKUP"
echo "    Đã lưu: $DB_BACKUP"

# 2) Đồng bộ thư mục uploads (nếu có)
if [ -d ./uploads ]; then
  echo " -> Sao lưu thư mục uploads/..."
  rsync -a --delete ./uploads/ "$UPLOADS_BACKUP/"
  echo "    Đã lưu: $UPLOADS_BACKUP/"
fi

# 3) Xóa backup DB cũ hơn 14 ngày (giữ dung lượng host)
find "$BACKUP_DIR" -name 'db_*.sql.gz' -type f -mtime +14 -delete 2>/dev/null || true

echo "[$(date)] Sao lưu hoàn tất."
