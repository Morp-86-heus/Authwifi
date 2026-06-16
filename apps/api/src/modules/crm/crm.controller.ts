import { Controller, Get, Param, Query, UseGuards, Request, NotFoundException, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FastifyReply } from 'fastify';
import { CrmService } from './crm.service';

@ApiTags('crm')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('crm/guests')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get()
  listGuests(
    @Request() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('search') search?: string,
  ) {
    return this.crmService.listGuests(req.user.tenantId, +page, +limit, search);
  }

  @Get('export')
  async exportCsv(@Request() req: any, @Res() reply: FastifyReply) {
    const csv = await this.crmService.exportGuestsCsv(req.user.tenantId);
    const date = new Date().toISOString().slice(0, 10);
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="ospiti-${date}.csv"`)
      .send('﻿' + csv); // BOM per Excel
  }

  @Get(':id')
  async getGuest(@Param('id') id: string, @Request() req: any) {
    const guest = await this.crmService.getGuest(id, req.user.tenantId);
    if (!guest) throw new NotFoundException('Ospite non trovato');
    return guest;
  }
}
