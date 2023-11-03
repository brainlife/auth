import { Controller, Next } from '@nestjs/common';
import { Get, UseGuards, Param, Put } from '@nestjs/common';
import { Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { OrcidOauthGuard } from '../auth/guards/oauth.guards';
import { UserService } from '../users/user.service';
import { GroupService } from '../groups/group.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  checkUser,
  decodeJWT,
  createClaim,
  signJWT,
  queuePublisher,
  sendErrorMessage,
  ACCOUNT_ALREADY_ASSOCIATED_ERROR,
  ANOTHER_ACCOUNT_ALREADY_ASSOCIATED_ERROR,
  sendSuccessMessage,
} from '../utils/common.utils';
import {
  settingsCallback,
  ttl,
  orcid,
  signUpUrl,
  successUrl,
  cookieConfig,
} from '../auth/constants';
import axios from 'axios';
import passport = require('passport');
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import { RabbitMQ } from '../rabbitmq/rabbitmq.service';
import { log } from 'console';
import { send } from 'process';
import { config } from 'dotenv';

interface DefaultData {
  fullname?: string;
  email?: string;
  username?: string;
}

@Controller('orcid')
export class OrcidController {
  private readonly orcidStrategy: any;

  constructor(
    private readonly userService: UserService,
    private readonly groupService: GroupService,
    private queuePublisher: RabbitMQ,
  ) {
    // Here we'll initialize your orcidStrategy
    this.orcidStrategy = new OAuth2Strategy(
      {
        clientID: process.env.ORCID_CLIENT_ID,
        clientSecret: process.env.ORCID_CLIENT_SECRET,
        callbackURL: process.env.ORCID_CALLBACK_URL,
        authorizationURL: process.env.ORCID_AUTHORIZATION_URL,
        tokenURL: process.env.ORCID_TOKEN_URL,
        scope: '/authenticate',
      },
      async (accessToken, refreshToken, profile, _needed, cb) => {
        console.debug(
          'orcid loading userinfo ..',
          accessToken,
          refreshToken,
          profile,
        );
        const user = await this.userService.findOne({
          'ext.orcid': profile.orcid,
        });
        cb(null, user, profile);
      },
    );

    this.orcidStrategy.name = 'orcid';
    passport.use(this.orcidStrategy);

    OAuth2Strategy.prototype.authorizationParams = function (options) {
      return { selected_idp: options.idp };
    };
  }

  @Get('signin')
  signIn(@Req() req, @Res() res, @Next() next: any) {
    console.log(
      'orcid signin ---------- COOKIE CHECK',
      req.cookies['associate_jwt'],
    );
    (passport.authenticate as any)(this.orcidStrategy.name, {
      idp: req.query.idp,
    })(req, res, next);
  }

  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response) {
    // This route is protected by Orcid authentication
    // NestJS will automatically redirect the user to Orcid for authentication
    // check cookies
    (passport.authenticate as any)(
      this.orcidStrategy.name,
      async (err, user, profile) => {
        console.debug(
          'orcid callback',
          'User parsed',
          user,
          'His profile',
          profile,
        );
        if (err) {
          console.error(err);
          return res.redirect(
            '/auth/#!/signin?msg=' + 'Failed to authenticate orcid',
          );
        }

        let loggedInUser = null;
        if (req.cookies['associate_jwt']) {
          loggedInUser = decodeJWT(req.cookies['associate_jwt']);
        }

        const existingUserWithOrcidId = await this.userService.findOne({
          'ext.orcid': profile.orcid,
        });

        //CASE 1 : User trying to associate Orcid account while already logged in
        if (loggedInUser) {
          res.clearCookie('associate_jwt');

          if (existingUserWithOrcidId) {
            if (loggedInUser.sub != existingUserWithOrcidId?.sub) {
              sendErrorMessage(
                res,
                'You are already logged in with a different account. Please logout and try again.',
              );
              return res.redirect(settingsCallback);
            }
            sendErrorMessage(
              res,
              ANOTHER_ACCOUNT_ALREADY_ASSOCIATED_ERROR('orcid'),
            );
            return res.redirect(settingsCallback);
          }

          const loggedInUserDetails = await this.userService.findOnebySub(
            loggedInUser.sub,
          );

          if (loggedInUserDetails.ext.orcid) {
            sendErrorMessage(res, ACCOUNT_ALREADY_ASSOCIATED_ERROR('orcid'));
          }
          loggedInUserDetails.ext.orcid = profile.orcid;

          await this.userService.updatebySub(
            loggedInUserDetails.sub,
            loggedInUserDetails,
          );

          sendSuccessMessage(res, 'Successfully associated orcid account.');
          return res.redirect(settingsCallback);
        }

        //User trying to register with Orcid account
        if (!loggedInUser && !existingUserWithOrcidId) {
          console.log('registering new user');
          this.registerNewUser(profile, res);
          return;
        }

        //User has an account linked in Brainlife and is trying to login with Orcid
        if (!loggedInUser && existingUserWithOrcidId) {
          const claim = await createClaim(
            existingUserWithOrcidId,
            this.userService,
            this.groupService,
          );
          existingUserWithOrcidId.times.orcid_login = new Date();
          existingUserWithOrcidId.reqHeaders = req.headers;
          await this.userService.updatebySub(
            existingUserWithOrcidId.sub,
            existingUserWithOrcidId,
          );
          // publish to rabbitmq
          await this.queuePublisher.publishToQueue(
            'user.login.' + existingUserWithOrcidId.sub,
            JSON.stringify({
              type: 'orcid',
              username: existingUserWithOrcidId.username,
              exp: claim.exp,
              headers: req.headers,
            }),
          );
          const jwt = signJWT(claim);
          res.redirect(successUrl + jwt);
        }
      },
    )(req, res);
  }

  async registerNewUser(profile: any, res: Response) {
    try {
      const baseOrcidURL =
        process.env.NODE_ENV === 'development'
          ? 'https://pub.sandbox.orcid.org/v2.1/'
          : 'https://pub.orcid.org/v2.1/';

      const detailURL = `${baseOrcidURL}${profile.orcid}/person`;

      const detail = await axios.get(detailURL, {
        headers: {
          Accept: 'application/json',
        },
      });

      const extractedData =
        process.env.NODE_ENV === 'development'
          ? detail.data
          : detail.data.person;

      const fullName = `${extractedData?.name?.['given-names']?.value || ''} ${extractedData?.name?.['family-name']?.value || ''
        }`.trim();
      const primaryEmail = extractedData?.emails?.email.find(
        (email: any) => email.primary,
      )?.email;

      const defaultData: DefaultData = {
        fullname: fullName || undefined,
        email: primaryEmail || undefined,
        username: primaryEmail?.split('@')[0] || undefined,
      };

      const temp_jwt = signJWT({
        exp: (Date.now() + ttl) / 1000,
        ext: { orcid: profile.orcid },
        _default: defaultData,
      });

      console.info(`signed temporary jwt token for orcid signup: ${temp_jwt}`);
      console.debug(JSON.stringify(profile, null, 4));

      res.redirect(signUpUrl + temp_jwt);
    } catch (error) {
      console.error(`Failed to get orcid detail: ${error.message}`);
      res.status(500).send('Error registering new user.');
    }
  }

  @Get('associate/:jwt')
  async associate(
    @Param('jwt') jwt: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const userParsedfromCookie = decodeJWT(jwt);

    if (!userParsedfromCookie) {
      throw new Error('Failed to parse jwt');
    }

    res.cookie('associate_jwt', jwt, cookieConfig);
    res.redirect('/api/auth/orcid/signin');
    // (passport.authenticate as any)(this.orcidStrategy.name)(req, res);
  }

  @Put('disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnect(@Req() req, @Res() res) {
    const user = await this.userService.findOnebySub(req.user.sub);
    if (!user) {
      // throw new Error(`Couldn't find user record with sub: ${req.user.sub}`);
      return res.status(401).send(`Couldn't find user record`);
    }

    //user.ext.orcid = null giving error in mongo duplication error
    user.ext.orcid = undefined;
    await this.userService.updatebySub(user.sub, user);

    return res.json({
      message: 'Successfully disconnected ORCID account.',
      user,
    });
  }
}
