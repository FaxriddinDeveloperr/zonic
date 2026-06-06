// Reads the authenticated user from the request (set by JwtStrategy.validate),
// mirroring how the C# controllers read User claims via IAuthService.
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from './jwt.strategy';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    return ctx.switchToHttp().getRequest().user;
  },
);
