import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtAuthUser } from '../strategies/jwt.strategy';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): JwtAuthUser | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtAuthUser }>();
    return request.user;
  },
);
