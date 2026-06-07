// Port of Zonic.Api/Controllers/UserController.cs  →  routes under /User
import { Body, Controller, HttpCode, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { RegisterResponseDto } from './dto/register-response.dto';

@ApiTags('User')
@Controller('User')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('Register')
  @HttpCode(200)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 200, type: RegisterResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error (duplicate username/email, weak password, ...)' })
  register(@Body() dto: CreateUserDto): Promise<RegisterResponseDto> {
    return this.usersService.register(dto);
  }

  @Put('UpdateMe')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update the authenticated user's profile (and optionally password)" })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 400, description: 'Validation error (duplicate username/email, wrong old password)' })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto): Promise<void> {
    return this.usersService.updateMe(user.userId, dto);
  }
}
