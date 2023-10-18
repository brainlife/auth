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
    console.log('signin github');
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
    //TODO NEEDS DISCUSSION
    //req.user is usually parsed by jwt guard
    //but in this case, we are using github oauth guard which doesn't parse jwt but wraps
    //user object inside req.user.user
    // Case 1 : user is already logged in (with jwt) and trying to associate github account with brainlife account (associate) from the account page -> associate it and point to account page
    console.log("JWT", req.cookies.associate_jwt);
    console.log("------------------------------------------------");
    if (req.user) {
      console.log('logged in user', req.user);
    }
    // Case 2 : user is not logged in and trying to login with github account and has no account in brainlife (register) will point to register page
    // Case 3 : if user has already an account linked in brainlife, it will just login and point to home page
    // Case 4 : user A is already logged in (with local) and trying to associate github, but the github account it already associated to a brainlife user B it should send an error
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

      console.log('setting Cookie');
      res.cookie('associate_jwt', jwt, {
        httpOnly: false,
        // secure: true,
        maxAge: 1000 * 60 * 5, //5 minutes
      });

      // confirm the cookie is set
      console.log('cookie SET', res.cookie);
      // This is where you'd typically continue with the GitHub association process...
      // After setting cookies, manually redirect to GitHub for authentication
      // Handle errors from the JWT decoding process, for example:

      // redirect to github for authentication where it goes to callback

      res.redirect('/api/auth/github/signin');
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
    user.ext.github = null;
    await this.userService.updatebySub(user.sub, user);
    return res.json({
      message: 'Successfully disconnected github account.',
      user: user,
    });
  }
}
