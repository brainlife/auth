import { Controller } from '@nestjs/common';
import { Get, UseGuards, Param, Put } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { UserService } from '../users/user.service';
import { GroupService } from '../groups/group.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  checkUser,
  decodeJWT,
  createClaim,
  signJWT,
  sendErrorMessage,
  sendSuccessMessage,
  ACCOUNT_ALREADY_ASSOCIATED_ERROR,
} from '../utils/common.utils';
import {
  cookieConfig,
  github,
  githubSigninUrl,
  settingsCallback,
  signUpUrl,
  successUrl,
  ttl,
} from '../auth/constants';
import { GithubOauthGuard } from '../auth/guards/oauth.guards';
import { RabbitMQ } from '../rabbitmq/rabbitmq.service';

@Controller('github')
export class GithubController {
  constructor(
    private readonly userService: UserService,
    private readonly groupService: GroupService,
    private publishToQueue: RabbitMQ,
  ) // eslint-disable-next-line prettier/prettier
  ) { }

  @Get('signin')
  @UseGuards(AuthGuard('github'))
  signIn() {
    console.log('signin github');
    // This route is protected by GitHub authentication
    // NestJS will automatically redirect the user to GitHub for authentication
  }

  //this will redirect them on error to
  // res.redirect('/auth/#!/signin?msg='+"Failed to authenticate");
  @Get('callback')
  @UseGuards(GithubOauthGuard)
  async callback(@Req() req: Request, @Res() res: Response) {
    let loggedinUser = null;
    if (req.cookies.associate_jwt) {
      loggedinUser = decodeJWT(req.cookies.associate_jwt) as any;
    }
    const githubUser = this.getGithubUser(req);

    const existingUserWithGithubId = await this.userService.findOne({
      'ext.github': githubUser?.user?.profile?.id,
    });

    //CASE 1 : User trying to associate GitHub account while already logged in
    if (loggedinUser) {
      res.clearCookie('associate_jwt');

      if (existingUserWithGithubId) {
        if (loggedinUser.sub != existingUserWithGithubId?.sub) {
          // logged in user and github user are different
          sendErrorMessage(
            res,
            'You are already logged in with a different account. Please logout and try again.',
          );
          return res.redirect(settingsCallback);
        }
        sendErrorMessage(res, ACCOUNT_ALREADY_ASSOCIATED_ERROR('github'));
        return res.redirect(settingsCallback);
      }
      const user = await this.userService.findOnebySub(loggedinUser.sub);
      if (user.ext.github) {
        sendErrorMessage(res, ACCOUNT_ALREADY_ASSOCIATED_ERROR('github'));
        return res.redirect(settingsCallback);
      }
      user.ext.github = githubUser.profile.id;
      await this.userService.updatebySub(user.sub, user);
      sendSuccessMessage(res, 'Successfully associated github account.');
      return res.redirect(settingsCallback);
    }

    //User trying to register with GitHub account
    if (!loggedinUser && !existingUserWithGithubId) {
      this.registerNewUser(githubUser.user.profile, res);
      return;
    }

    //User has an account linked in Brainlife and is trying to login with GitHub
    if (!loggedinUser && existingUserWithGithubId) {
      const user = existingUserWithGithubId;
      const claim = await createClaim(
        user,
        this.userService,
        this.groupService,
      );
      const jwt = signJWT(claim);
      return res.redirect(successUrl + jwt);
    }
  }

  registerNewUser(profile: any, res: Response) {
    const ext = { github: profile.id };
    const _default: any = {
      username: profile.username, //default to github username.. (user can change it)
      fullname: profile.displayName,
    };
    if (profile.emails && profile.emails[0])
      _default.email = profile.emails[0].value; //some user doesn't have email in profile..

    const temp_jwt = signJWT({ exp: (Date.now() + ttl) / 1000, ext, _default });
    console.info('signed temporary jwt token for github signup:' + temp_jwt);
    res.redirect(signUpUrl + temp_jwt);
  }

  @Get('associate/:jwt')
  // @UseGuards(AuthGuard('github'))
  async associateWithGithub(
    @Param('jwt') jwt: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    // This route is protected by GitHub authentication
    // NestJS will automatically redirect the user to GitHub for authentication
    console.log('associateWithGithub', jwt);
    try {
      const decodedToken = decodeJWT(jwt);
      console.log('decodedToken', decodedToken);
      // Do any further checks if necessary, for example, you might check if a user exists in your system
      const user = await this.userService.findOne({ sub: decodedToken.sub });
      if (!user) throw new Error('User not found');
      res.cookie('associate_jwt', jwt, cookieConfig);

      // confirm the cookie is set
      console.log('cookie SET', res.cookie);
      // This is where you'd typically continue with the GitHub association process...
      // After setting cookies, manually redirect to GitHub for authentication
      // Handle errors from the JWT decoding process, for example:
      // redirect to github for authentication where it goes to callback
      res.redirect(githubSigninUrl);
    } catch (err) {
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
    user.ext.github = undefined;
    await this.userService.updatebySub(user.sub, user);
    return res.json({
      message: 'Successfully disconnected github account.',
      user: user,
    });
  }

  getGithubUser(req: Request): any {
    const githubUser = req.user as any;
    if (githubUser) githubUser.profile = githubUser.user.profile;
    return githubUser;
  }
}
