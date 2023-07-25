import { HttpException, Injectable, HttpStatus } from '@nestjs/common';
import { UserService } from '../users/user.service';
import { checkPassword } from 'src/utils/common.utils';
import { queuePublisher, checkUser, signJWT } from 'src/utils/common.utils';
import { RedisService } from '../redis/redis.service';
import { FailedLoginService } from 'src/failedLogins/failedLogin.service';
import { FailedLogin } from 'src/schema/failedLogin.schema';
import { CreateFailedLoginDto } from 'src/dto/create-failedLogin.dto';
import { use } from 'passport';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private readonly redisService: RedisService,
    private readonly failedLoginService: FailedLoginService,
  ) {}

  async validateUser(
    usernameOrEmail: string,
    pass: string,
    req: any,
  ): Promise<any> {
    const user = await this.userService.findOne({
      $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
    });

    if (!user) {
      return { message: 'Incorrect email or username', code: 'bad_username' };
    }

    if (!user.password_hash)
      return {
        message:
          'Password login is not enabled for this account (please try 3rd party authentication)',
        code: 'no_password',
      };

    const fails = await this.redisService.keys(
      'auth.fail.' + user.username + '.*',
    );
    console.log('failsValidateUser', fails);
    if (fails && fails.length > 3)
      return { message: 'Account Locked ! Try after an hour' };

    const passwordMatch = checkPassword(pass, user.password_hash);

    if (!passwordMatch)
      return { message: 'Incorrect user/password', code: 'bad_password' };

    return user;
  }

  // async login(user: any,req:any) {
  //   console.log("Login was called",user);
  //   const payload = { username: user.username, sub: user.userId };
  //   return {
  //     access_token: this.jwtService.sign(payload),
  //   };
  // }
}
