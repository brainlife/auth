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
} from '../utils/common.utils';
import { github, google, settingsCallback, ttl } from '../auth/constants';
import { GoogleOauthGuard } from '../auth/guards/oauth.guards';
import { User } from '../schema/user.schema';

@Controller('google')
export class GoogleController {
  constructor(
    private readonly userService: UserService,
    private readonly groupService: GroupService,
  ) {}

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
    const {
      user: { user: userParsedfromGoogle, profile },
    } = req.user as any;

    let userParsedfromCookie = null;
    if (req.cookies['associate_jwt'])
      userParsedfromCookie = decodeJWT(req.cookies['associate_jwt']);
    console.log('github callback', userParsedfromGoogle);

    if (userParsedfromCookie) {
      res.clearCookie('associate_jwt');
      if (userParsedfromGoogle) {
        const messages = [
          {
            type: 'error',
            message:
              'Your github account is already associated to another account. Please signoff / login with your github account.',
          },
        ];
        res.cookie('messages', JSON.stringify(messages), { path: '/' });
        res.redirect('/auth/#!/signin');
        return;
      }
      const userRecord = await this.userService.findOne({
        sub: userParsedfromCookie.sub,
      });
      if (!userRecord)
        throw new Error(
          "Couldn't find user record with sub:" + userParsedfromCookie.sub,
        );
      userRecord.profile = profile;
      await this.userService.updatebySub(userRecord.sub, userRecord);
      res.redirect(settingsCallback);
    } else {
      if (!userParsedfromGoogle) {
        if (google.autoRegister) this.registerNewUser(profile, res);
        else {
          res.redirect(
            '/auth/#!/signin?msg=' +
              'Your github account is not yet registered. Please login using your username/password first, then associate your github account inside account settings.',
          );
        }
        return;
      }
      if (checkUser(userParsedfromGoogle, req)?.message)
        return new Error(checkUser(userParsedfromGoogle, req).message);

      checkUser(userParsedfromGoogle, req).message;
      const claim = await createClaim(
        userParsedfromGoogle,
        this.userService,
        this.groupService,
      );
      userParsedfromGoogle.times.google_login = new Date();
      userParsedfromGoogle.reqHeaders = req.headers;
      await this.userService.updatebySub(
        userParsedfromGoogle.sub,
        userParsedfromGoogle,
      );
      const jwt = signJWT(claim);
      res.redirect('/auth/#!/success/' + jwt);
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
    res.redirect('http://localhost:8080/auth/#!/signup/' + temp_jwt);
  }

  @Get('associate/:jwt')
  @UseGuards(GoogleOauthGuard)
  async associate(
    @Req() req: Request,
    @Res() res: Response,
    @Param('jwt') jwt: string,
  ) {
    try {
      const decodedToken = decodeJWT(jwt);
      if (!decodedToken) throw new Error('Invalid token');

      const user = await this.userService.findOne({ sub: decodedToken.sub });
      if (!user)
        throw new Error(
          "Couldn't find user record with sub:" + decodedToken.sub,
        );

      res.cookie('associate_jwt', jwt, {
        httpOnly: true,
        secure: true,
        maxAge: 1000 * 60 * 5, //5 minutes
      });

      this.signIn();
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
}
