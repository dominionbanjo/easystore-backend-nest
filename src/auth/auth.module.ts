import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

import { UsersModule } from 'src/users/users.module';
import { User } from 'src/users/entities/user.entity';

import { JwtStrategy } from './strategies/jwt.strategy';
import ms from 'ms';

@Module({
  imports: [
    // MUST include the User repository so JwtStrategy can inject it
    TypeOrmModule.forFeature([User]),

    UsersModule, // Makes UsersService and exported repository available

    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.register({
      secret: process.env.JWT_SECRET!,
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as ms.StringValue,
      },
    }),
  ],

  controllers: [AuthController],

  providers: [
    AuthService,
    JwtStrategy, // MUST be provided
  ],

  exports: [
    AuthService,
    JwtModule, // helpful if other modules need jwt
    PassportModule, // helpful for guards
    TypeOrmModule, // exports UserRepository if needed externally
  ],
})
export class AuthModule {}
