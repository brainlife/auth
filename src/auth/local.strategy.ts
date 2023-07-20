
import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',  // This should match the field you're sending in the request
      passwordField: 'password',
      passReqToCallback: true,
    });
  }

  //added req:any to pass the request to the validate function
  async validate(req:any ,usernameOrEmail: string, password: string): Promise<any> {
    // console.log('LocalStrategy.validate', usernameOrEmail, password);
    const status = await this.authService.validateUser(usernameOrEmail, password,req);
    // console.log("Return", status);
    return status;
  }
}
