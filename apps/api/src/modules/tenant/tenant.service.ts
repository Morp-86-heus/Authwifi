import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTenantDto) {
    return this.prisma.tenant.create({ data: dto });
  }

  async findAll() {
    return this.prisma.tenant.findMany({ where: { deletedAt: null } });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { sites: true },
    });
    if (!tenant) throw new NotFoundException(`Tenant ${id} non trovato`);
    return tenant;
  }
}
