import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserModule } from '../users/user.module';
import { PassportModule } from '@nestjs/passport';
import { LocalStrategy } from './local.strategy';
import { UserService } from 'src/users/user.service';
import { RedisService } from 'src/redis/redis.service';
import { RedisModule } from 'src/redis/redis.module';
import { FailedLoginModule } from 'src/failedLogins/failedLogin.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { GithubStrategy } from './github.strategy';

@Module({
  imports: [
    UserModule,
    PassportModule,
    RedisModule,
    FailedLoginModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy, GithubStrategy],
})
export class AuthModule {}
