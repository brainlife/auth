// orcid.service.ts
import { Injectable } from '@nestjs/common';
import * as OAuth2Strategy from 'passport-oauth2';
import { UserService } from '../users/user.service';
import passport = require('passport');

@Injectable()
export class OrcidService {
  private orcidStrategy: OAuth2Strategy;
  private userService: UserService;
  constructor() {
    this.orcidStrategy = new OAuth2Strategy(
      {
        clientID: process.env.ORCID_CLIENT_ID,
        clientSecret: process.env.ORCID_CLIENT_SECRET,
        callbackURL: process.env.ORCID_CALLBACK_URL,
        authorizationURL: process.env.ORCID_AUTHORIZATION_URL,
        tokenURL: process.env.ORCID_TOKEN_URL,
        scope: '/authenticate',
      },
      // eslint-disable-next-line prettier/prettier
      async (
        accessToken: any,
        refreshToken: any,
        profile: any,
        cb,
      ) => {
        const user = await this.userService.findOne({
          'ext.orcid': profile.id,
        });
        cb(null, user, profile);
      },
    );
    passport.use(this.orcidStrategy);
    this.orcidStrategy.name = 'oauth2-orcid';
    OAuth2Strategy.prototype.authorizationParams = function (options) {
      return { selected_idp: options.idp };
    };
  }

  authenticate(req: any, res: any, next: any) {
    return (passport.authenticate as any)(this.orcidStrategy.name, {
      idp: req.query.idp,
    })(req, res, next);
  }
}
