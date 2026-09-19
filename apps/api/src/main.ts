import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as fs from 'fs';
import { AppModule } from './app.module';
import { getUploadRoot } from './config/upload.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Tiền tố chung cho toàn bộ API: /api/...
  app.setGlobalPrefix('api');

  // Phục vụ ảnh đã upload (ảnh mặt tiền/hiện trạng số nhà) như static file,
  // tách biệt khỏi /api — không đi qua JwtAuthGuard vì Express static
  // middleware không chạy qua Nest guard. Đây là lựa chọn có chủ đích cho
  // MVP: ảnh mặt tiền nhà tương tự ảnh công khai kiểu Google Street View,
  // không chứa PII nhạy cảm như CCCD. Metadata (chủ sở hữu, SĐT...) vẫn
  // luôn yêu cầu JWT qua endpoint /api/houses/:id.
  const uploadRoot = getUploadRoot();
  fs.mkdirSync(uploadRoot, { recursive: true });
  app.useStaticAssets(uploadRoot, { prefix: '/uploads/' });

  // CORS mở toàn bộ (mọi origin) — dùng `origin: true` thay vì '*' vì
  // credentials:true không tương thích với wildcard theo spec CORS
  // (browser sẽ từ chối); `true` phản chiếu lại Origin của request,
  // cho phép mọi nguồn gọi tới trong khi vẫn giữ credentials hoạt động.
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Validation toàn cục (dùng nhiều ở các phase sau)
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');

  logger.log(`API đang chạy tại http://localhost:${port}/api`);
  logger.log(`Health check:        http://localhost:${port}/api/health`);
  logger.log(`CORS cho phép:       tất cả (mọi origin)`);
}

bootstrap();
