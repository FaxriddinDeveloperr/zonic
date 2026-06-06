// Port of Zonic.Api/Controllers/AccountController.cs  →  routes under /Account
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { GenerateTokenInDto } from './dto/generate-token-in.dto';
import { RefreshTokenInDto } from './dto/refresh-token-in.dto';
import { GenerateTokenOutDto } from './dto/generate-token-out.dto';

@ApiTags('Account')
@Controller('Account')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('Login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Authenticate and obtain JWT access + refresh tokens' })
  @ApiResponse({ status: 200, type: GenerateTokenOutDto })
  @ApiResponse({ status: 400, description: 'Invalid username or password' })
  login(@Body() dto: GenerateTokenInDto): Promise<GenerateTokenOutDto> {
    return this.authService.generateToken(dto);
  }

  @Post('RefreshToken')
  @HttpCode(200)
  @ApiOperation({ summary: 'Exchange a valid refresh token for a new token pair' })
  @ApiResponse({ status: 200, type: GenerateTokenOutDto })
  @ApiResponse({ status: 400, description: 'Invalid or expired refresh token' })
  refresh(@Body() dto: RefreshTokenInDto): Promise<GenerateTokenOutDto> {
    return this.authService.refreshToken(dto);
  }
}
