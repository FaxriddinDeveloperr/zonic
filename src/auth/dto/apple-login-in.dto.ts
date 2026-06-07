// Body for POST /Account/AppleLogin — the identity token from "Sign in with Apple".
// fullName / email are sent by Apple ONLY on the very first authorization, so the client
// forwards them as a fallback; on later logins the user is matched by the token's stable `sub`.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AppleLoginInDto {
  @ApiProperty({
    description: 'Apple identity token (JWT) from Sign in with Apple (`identityToken`)',
  })
  @IsString()
  @IsNotEmpty()
  identityToken: string;

  @ApiPropertyOptional({
    description: 'Display name — Apple only provides this on the first sign-in',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Email — Apple only provides this on the first sign-in',
    maxLength: 150,
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;
}
