// Mirrors GenerateTokenOutDto.cs (date fields formatted "dd.MM.yyyy HH:mm:ss" via DateTimeConverter).
import { ApiProperty } from '@nestjs/swagger';

export class GenerateTokenOutDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ description: 'Alias of accessToken (Token => AccessToken)' })
  token: string;

  @ApiProperty({ example: '06.06.2026 07:27:27' })
  accessTokenExpireAt: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ example: '05.07.2026 21:27:27' })
  refreshTokenExpireAt: string;
}
