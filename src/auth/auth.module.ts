import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserModule } from '../users/user.module';
import { PassportModule } from '@nestjs/passport';
import { LocalStrategy } from './local.strategy';
import { UserService } from 'src/users/user.service';
import { RedisService } from 'src/redis/redis.service';
import { RedisModule } from 'src/redis/redis.module';
import { FailedLoginModule } from 'src/failedLogins/failedLogin.module';
@Module({
  imports: [
    UserModule,
    PassportModule,
    RedisModule,
    FailedLoginModule
  ],
  providers: [AuthService, LocalStrategy],
})
export class AuthModule {}
