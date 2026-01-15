import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import Redis from 'ioredis';
import * as crypto from 'crypto';

@Injectable()
export class OtpRedisService {
  constructor(private readonly redis: Redis) {}

  // -----------------------------
  // CONFIG
  // -----------------------------
  private readonly OTP_TTL = 300; // 5 minutes
  private readonly EMAIL_LIMIT_TTL = 600; // 10 minutes
  private readonly IP_LIMIT_TTL = 3600; // 1 hour
  private readonly FAIL_LIMIT_TTL = 900; // 15 minutes

  private readonly EMAIL_LIMIT = 3;
  private readonly IP_LIMIT = 10;
  private readonly FAIL_LIMIT = 5;

  // -----------------------------
  // KEYS
  // -----------------------------
  private otpKey(email: string) {
    return `otp:value:${email}`;
  }

  private emailRateKey(email: string) {
    return `otp:rate:email:${email}`;
  }

  private ipRateKey(ip: string) {
    return `otp:rate:ip:${ip}`;
  }

  private failKey(email: string) {
    return `otp:fail:${email}`;
  }

  // -----------------------------
  // ATOMIC COUNTER
  // -----------------------------
  private async incrWithTTL(key: string, ttl: number): Promise<number> {
    const pipeline = this.redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, ttl);

    const result = await pipeline.exec();

    if (!result) {
      throw new Error('Redis pipeline execution failed');
    }

    const [, incrResult] = result[0];

    return Number(incrResult);
  }

  // -----------------------------
  // REQUEST OTP
  // -----------------------------
  async requestOtp(email: string, ip: string) {
    const emailCount = await this.incrWithTTL(
      this.emailRateKey(email),
      this.EMAIL_LIMIT_TTL,
    );

    if (emailCount > this.EMAIL_LIMIT) {
      throw new HttpException(
        {
          message: 'OTP email rate limit exceeded',
          retry_after: await this.redis.ttl(this.emailRateKey(email)),
        },
        HttpStatus.TOO_MANY_REQUESTS, // 429
      );
    }

    const ipCount = await this.incrWithTTL(
      this.ipRateKey(ip),
      this.IP_LIMIT_TTL,
    );

    if (ipCount > this.IP_LIMIT) {
      throw new HttpException(
        {
          message: 'OTP IP rate limit exceeded',
          retry_after: await this.redis.ttl(this.ipRateKey(ip)),
        },
        HttpStatus.TOO_MANY_REQUESTS, // 429
      );
    }

    const otp = crypto.randomInt(100000, 999999).toString();

    await this.redis.set(this.otpKey(email), otp, 'EX', this.OTP_TTL);

    return {
      otp,
      expires_in: this.OTP_TTL,
    };
  }

  // -----------------------------
  // VERIFY OTP
  // -----------------------------
  async verifyOtp(email: string, otp: string) {
    const fails = Number(await this.redis.get(this.failKey(email)));

    if (fails >= this.FAIL_LIMIT) {
      throw new HttpException(
        {
          message: 'OTP locked due to too many failed attempts',
          unlock_in: await this.redis.ttl(this.failKey(email)),
        },
        HttpStatus.TOO_MANY_REQUESTS, // 429
      );
    }

    const storedOtp = await this.redis.get(this.otpKey(email));

    if (!storedOtp || storedOtp !== otp) {
      const newFails = await this.incrWithTTL(
        this.failKey(email),
        this.FAIL_LIMIT_TTL,
      );

      if (newFails >= this.FAIL_LIMIT) {
        throw new HttpException(
          {
            message: 'OTP locked due to too many failed attempts',
            unlock_in: await this.redis.ttl(this.failKey(email)),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new UnauthorizedException('Invalid OTP');
    }

    // one-time use
    await this.redis.del(this.otpKey(email));
    await this.redis.del(this.failKey(email));

    return { success: true };
  }
}
