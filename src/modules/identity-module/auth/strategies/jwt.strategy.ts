import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly usersService: UsersService) {
    super({
      secretOrKey: process.env.JWT_SECRET,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtAuthUser> {
    const { sub, token_version } = payload;

    const user = await this.usersService.getForJwtValidation(sub);

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    if (user.token_version !== token_version) {
      throw new UnauthorizedException('Token expired — please login again');
    }

    return {
      sub: user.id,
      role: user.account_type,
      status: user.account_status,
      store_id: user.store_id,
      permissions: user.permissions,
    };
  }
}

export interface JwtAuthUser {
  sub: string; // user ID
  role: string; // account_type
  status: string; // account_status
  store_id: string | null;
  permissions: string[] | null;
}

export interface JwtPayload {
  sub: string;
  role: string;
  status?: string;
  store_id: string | null;
  token_version: number;
  iat?: number;
  exp?: number;
}
