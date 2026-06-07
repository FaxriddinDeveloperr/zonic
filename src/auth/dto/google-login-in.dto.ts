// Body for POST /Account/GoogleLogin — the ID token issued by the Google Sign-In SDK on the device.
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginInDto {
  @ApiProperty({
    description: 'Google ID token (JWT) returned by the mobile Google Sign-In SDK',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
