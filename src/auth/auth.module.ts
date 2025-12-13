import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import ms from 'ms';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

import { UsersModule } from 'src/users/users.module';
import { User } from 'src/users/entities/user.entity';

import { JwtStrategy } from './strategies/jwt.strategy';

// Extra modules required by AuthService
import { StoreModule } from 'src/store/store.module';
import { EmailModule } from 'src/email/email.module';

@Module({
  imports: [
    // Load environment variables globally
    ConfigModule.forRoot({ isGlobal: true }),

    // REPOSITORY FOR JwtStrategy + AuthService
    TypeOrmModule.forFeature([User]),

    // Required feature modules
    UsersModule,
    StoreModule,
    EmailModule,

    // Passport Auth
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // Register JWT using config service
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn:
            (config.get<string>('JWT_EXPIRES_IN') as ms.StringValue) || '7d',
        },
      }),
    }),
  ],

  controllers: [AuthController],

  providers: [AuthService, JwtStrategy],

  exports: [AuthService, JwtModule, PassportModule, TypeOrmModule],
})
export class AuthModule {}
