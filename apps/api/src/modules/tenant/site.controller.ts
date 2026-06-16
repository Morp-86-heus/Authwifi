import { Controller, Post, Patch, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IsString, IsOptional } from 'class-validator';

class CreateSiteDto {
  @IsString() tenantId: string;
  @IsString() name: string;
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() omadaControllerUrl?: string;
  @IsString() @IsOptional() omadaOmadacId?: string;
  @IsString() @IsOptional() omadaSiteId?: string;
  @IsString() @IsOptional() omadaOperatorUser?: string;
  @IsString() @IsOptional() omadaOperatorPass?: string;
  @IsString() @IsOptional() primaryColor?: string;
  @IsString() @IsOptional() accentColor?: string;
  @IsString() @IsOptional() welcomeTitle?: string;
  @IsString() @IsOptional() welcomeText?: string;
  @IsString() @IsOptional() loginMethods?: string;
}

class UpdateSiteDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() omadaControllerUrl?: string;
  @IsString() @IsOptional() omadaOmadacId?: string;
  @IsString() @IsOptional() omadaSiteId?: string;
  @IsString() @IsOptional() omadaOperatorUser?: string;
  @IsString() @IsOptional() omadaOperatorPass?: string;
  @IsString() @IsOptional() primaryColor?: string;
  @IsString() @IsOptional() accentColor?: string;
  @IsString() @IsOptional() welcomeTitle?: string;
  @IsString() @IsOptional() welcomeText?: string;
  @IsString() @IsOptional() loginMethods?: string;
}

@ApiTags('sites')
@Controller('sites')
export class SiteController {
  constructor(private prisma: PrismaService) {}

  @Post()
  create(@Body() dto: CreateSiteDto) {
    return this.prisma.site.create({ data: dto });
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  findAll(@Request() req: any) {
    return this.prisma.site.findMany({ where: { tenantId: req.user.tenantId } });
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id') id: string) {
    return this.prisma.site.findUnique({ where: { id } });
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Body() dto: UpdateSiteDto) {
    return this.prisma.site.update({ where: { id }, data: dto });
  }
}
