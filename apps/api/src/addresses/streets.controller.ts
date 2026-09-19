import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { StreetsService } from './streets.service';
import { CreateStreetDto } from './dto/create-street.dto';
import { UpdateStreetDto } from './dto/update-street.dto';
import { ListStreetsQueryDto } from './dto/list-streets-query.dto';

/** Danh mục đường/phố (Phase 6 — IV). Đọc mở cho mọi vai trò, ghi chỉ ADMIN. */
@Controller('streets')
export class StreetsController {
  constructor(private readonly streetsService: StreetsService) {}

  @Get()
  findAll(@Query() query: ListStreetsQueryDto) {
    return this.streetsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.streetsService.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateStreetDto) {
    return this.streetsService.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStreetDto) {
    return this.streetsService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.streetsService.remove(id);
  }
}
