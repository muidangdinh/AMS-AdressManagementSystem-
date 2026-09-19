import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const SALT_ROUNDS = 10;

/** Không bao giờ trả passwordHash ra ngoài API. */
function toSafeUser(user: User) {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
    return users.map(toSafeUser);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return toSafeUser(user);
  }

  async create(dto: CreateUserDto) {
    const existed = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (existed) throw new ConflictException('Tên đăng nhập đã tồn tại');

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
        unit: dto.unit,
        position: dto.position,
      },
    });
    return toSafeUser(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id); // ném NotFoundException nếu không tồn tại

    const data: Record<string, unknown> = {
      fullName: dto.fullName,
      role: dto.role,
      unit: dto.unit,
      position: dto.position,
      isActive: dto.isActive,
    };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    }

    const user = await this.prisma.user.update({ where: { id }, data });
    return toSafeUser(user);
  }

  /** Vô hiệu hóa tài khoản thay vì xóa cứng — giữ toàn vẹn liên kết audit_log. */
  async deactivate(id: string) {
    await this.findOne(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    return toSafeUser(user);
  }
}
