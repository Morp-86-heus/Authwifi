import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CrmService {
  constructor(private prisma: PrismaService) {}

  /**
   * Trova o crea un profilo ospite a partire da email o MAC address.
   * Logica di deduplica base: MAC ha precedenza → poi email.
   */
  async upsertGuest(params: {
    tenantId: string;
    mac: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    language?: string;
  }) {
    const { tenantId, mac, email, firstName, lastName, phone, language } = params;

    // 1. cerca per MAC
    let guest = await this.prisma.guest.findFirst({
      where: { tenantId, macAddress: mac },
    });

    // 2. se non trovato per MAC, cerca per email
    if (!guest && email) {
      guest = await this.prisma.guest.findFirst({
        where: { tenantId, email },
      });
      if (guest) {
        // aggiorna MAC (nuovo dispositivo stesso ospite)
        guest = await this.prisma.guest.update({
          where: { id: guest.id },
          data: { macAddress: mac },
        });
      }
    }

    // 3. crea se nuovo
    if (!guest) {
      guest = await this.prisma.guest.create({
        data: { tenantId, macAddress: mac, email, firstName, lastName, phone, language },
      });
    }

    return guest;
  }

  async listGuests(tenantId: string, page = 1, limit = 50, search?: string) {
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (search) {
      where.OR = [
        { email:     { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName:  { contains: search, mode: 'insensitive' } },
      ];
    }

    const [guests, total] = await Promise.all([
      this.prisma.guest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { sessions: true } },
          sessions: {
            orderBy: { startedAt: 'desc' },
            take: 1,
            select: { startedAt: true, ssidName: true },
          },
        },
      }),
      this.prisma.guest.count({ where }),
    ]);

    const rows = guests.map((g) => ({
      id:         g.id,
      email:      g.email,
      firstName:  g.firstName,
      lastName:   g.lastName,
      phone:      g.phone,
      language:   g.language,
      country:    g.country,
      createdAt:  g.createdAt,
      sessions:   g._count.sessions,
      lastVisit:  g.sessions[0]?.startedAt ?? null,
      lastSsid:   g.sessions[0]?.ssidName ?? null,
    }));

    return { guests: rows, total, page, limit };
  }

  async exportGuestsCsv(tenantId: string): Promise<string> {
    const guests = await this.prisma.guest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { sessions: true } },
        consents: { where: { granted: true }, select: { type: true } },
      },
    });

    const header = [
      'ID', 'Email', 'Nome', 'Cognome', 'Telefono',
      'Lingua', 'Paese', 'MAC Address',
      'Sessioni', 'Consensi', 'Registrato',
    ];

    const rows = guests.map((g) => [
      g.id,
      g.email ?? '',
      g.firstName ?? '',
      g.lastName ?? '',
      g.phone ?? '',
      g.language ?? '',
      g.country ?? '',
      g.macAddress ?? '',
      g._count.sessions,
      g.consents.map((c) => c.type).join(' | '),
      g.createdAt.toISOString(),
    ]);

    return [header, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }

  async getGuest(id: string, tenantId: string) {
    const guest = await this.prisma.guest.findFirst({
      where: { id, tenantId },
      include: {
        sessions: {
          orderBy: { startedAt: 'desc' },
          take: 20,
          include: { site: { select: { name: true } } },
        },
        consents: { orderBy: { createdAt: 'desc' } },
      },
    });
    return guest;
  }
}
