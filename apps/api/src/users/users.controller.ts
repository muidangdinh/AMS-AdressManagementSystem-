import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/** Toàn bộ quản lý người dùng yêu cầu quyền user:manage (X. Quản trị hệ thống). */
@Controller('users')
@RequirePermissions(PERMISSIONS.USER_MANAGE)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.update(id, dto, actor.id);
  }

  @Delete(':id')
  deactivate(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.deactivate(id, actor.id);
  }
}
