import { Controller } from '@nestjs/common';
import { Get, UseGuards, Param, Put } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { UserService } from '../users/user.service';
import { GroupService } from '../groups/group.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  checkUser,
  decodeJWT,
  createClaim,
  signJWT,
  sendErrorMessage,
  ACCOUNT_ALREADY_ASSOCIATED_ERROR,
  sendSuccessMessage,
} from '../utils/common.utils';
import {
  cookieConfig,
  github,
  google,
  settingsCallback,
  successUrl,
  ttl,
} from '../auth/constants';
import { GoogleOauthGuard } from '../auth/guards/oauth.guards';
import { User } from '../schema/user.schema';
import { RabbitMQ } from '../rabbitmq/rabbitmq.service';
import { send } from 'process';
import { check } from 'prettier';

@Controller('google')
export class GoogleController {
  constructor(
    private readonly userService: UserService,
    private readonly groupService: GroupService,
    private queuePublisher: RabbitMQ,
  ) { }

  @Get('signin')
  @UseGuards(GoogleOauthGuard)
  signIn() {
    // This route is protected by Google authentication
    // NestJS will automatically redirect the user to Google for authentication
  }

  @Get('callback')
  @UseGuards(GoogleOauthGuard)
  async callback(@Req() req: Request, @Res() res: Response) {
    // This route is protected by Google authentication
    // NestJS will automatically redirect the user to Google for authentication
    let loggedinUser = null;
    if (req.cookies['associate_jwt']) {
      loggedinUser = decodeJWT(req.cookies['associate_jwt']);
    }
    const googleUser = this.getGoogleUser(req);

    console.log('google callback', googleUser.user.profile.id, loggedinUser);
    const existingUserwithGoogleId = await this.userService.findOne({
      'ext.googleid': googleUser?.user?.profile?.id,
    });

    if (loggedinUser) {
      res.clearCookie('associate_jwt');
      if (existingUserwithGoogleId) {
        if (loggedinUser.sub != existingUserwithGoogleId.sub) {
          sendErrorMessage(
            res,
            'You are already logged in with a different account. Please logout and try again.',
          );
          return res.redirect(settingsCallback);
        }
        sendErrorMessage(res, ACCOUNT_ALREADY_ASSOCIATED_ERROR('Google'));
        return res.redirect(settingsCallback);
      }

      const user = await this.userService.findOnebySub(loggedinUser.sub);
      if (user.ext.googleid) {
        sendErrorMessage(res, ACCOUNT_ALREADY_ASSOCIATED_ERROR('Google'));
        return res.redirect(settingsCallback);
      }

      user.ext.googleid = googleUser.profile.id;
      await this.userService.updatebySub(user.sub, user);
      sendSuccessMessage(res, 'Successfully associated Google account.');
      return res.redirect(settingsCallback);
    }

    if (!loggedinUser && !existingUserwithGoogleId) {
      this.registerNewUser(googleUser.profile, res);
      return;
    }

    if (!loggedinUser && existingUserwithGoogleId) {
      const userInactive = checkUser(existingUserwithGoogleId, req).message;
      if (userInactive) {
        return Error(userInactive.message);
      }
      const claim = await createClaim(
        existingUserwithGoogleId,
        this.userService,
        this.groupService,
      );

      existingUserwithGoogleId.times.google_login = new Date();
      existingUserwithGoogleId.reqHeaders = req.headers;
      await this.userService.updatebySub(
        existingUserwithGoogleId.sub,
        existingUserwithGoogleId,
      );


      this.queuePublisher.publishToQueue(
        'user.login' + existingUserwithGoogleId.sub,
        JSON.stringify({
          type: 'google',
          username: existingUserwithGoogleId.username,
          exp: claim.exp,
          headers: req.headers,
        }),
      );

      const jwt = signJWT(claim);
      res.redirect(successUrl + jwt);
    }
  }

  registerNewUser(profile: any, res: Response) {
    const ext = {
      googleid: profile.id,
    };
    const _default = {
      fullname: profile.displayName,
    };
    const temp_jwt = signJWT({ exp: (Date.now() + ttl) / 1000, ext, _default });
    console.info('signed temporary jwt token for github signup:' + temp_jwt);
    // res.redirect('/auth/#!/signup/'+temp_jwt);
    res.redirect('/auth/#!/signup/' + temp_jwt);
  }

  @Get('associate/:jwt')
  // @UseGuards(GoogleOauthGuard)
  async associate(
    @Res({ passthrough: true }) res: Response,
    @Param('jwt') jwt: string,
  ) {
    console.log('--------GOOGLE associate--------');
    try {
      const decodedToken = decodeJWT(jwt);
      if (!decodedToken) throw new Error('Invalid token');

      const user = await this.userService.findOne({ sub: decodedToken.sub });
      if (!user)
        throw new Error(
          "Couldn't find user record with sub:" + decodedToken.sub,
        );

      res.cookie('associate_jwt', jwt, cookieConfig);
      console.log('--------GOOGLE cookie SET--------');
      res.redirect('/api/auth/google/signin');
    } catch (e) {
      res.status(401).send(e.message);
    }
  }

  @Put('disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnectGithub(@Req() req: Request, @Res() res: Response) {
    const userParsed = req.user as User;
    const user = await this.userService.findOnebySub(userParsed.sub);
    if (!user)
      throw new Error("Couldn't find user record with sub:" + userParsed.sub);
    user.ext.googleid = null;
    await this.userService.updatebySub(user.sub, user);
    return res.json({
      message: 'Successfully disconnected google account.',
      user: user,
    });
  }

  getGoogleUser(req: Request): any {
    const googleUser = req.user as any;
    if (googleUser) googleUser.profile = googleUser.user.profile;
    return googleUser;
  }
}
