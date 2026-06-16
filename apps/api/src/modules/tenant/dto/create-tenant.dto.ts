import { IsString, IsEmail, IsOptional, IsUrl } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @IsUrl()
  @IsOptional()
  logoUrl?: string;
}
