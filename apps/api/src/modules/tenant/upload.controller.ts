import {
  Controller,
  Post,
  Param,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FastifyRequest } from 'fastify';
import { PrismaService } from '../../common/prisma/prisma.service';
import { join, extname } from 'path';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { pipeline } from 'stream/promises';

type ImageField = 'logo' | 'background' | 'hero';

const FIELD_MAP: Record<ImageField, string> = {
  logo:       'logoUrl',
  background: 'backgroundImageUrl',
  hero:       'heroImageUrl',
};

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

@ApiTags('sites')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('sites/:id/upload')
export class UploadController {
  constructor(private prisma: PrismaService) {}

  /**
   * POST /sites/:id/upload/:field
   * field: logo | background | hero
   * Content-Type: multipart/form-data
   */
  @Post(':field')
  @ApiConsumes('multipart/form-data')
  async uploadImage(
    @Param('id') siteId: string,
    @Param('field') field: string,
    @Req() req: FastifyRequest,
  ) {
    if (!['logo', 'background', 'hero'].includes(field)) {
      throw new BadRequestException('Campo non valido. Usa: logo, background, hero');
    }

    const data = await (req as any).file();
    if (!data) throw new BadRequestException('Nessun file ricevuto');
    if (!ALLOWED_MIME.includes(data.mimetype)) {
      throw new BadRequestException('Formato non supportato. Usa JPEG, PNG, WebP o SVG');
    }

    // Salva il file in public/uploads/
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

    const ext = extname(data.filename) || '.jpg';
    const filename = `${siteId}-${field}-${randomUUID()}${ext}`;
    const filePath = join(uploadsDir, filename);

    await pipeline(data.file, createWriteStream(filePath));

    const publicUrl = `/public/uploads/${filename}`;

    // Aggiorna il campo corrispondente nel DB
    const dbField = FIELD_MAP[field as ImageField];
    await this.prisma.site.update({
      where: { id: siteId },
      data: { [dbField]: publicUrl },
    });

    return { url: publicUrl };
  }
}
