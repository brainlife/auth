import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserModule } from '../users/user.module';
import { PassportModule } from '@nestjs/passport';
import { LocalStrategy } from './local.strategy';
import { UserService } from 'src/users/user.service';

@Module({
  imports: [
    UserModule,
    PassportModule,],
  providers: [AuthService, LocalStrategy],
})
export class AuthModule {}
