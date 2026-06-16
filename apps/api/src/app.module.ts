import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TenantModule } from './modules/tenant/tenant.module';
import { AuthModule } from './modules/auth/auth.module';
import { PortalModule } from './modules/portal/portal.module';
import { CrmModule } from './modules/crm/crm.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './common/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    TenantModule,
    AuthModule,
    PortalModule,
    CrmModule,
  ],
})
export class AppModule {}
