import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateManagerDto } from './dto/create-manager.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.loginManager(dto.email, dto.password);
  }

  @Post('register')
  register(@Body() dto: CreateManagerDto) {
    return this.authService.createManager(dto);
  }
}
