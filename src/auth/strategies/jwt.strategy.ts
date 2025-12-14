import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/users/entities/user.entity';

export interface JwtAuthUser {
  sub: string; // user ID
  email: string;
  role: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  token_version: number;
  iat?: number; // issued at
  exp?: number; // expiration timestamp
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    super({
      secretOrKey: process.env.JWT_SECRET,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtAuthUser> {
    const { sub, token_version } = payload;

    const user = await this.userRepo.findOne({
      where: { id: sub },
      select: ['id', 'email', 'account_type', 'token_version'],
    });
    if (!user) throw new UnauthorizedException('User no longer exists');

    if (user.token_version !== token_version) {
      throw new UnauthorizedException('Token expired — please login again');
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.account_type,
    };
  }
}
