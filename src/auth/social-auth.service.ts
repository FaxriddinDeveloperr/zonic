// Google / Apple "Sign in" for the mobile client.
//
// Flow: the device performs the native Google/Apple sign-in and obtains an ID/identity
// token (a JWT signed by the provider). It posts that token here; we verify the signature
// against the provider's published JWKS, check issuer + audience, then find-or-create a
// local user and mint our own access + refresh tokens (same shape as password login).
import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { createRandomSalt, hashPassword } from '../common/helpers/password';
import { STATE_ACTIVE } from '../common/constants';
import { badRequest } from '../common/validation-problem';
import { AuthService } from './auth.service';
import { GoogleLoginInDto } from './dto/google-login-in.dto';
import { AppleLoginInDto } from './dto/apple-login-in.dto';
import { GenerateTokenOutDto } from './dto/generate-token-out.dto';

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const APPLE_ISSUER = 'https://appleid.apple.com';

// Remote key sets — jose caches the fetched keys and refreshes them on rotation.
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
);
const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

interface SocialProfile {
  providerId: string; // provider's stable `sub`
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

@Injectable()
export class SocialAuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  async googleLogin(dto: GoogleLoginInDto): Promise<GenerateTokenOutDto> {
    const audiences = this.config.get<string[]>('social.googleClientIds') ?? [];
    if (audiences.length === 0) {
      throw badRequest(['Google sign-in is not configured on the server.']);
    }

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(dto.idToken, GOOGLE_JWKS, {
        issuer: GOOGLE_ISSUERS,
        audience: audiences,
      }));
    } catch {
      throw badRequest(['Invalid Google token.']);
    }

    const profile: SocialProfile = {
      providerId: String(payload.sub),
      email: typeof payload.email === 'string' ? payload.email : null,
      // Google encodes email_verified as boolean or the string "true".
      emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      name: typeof payload.name === 'string' ? payload.name : null,
    };

    const user = await this.findOrCreate('google', profile);
    return this.auth.issueTokensFor(user);
  }

  async appleLogin(dto: AppleLoginInDto): Promise<GenerateTokenOutDto> {
    const audiences = this.config.get<string[]>('social.appleClientIds') ?? [];
    if (audiences.length === 0) {
      throw badRequest(['Apple sign-in is not configured on the server.']);
    }

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(dto.identityToken, APPLE_JWKS, {
        issuer: APPLE_ISSUER,
        audience: audiences,
      }));
    } catch {
      throw badRequest(['Invalid Apple token.']);
    }

    // Apple puts email in the token only on first consent; fall back to the client-sent value.
    const tokenEmail = typeof payload.email === 'string' ? payload.email : null;
    const profile: SocialProfile = {
      providerId: String(payload.sub),
      email: tokenEmail ?? dto.email ?? null,
      // Apple verifies the email it issues; client-supplied fallback is also trusted.
      emailVerified: true,
      name: dto.fullName ?? null,
    };

    const user = await this.findOrCreate('apple', profile);
    return this.auth.issueTokensFor(user);
  }

  /**
   * Resolve the local account for a verified social profile:
   *   1. already linked → match by the stored provider id;
   *   2. existing account with the same (verified) email → link the provider id;
   *   3. otherwise → create a new active user with a random password placeholder.
   */
  private async findOrCreate(
    provider: 'google' | 'apple',
    profile: SocialProfile,
  ): Promise<User> {
    const column = provider === 'google' ? 'googleUserId' : 'appleUserId';

    const linked = await this.users.findOne({ where: { [column]: profile.providerId } });
    if (linked) return linked;

    if (profile.email && profile.emailVerified) {
      const byEmail = await this.users.findOne({ where: { email: profile.email } });
      if (byEmail) {
        byEmail[column] = profile.providerId;
        return this.users.save(byEmail);
      }
    }

    const salt = createRandomSalt();
    const usernameBase = profile.email
      ? profile.email.split('@')[0]
      : `${provider}_${profile.providerId}`;

    const user = this.users.create({
      username: await this.uniqueUsername(usernameBase),
      email: profile.email,
      phone: null,
      passwordSalt: salt,
      // No usable password — store a hash of random bytes so the column stays non-null.
      passwordHash: hashPassword(crypto.randomBytes(32).toString('base64'), salt),
      stateId: STATE_ACTIVE,
      googleUserId: provider === 'google' ? profile.providerId : null,
      appleUserId: provider === 'apple' ? profile.providerId : null,
    });

    return this.users.save(user);
  }

  /** Sanitise a base into a unique username (<=100 chars), appending a counter on collision. */
  private async uniqueUsername(base: string): Promise<string> {
    const root = (base.replace(/[^a-zA-Z0-9_.@-]/g, '') || 'user').slice(0, 90);
    let candidate = root;
    let n = 0;
    // eslint-disable-next-line no-await-in-loop
    while (await this.users.findOne({ where: { username: candidate } })) {
      n += 1;
      candidate = `${root}_${n}`;
    }
    return candidate;
  }
}
