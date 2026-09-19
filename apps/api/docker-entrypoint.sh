#!/bin/sh
set -e

# Áp migration còn thiếu trước khi khởi động API (an toàn để chạy lại nhiều lần —
# prisma migrate deploy chỉ áp các migration chưa chạy, không tạo migration mới).
npx prisma migrate deploy

exec node dist/main.js
