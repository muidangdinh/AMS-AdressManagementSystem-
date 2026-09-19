import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { getPlatePhotosDir } from '../config/upload.config';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/** Mirror `houses/multer.config.ts` — ảnh hiện trường sau khi gắn biển số. */
export const platePhotoMulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      const dir = getPlatePhotosDir();
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${path.extname(file.originalname)}`);
    },
  }),
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (error: Error | null, accept: boolean) => void,
  ) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new BadRequestException('Chỉ chấp nhận file ảnh'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
};
