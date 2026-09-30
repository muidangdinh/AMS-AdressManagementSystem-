import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SetPermissionsDto } from './dto/set-permissions.dto';

/**
 * PHASE 17 — Quản trị vai trò động + gán quyền. Toàn bộ yêu cầu quyền role:manage.
 * Danh mục quyền (GET /permissions) là cố định trong code, chỉ để dựng UI ma trận.
 */
@Controller()
@RequirePermissions(PERMISSIONS.ROLE_MANAGE)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('permissions')
  listPermissions() {
    return this.rolesService.listPermissions();
  }

  @Get('roles')
  findAll() {
    return this.rolesService.findAll();
  }

  @Get('roles/:id')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Post('roles')
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Patch('roles/:id')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Delete('roles/:id')
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }

  @Put('roles/:id/permissions')
  setPermissions(@Param('id') id: string, @Body() dto: SetPermissionsDto) {
    return this.rolesService.setPermissions(id, dto);
  }
}
