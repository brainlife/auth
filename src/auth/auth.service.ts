import { HttpException, Injectable, HttpStatus } from '@nestjs/common';
import { UserService } from '../users/user.service';
import { checkPassword } from '../utils/common.utils';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private readonly redisService: RedisService,
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

  async verifyGithubUser(profile: any): Promise<any> {
    const user = await this.userService.findOne({
      'ext.github': profile.id,
    });
    console.log('verifyGithubUser', profile);
    return { user, profile };
  }

  async verifyGoogleUser(profile: any): Promise<any> {
    const user = await this.userService.findOne({
      'ext.google': profile.id,
    });
    console.log('verifyGoogleUser', profile);
    return { user, profile };
  }

  async verifyOrcidUser(profile: any): Promise<any> {
    console.log('verifyOrcidUser', profile);
    const user = await this.userService.findOne({
      'ext.orcid': profile.id,
    });
    return { user, profile };
  }

  // async login(user: any,req:any) {
  //   console.log("Login was called",user);
  //   const payload = { username: user.username, sub: user.userId };
  //   return {
  //     access_token: this.jwtService.sign(payload),
  //   };
  // }
}
