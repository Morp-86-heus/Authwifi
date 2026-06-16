import { IsString, IsEmail, IsOptional, IsArray } from 'class-validator';

export class GuestLoginDto {
  @IsString()
  siteId: string;

  @IsString()
  clientMac: string;

  @IsString()
  apMac: string;

  @IsString()
  ssidName: string;

  @IsString()
  @IsOptional()
  radioId?: string;

  @IsString()
  omadaSiteId: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsArray()
  @IsString({ each: true })
  consents: string[];
}
