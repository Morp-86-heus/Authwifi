import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  // Cartella uploads — creala se non esiste
  const uploadsDir = join(process.cwd(), 'public', 'uploads');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

  // Serve file statici da /public
  await app.register(require('@fastify/static'), {
    root: join(process.cwd(), 'public'),
    prefix: '/public/',
  });

  // Multipart per upload immagini
  await app.register(require('@fastify/multipart'), {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  // Swagger (solo in dev/staging)
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Authwifi API')
      .setDescription('Piattaforma WiFi Marketing — API docs')
      .setVersion('0.1')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Authwifi API listening on http://0.0.0.0:${port}`);
  console.log(`📚 Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();
