import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { UserService } from '../users/user.service';
import { Inject } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { hashPassword, sendEmailConfirmation , sendPasswordReset } from '../utils/common.utils';
import { Response, Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../auth/auth.service';

@Controller('/local')

export class LocalController {
    constructor(
        private readonly userService: UserService,
        @Inject('RABBITMQ_SERVICE') private readonly client: ClientProxy,
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
    console.error('localLogin', email);
    return req.user;
  }


}