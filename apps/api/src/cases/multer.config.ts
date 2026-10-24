import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { getCaseFilesDir } from '../config/upload.config';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/** Phần mở rộng được phép → MIME tương ứng. Chặn cả hai để tránh đổi đuôi file. */
const ALLOWED_TYPES: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
};

/** Tệp đính kèm hồ sơ hành chính — lưu tên uuid, không dùng tên gốc để tránh path traversal. */
export const caseAttachmentMulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      const dir = getCaseFilesDir();
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
    },
  }),
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (error: Error | null, accept: boolean) => void,
  ) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedMimes = ALLOWED_TYPES[ext];
    if (!allowedMimes || !allowedMimes.includes(file.mimetype)) {
      return cb(
        new BadRequestException('Chỉ chấp nhận PDF, Word, Excel hoặc ảnh JPG/PNG'),
        false,
      );
    }
    cb(null, true);
  },
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
};
