import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({ description: 'FCM device token' })
  @IsString()
  @MaxLength(500)
  token: string;

  @ApiPropertyOptional({ example: 'android', enum: ['ios', 'android'] })
  @IsOptional()
  @IsString()
  @IsIn(['ios', 'android'])
  platform?: string;
}
