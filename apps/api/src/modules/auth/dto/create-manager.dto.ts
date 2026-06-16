import { IsString, IsEmail, IsOptional } from 'class-validator';

export class CreateManagerDto {
  @IsString() tenantId: string;
  @IsEmail()  email: string;
  @IsString() password: string;
  @IsString() @IsOptional() firstName?: string;
  @IsString() @IsOptional() lastName?: string;
}
