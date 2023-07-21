import { Body, Controller, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import { UserService } from '../users/user.service';
import { Inject } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { hashPassword, signJWT, sendEmailConfirmation , createClaim, sendPasswordReset, queuePublisher, checkUser, checkPassword } from '../utils/common.utils';
import { Response, Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../auth/auth.service';
import { RedisService } from 'src/redis/redis.service';
import { FailedLoginService } from 'src/failedLogins/failedLogin.service';
import { CreateFailedLoginDto } from 'src/dto/create-failedLogin.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { GroupService } from 'src/groups/group.service';

@Controller('/local')
export class LocalController {
    constructor(
        private readonly userService: UserService,
        @Inject('RABBITMQ_SERVICE') private readonly client: ClientProxy,
        private redisService: RedisService,
        private groupService: GroupService,
        private failedLoginService: FailedLoginService,
      ) {}

  /**
 * @api {post} /local/resetpass Handle both resetpass request and fulfillment request
 * @apiName LocalAuth
 * @apiDescription  (mode 1)
 *                  When this API is called with email field, it will create reset token associated with the owner of the email address 
 *                  and send reset request email with the token on the URL. While doing so, it sets httpOnly cookie with random string
 *                  to be stored on user's browser.
 *                  (mode 2)
 *                  When user receives an email, click on the URL, it will open /forgotpass page which then provide user password reset form.
 *                  The form then submits token, and new password along with the httpOnly cookie back to this API which will then do the
 *                  actual resetting of the password, and clear the password_reset_token.
 * @apiGroup Local
 *
 * @apiParam {String} email     (mode1) User's email address registere.
 * @apiParam {String} token     (mode2) User's password reset token
 * @apiParam {String} password  (mode2) User's new password
 * @apiParam {String} password_reset (mode2) [via cookie] browser secret token to verify user is using the same browser to reset password
 *
 * @apiSuccess {Object} message Containing success message
 */
  @Post('/resetpass')
  async resetPass(@Req() request: Request, @Res() res: Response, @Body() { email, token, password}) {
      
      if(email) {
        let user = await this.userService.findByEmail(email);
        if(!user) {
          throw new HttpException(
            'Invalid email address',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
        user.password_reset_token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2);
        user.password_reset_cookie = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2);

        await this.userService.updatebySub(user.sub, user);
        if (process.env.EMAIL_ENABLED == 'true') {
          await sendPasswordReset(user);
        }
        res.cookie('password_reset', user.password_reset_cookie, {httpOnly: true, secure: true}); //should be default to session cookie
        res.json({message: "Reset token sent"});
      } else {
        
        if(!token || !password || !request.cookies) {
          throw new HttpException(
            'Invalid token',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
        let user = await this.userService.findOne({ password_reset_token: token });
    
        if(!user) {
          throw new HttpException(
            'Couldn\'t find the token provided.',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        const hashedPassword = await hashPassword(password)
        if(hashedPassword.message) {
          throw new HttpException(
            hashedPassword.message,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        user.password_hash = hashedPassword;
        user.password_reset_token = null;
        user.password_reset_cookie = null;

        if(!user.times) user.times = {};
        user.times.reset_password = new Date();
        await this.userService.updatebySub(user.sub, user);
        return res.json({ message: 'Password reset successfully'});
      }
  }

  /**
 * @api {post} /local/auth Perform authentication
 * @apiName LocalAuth
 * @apiDescription Perform authentication using username(or email) and password get JWT token.
 * @apiGroup Local
 *
 * @apiParam {String} username Username or email address
 * @apiParam {String} password Password!
 * @apiParam {String} [ttl]    time-to-live in milliseconds (if not set, it will be defaulted to server default)
 *
 * @apiSuccess {Object} jwt JWT token
 */
  @UseGuards(AuthGuard('local'))
  @Post('/auth')
  async localLogin(@Req() req, @Res() res, @Body() { ttl,email, password }) {
    // if some error

    //TODO: discuss to improve it to use username or email while publishing message
    if(req.user.message) {
      // publish to rabbitmq
      const publishMessage = {type: "userpass", headers: req.headers, message: "Invalid credentials", username: req.body.username}; // need to confirm the message
      queuePublisher.publishToQueue("user.login_fail", publishMessage.toString());
      //set redis failure to lock account
      await this.redisService.set("auth.fail."+req.body.username+"."+(new Date().getTime()), "failedLogin", 3600); // 1 hour
      return res.status(403).json({status: 403,message: req.user.message});
    }
    const user = req.user;
    //TODO should i move it to local strategy ? 
    const status = checkUser(user,req)
    if(status && status.message) {
      // failedLoginstep
      const userDocument = user as any;
      let failedLogin: CreateFailedLoginDto = {
        username: user.username, // Add this
        user_id: userDocument._id.toString(), // And this
        code: status.code, 
        headers: req.headers,
        create_date: new Date() // And this
      }
    
      await this.failedLoginService.create(failedLogin);
      console.log("Failed login created", failedLogin);
      throw new HttpException(status.message, HttpStatus.UNAUTHORIZED);
    }
    
    //create claim
    
    let claim = await createClaim(user, this.userService, this.groupService);
    if(ttl) claim.exp = Math.floor(Date.now() / 1000) + ttl;
    
    const jwt = signJWT(claim);

    if(!user.times) user.times = {};
    user.times.last_login = new Date();
    user.reqHeaders = req.headers;
    await this.userService.updatebySub(user.sub, user);
    
    // queuePublisher.publishToQueue("user.login."+user.sub, {type: "userpass", username: user.username, exp: claim.exp, headers: req.headers});

    return res.json({message: "Login Success", jwt, sub: user.sub});
  }


  @UseGuards(JwtAuthGuard)
  @Put('/setpass')
  async setPass(@Req() req, @Res() res, @Body() { password, password_old }) {
    const userPayload = req.user._doc;
    const user = await this.userService.findOnebySub(req.user.sub);
    if(!user) {
      throw new HttpException(
        'failed to find the user with sub:'+req.user.sub,
        HttpStatus.NOT_FOUND,
      );
    }
    if(user.password_hash) {
      // check current password
      if(!checkPassword(password_old, user.password_hash)) {
        queuePublisher.publishToQueue("user.setpass_fail."+user.sub, 
        {username: user.username, message: "wrong current pass"}.toString());
        throw new HttpException(
          'Wrong current password',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const hashedPassword = await hashPassword(password)
      if(hashedPassword.message) {
        throw new HttpException(
          hashedPassword.message,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      user.password_hash = hashedPassword;
      if(!user.times) user.times = {};
      user.times.password_reset_token = new Date();
      await this.userService.updatebySub(user.sub, user);
      res.json({message: "Password reset successfully"});
    }
  }


}