import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('stats')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('stats')
export class StatsController {
  constructor(private prisma: PrismaService) {}

  @Get(':siteId')
  async getSiteStats(@Param('siteId') siteId: string, @Request() req: any) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    const [
      totalGuests,
      newGuestsThisWeek,
      connectionsToday,
      recentGuests,
    ] = await Promise.all([
      this.prisma.guest.count({
        where: { tenantId: req.user.tenantId },
      }),
      this.prisma.guest.count({
        where: {
          tenantId: req.user.tenantId,
          createdAt: { gte: startOfWeek },
        },
      }),
      this.prisma.wifiSession.count({
        where: {
          siteId,
          startedAt: { gte: startOfDay },
        },
      }),
      this.prisma.guest.findMany({
        where: { tenantId: req.user.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          sessions: {
            orderBy: { startedAt: 'desc' },
            take: 1,
            select: { startedAt: true },
          },
        },
      }),
    ]);

    return {
      totalGuests,
      newGuestsThisWeek,
      connectionsToday,
      recentGuests,
    };
  }
}
