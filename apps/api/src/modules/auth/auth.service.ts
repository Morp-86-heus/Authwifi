import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateManagerDto } from './dto/create-manager.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Login gestore (email + password).
   * TODO Fase 1: sostituire con Keycloak / hashing bcrypt.
   */
  async loginManager(email: string, password: string) {
    const manager = await this.prisma.manager.findUnique({ where: { email } });
    if (!manager || manager.passwordHash !== password) {
      throw new UnauthorizedException('Credenziali non valide');
    }

    const payload = {
      sub: manager.id,
      tenantId: manager.tenantId,
      role: 'manager',
    };
    return { accessToken: this.jwtService.sign(payload) };
  }

  async createManager(dto: CreateManagerDto) {
    return this.prisma.manager.create({
      data: {
        tenantId: dto.tenantId,
        email: dto.email,
        passwordHash: dto.password, // TODO Fase 1: bcrypt hash
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
      select: { id: true, email: true, tenantId: true, createdAt: true },
    });
  }
}
