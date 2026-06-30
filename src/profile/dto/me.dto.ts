import { ApiProperty } from '@nestjs/swagger';

export class MeDto {
  @ApiProperty({ example: 'johndoe' })
  username: string;

  @ApiProperty({ example: 'john@example.com', nullable: true })
  email: string | null;

  @ApiProperty({ example: '+998901234567', nullable: true })
  phone: string | null;

  @ApiProperty({ example: 'a1b2c3d4.jpg', nullable: true })
  avatarFileId: string | null;

  @ApiProperty({ example: '#FF0000', nullable: true, description: 'Personal/team zone color' })
  color: string | null;

  // ─── Onboarding / profile fields (Phase D) ───
  @ApiProperty({ example: 1, nullable: true, description: 'info_country id' })
  countryId: number | null;

  @ApiProperty({ example: 14, nullable: true, description: 'info_region id (belongs to country)' })
  regionId: number | null;

  @ApiProperty({ example: 27, nullable: true })
  age: number | null;

  @ApiProperty({ example: 178, nullable: true, description: 'height in cm' })
  heightCm: number | null;

  @ApiProperty({ example: 72, nullable: true, description: 'weight in kg' })
  weightKg: number | null;

  @ApiProperty({ example: 'male', nullable: true, description: "'male' | 'female'" })
  gender: string | null;

  @ApiProperty({ example: 'beginner', nullable: true, description: "'beginner' | 'professional'" })
  level: string | null;

  // ─── Derived (computed on read, never stored) ───
  @ApiProperty({ example: 22.7, nullable: true, description: 'Body Mass Index = kg / m²' })
  bmi: number | null;

  @ApiProperty({ example: 'normal', nullable: true, description: 'BMI category' })
  bmiCategory: string | null;

  @ApiProperty({ example: 64.8, nullable: true, description: 'kcal per km (× distance for a run)' })
  caloriePerKm: number | null;

  @ApiProperty({
    example: true,
    description: 'True when all required onboarding fields are set (UI onboarding guard)',
  })
  onboardingCompleted: boolean;

  // ─── Privacy zone (Phase N) ───
  @ApiProperty({ example: 41.31, nullable: true, description: 'Privacy-zone center latitude' })
  privacyLat: number | null;

  @ApiProperty({ example: 69.24, nullable: true, description: 'Privacy-zone center longitude' })
  privacyLng: number | null;

  @ApiProperty({ example: 200, nullable: true, description: 'Privacy-zone radius (m)' })
  privacyRadiusM: number | null;
}

export class UploadAvatarResponseDto {
  @ApiProperty({ example: 'a1b2c3d4.jpg' })
  fileId: string;
}
