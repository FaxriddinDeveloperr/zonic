// PUT /User/UpdateMe body — all fields optional. To change the password, send both
// oldPassword (verified) and newPassword.
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

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

  // ─── Onboarding / profile fields (Phase D). Send null to clear a field. ───
  @ApiPropertyOptional({ example: 1, description: 'info_country id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  countryId?: number | null;

  @ApiPropertyOptional({ example: 14, description: 'info_region id (must belong to countryId)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  regionId?: number | null;

  @ApiPropertyOptional({ example: 27 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(120)
  age?: number | null;

  @ApiPropertyOptional({ example: 178, description: 'height in cm' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(50)
  @Max(260)
  heightCm?: number | null;

  @ApiPropertyOptional({ example: 72, description: 'weight in kg' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(400)
  weightKg?: number | null;

  @ApiPropertyOptional({ example: 'male', enum: ['male', 'female'] })
  @IsOptional()
  @IsIn(['male', 'female'])
  gender?: string;

  @ApiPropertyOptional({ example: 'beginner', enum: ['beginner', 'professional'] })
  @IsOptional()
  @IsIn(['beginner', 'professional'])
  level?: string;

  // ─── Privacy zone (Phase N). Send all three to set; send null to clear. ───
  @ApiPropertyOptional({ example: 41.31, description: 'Privacy-zone center latitude' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  privacyLat?: number | null;

  @ApiPropertyOptional({ example: 69.24, description: 'Privacy-zone center longitude' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  privacyLng?: number | null;

  @ApiPropertyOptional({ example: 200, description: 'Privacy-zone radius in meters' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5000)
  privacyRadiusM?: number | null;
}
