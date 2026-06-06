// Port of Zonic.Api/Controllers/UserController.cs  →  routes under /User
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
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
}
