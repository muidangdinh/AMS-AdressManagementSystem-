import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '../auth/decorators/public.decorator';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** GET /health — kiểm tra API + DB + PostGIS */
  @Get()
  check() {
    return this.healthService.check();
  }
}
