import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { SiteController } from './site.controller';
import { StatsController } from './stats.controller';
import { UploadController } from './upload.controller';

@Module({
  providers: [TenantService],
  controllers: [TenantController, SiteController, StatsController, UploadController],
  exports: [TenantService],
})
export class TenantModule {}
