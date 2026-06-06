// Port of Zonic.ServiceLayer/AccountServices/Concrete/AccountService.cs
import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { verifyPassword } from '../common/helpers/password';
import { formatDateTime } from '../common/helpers/datetime';
import { badRequest } from '../common/validation-problem';
import { GenerateTokenInDto } from './dto/generate-token-in.dto';
import { RefreshTokenInDto } from './dto/refresh-token-in.dto';
import { GenerateTokenOutDto } from './dto/generate-token-out.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async generateToken(input: GenerateTokenInDto): Promise<GenerateTokenOutDto> {
    const user = await this.users.findOne({ where: { username: input.userName } });

    if (!user) throw badRequest(['Invalid username or password.']);

    if (!verifyPassword(input.password ?? '', user.passwordSalt, user.passwordHash)) {
      throw badRequest(['Invalid username or password.']);
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = AuthService.generateRefreshTokenString();
    const now = new Date();
    const refreshExpiresAt = new Date(
      now.getTime() + this.refreshDays() * 86_400_000,
    );

    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId: user.id,
        token: refreshToken,
        expiresAt: refreshExpiresAt,
        createdAt: now,
      }),
    );

    return this.buildOutput(accessToken, refreshToken, refreshExpiresAt, now);
  }

  async refreshToken(input: RefreshTokenInDto): Promise<GenerateTokenOutDto> {
    const stored = await this.refreshTokens.findOne({
      where: { token: input.refreshToken, revokedAt: null as unknown as undefined },
      relations: { user: true },
    });

    if (!stored || stored.revokedAt != null || stored.expiresAt < new Date()) {
      throw badRequest(['Invalid or expired refresh token.']);
    }

    stored.revokedAt = new Date();
    await this.refreshTokens.save(stored);

    const user = stored.user!;
    const accessToken = this.generateAccessToken(user);
    const newRefreshToken = AuthService.generateRefreshTokenString();
    const now = new Date();
    const refreshExpiresAt = new Date(now.getTime() + this.refreshDays() * 86_400_000);

    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId: user.id,
        token: newRefreshToken,
        expiresAt: refreshExpiresAt,
        createdAt: now,
      }),
    );

    return this.buildOutput(accessToken, newRefreshToken, refreshExpiresAt, now);
  }

  private generateAccessToken(user: User): string {
    return this.jwt.sign(
      { sub: user.id, unique_name: user.username, jti: crypto.randomUUID() },
      {
        secret: this.config.get<string>('jwt.secretKey'),
        issuer: this.config.get<string>('jwt.issuer'),
        audience: this.config.get<string>('jwt.audience'),
        expiresIn: `${this.config.get<number>('jwt.accessTokenExpirationMinutes')}m`,
      },
    );
  }

  private static generateRefreshTokenString(): string {
    return crypto.randomBytes(64).toString('base64');
  }

  private refreshDays(): number {
    return this.config.get<number>('jwt.refreshTokenExpirationDays')!;
  }

  private buildOutput(
    accessToken: string,
    refreshToken: string,
    refreshExpiresAt: Date,
    now: Date,
  ): GenerateTokenOutDto {
    const minutes = this.config.get<number>('jwt.accessTokenExpirationMinutes')!;
    const accessExpireAt = new Date(now.getTime() + minutes * 60_000);
    return {
      accessToken,
      token: accessToken,
      accessTokenExpireAt: formatDateTime(accessExpireAt),
      refreshToken,
      refreshTokenExpireAt: formatDateTime(refreshExpiresAt),
    };
  }
}
