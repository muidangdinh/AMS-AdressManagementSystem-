import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { getBrandingDir } from '../config/upload.config';

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/webp': '.webp',
};

export const brandingLogoMulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      const dir = getBrandingDir();
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${EXTENSIONS[file.mimetype]}`);
    },
  }),
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (error: Error | null, accept: boolean) => void,
  ) => {
    if (!EXTENSIONS[file.mimetype]) {
      return cb(new BadRequestException('Chỉ chấp nhận logo PNG hoặc WebP'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
};
