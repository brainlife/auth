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
import { github, settingsCallback, ttl } from '../auth/constants';
import { GithubOauthGuard } from '../auth/guards/oauth.guards';
import { RabbitMQ } from '../rabbitmq/rabbitmq.service';

@Controller('github')
export class GithubController {
  constructor(
    private readonly userService: UserService,
    private readonly groupService: GroupService,
    private publishToQueue: RabbitMQ,
  ) {}

  @Get('signin')
  @UseGuards(AuthGuard('github'))
  signIn() {
    // This route is protected by GitHub authentication
    // NestJS will automatically redirect the user to GitHub for authentication
  }

  //this will redirect them on error to
  // res.redirect('/auth/#!/signin?msg='+"Failed to authenticate");
  @Get('callback')
  @UseGuards(GithubOauthGuard)
  async callback(@Req() req: Request, @Res() res: Response) {
    // This route is protected by GitHub authentication
    // NestJS will automatically redirect the user to GitHub for authentication

    // TODO NEEDS DISCUSSION
    //req.user is usually parsed by jwt guard
    //but in this case, we are using github oauth guard which doesn't parse jwt but wraps
    //user object inside req.user.user

    // but we see that the original api uses cookie and uses it to parse jwt

    const {
      user: { user: userParsedfromGithub, profile },
    } = req.user as any;

    let userParsedfromCookie = null;
    if (req.cookies['associate_jwt'])
      userParsedfromCookie = decodeJWT(req.cookies['associate_jwt']);
    console.log('github callback', userParsedfromGithub);

    if (userParsedfromCookie) {
      res.clearCookie('associate_jwt');
      if (userParsedfromGithub) {
        const messages = [
          {
            type: 'error',
            message:
              'Your github account is already associated to another account. Please signoff / login with your github account.',
          },
        ];
        res.cookie('messages', JSON.stringify(messages), { path: '/' });
        return res.redirect(settingsCallback);
      }
      const userRecord = await this.userService.findOne({
        sub: userParsedfromCookie.sub,
      });
      if (!userRecord)
        throw new Error(
          "couldn't find user record with sub:" + userParsedfromCookie.sub,
        );
      userRecord.ext.github = profile.id;
      await this.userService.updatebySub(userRecord.sub, userRecord);
      // should i implement some method - DRY !! ??
      const messages = [
        {
          type: 'success',
          message: 'Successfully associated your github account',
        },
      ];
      res.cookie('messages', JSON.stringify(messages), { path: '/' });
      return res.redirect(settingsCallback);
    } else {
      if (!userParsedfromGithub) {
        if (github.autoRegister) this.registerNewUser(profile, res);
        else {
          res.redirect(
            '/auth/#!/signin?msg=' +
              'Your github account is not yet registered. Please login using your username/password first, then associate your github account inside account settings.',
          );
        }
        return;
      }
      if (checkUser(userParsedfromGithub, req)?.message)
        return new Error(checkUser(userParsedfromGithub, req).message);
      const claim = await createClaim(
        userParsedfromGithub,
        this.userService,
        this.groupService,
      );
      userParsedfromGithub.times.github_login = new Date();
      userParsedfromGithub.reqHeaders = req.headers;
      await this.userService.updatebySub(
        userParsedfromGithub.sub,
        userParsedfromGithub,
      );
      this.publishToQueue.publishToQueue(
        'user.login.' + userParsedfromGithub.sub,
        JSON.stringify({
          sub: userParsedfromGithub.sub,
          source: 'github',
          reqHeaders: req.headers,
        }),
      );
      const jwt = signJWT(claim);
      res.redirect('/auth/#!/success/' + jwt);
    }
  }

  registerNewUser(profile: any, res: Response) {
    const ext = { github: profile.id };
    console.log('on registerNewUser', profile);
    const _default: any = {
      username: profile.username, //default to github username.. (user can change it)
      fullname: profile.displayName,
    };
    if (profile.emails && profile.emails[0])
      _default.email = profile.emails[0].value; //some user doesn't have email in profile..

    const temp_jwt = signJWT({ exp: (Date.now() + ttl) / 1000, ext, _default });
    console.info('signed temporary jwt token for github signup:' + temp_jwt);
    // res.redirect('/auth/#!/signup/'+temp_jwt);
    res.redirect('/auth/#!/signup/' + temp_jwt);
  }

  @Get('associate/:jwt')
  @UseGuards(AuthGuard('github'))
  async associateWithGithub(@Param('jwt') jwt: string, @Res() res: Response) {
    try {
      const decodedToken = decodeJWT(jwt);
      // Do any further checks if necessary, for example, you might check if a user exists in your system
      const user = await this.userService.findOne({ sub: decodedToken.sub });
      if (!user) throw new Error('User not found');

      res.cookie('associate_jwt', jwt, {
        httpOnly: true,
        secure: true,
        maxAge: 1000 * 60 * 5, //5 minutes
      });
      // This is where you'd typically continue with the GitHub association process...
      this.signIn();
    } catch (error) {
      // Handle errors from the JWT decoding process, for example:
      res.status(401).send({ error: 'Invalid or expired token' });
    }
  }

  //uses param based jwt
  @Put('disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnectGithub(@Req() req, @Res() res) {
    const user = await this.userService.findOnebySub(req.user.sub);
    if (!user)
      throw new Error("couldn't find user record with sub:" + req.user.sub);
    user.ext.github = null;
    await this.userService.updatebySub(user.sub, user);
    return res.json({
      message: 'Successfully disconnected github account.',
      user: user,
    });
  }
}
