// PUT /User/UpdateMe body — all fields optional. To change the password, send both
// oldPassword (verified) and newPassword.
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateMeDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string;

  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  oldPassword?: string;

  @ApiPropertyOptional({ minLength: 6 })
  @IsOptional()
  @IsString()
  @MinLength(6)
  newPassword?: string;

  @ApiPropertyOptional({ example: '#FF0000', description: 'Hex color #RRGGBB' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex code like #FF0000' })
  color?: string;
}
