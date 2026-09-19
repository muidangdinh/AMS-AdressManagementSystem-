import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { getHousePhotosDir } from '../config/upload.config';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const housePhotoMulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      const dir = getHousePhotosDir();
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${path.extname(file.originalname)}`);
    },
  }),
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new BadRequestException('Chỉ chấp nhận file ảnh'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
};
