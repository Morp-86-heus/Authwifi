import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';
import { OmadaClient } from './omada.client';
import { CrmModule } from '../crm/crm.module';

@Module({
  imports: [HttpModule, CrmModule],
  controllers: [PortalController],
  providers: [PortalService, OmadaClient],
})
export class PortalModule {}
