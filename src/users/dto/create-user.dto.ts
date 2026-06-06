// Mirrors CreateUserDto.cs / UserDlDto DataAnnotations
// ([Required][LocalizedStringLength(100)] Username, [StringLength(150)] Email,
//  [StringLength(50)] Phone, [LocalizedMinLength(6)] Password).
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ maxLength: 100, example: 'testuser' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  username: string;

  @ApiPropertyOptional({ maxLength: 150, example: 'test@example.com' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ maxLength: 50, example: '+998901234567' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiProperty({ minLength: 6, example: 'secret123' })
  @IsString()
  @MinLength(6)
  password: string;
}
