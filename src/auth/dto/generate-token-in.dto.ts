// Mirrors GenerateTokenInDto.cs
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GenerateTokenInDto {
  @ApiProperty({ example: 'testuser' })
  @IsString()
  @IsNotEmpty()
  userName: string;

  @ApiProperty({ example: 'secret123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
