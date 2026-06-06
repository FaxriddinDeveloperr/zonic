// Replicates the TokenValidationParameters in AuthExtensions.cs (HS256, issuer, audience, no skew).
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface AuthUser {
  userId: string;
  userName: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secretKey'),
      issuer: config.get<string>('jwt.issuer'),
      audience: config.get<string>('jwt.audience'),
      algorithms: ['HS256'],
    });
  }

  // sub → ClaimTypes.NameIdentifier, unique_name → username
  validate(payload: { sub: string; unique_name: string }): AuthUser {
    return { userId: payload.sub, userName: payload.unique_name };
  }
}
