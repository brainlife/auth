import { Body, Controller, Post } from '@nestjs/common';
import { UserService } from '../users/user.service';
import { Inject } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { sendEmailConfirmation } from '../utils/common.utils';

@Controller('/')
export class RootController {
  constructor(
    private readonly userService: UserService,
    @Inject('RABBITMQ_SERVICE') private readonly client: ClientProxy,
  ) {}

  @Post('signup')
  async create(@Body() { email, username, password, profile }) {
    //validate email
    if (!email)
      throw new HttpException(
        'Please provide an email address',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    if (!email.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/))
      throw new HttpException(
        'Please provide a valid email address',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

    //validate username
    if (!username)
      throw new HttpException(
        'Please provide a username',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

    //validate password
    if (!password)
      throw new HttpException(
        'Please provide a password',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

    //check for existing user
    let user = await this.userService.findByUsername(username);
    if (user)
      throw new HttpException(
        'The username you chose is already registered. If it is yours, please try signing in, or register with a different username.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    user = await this.userService.findByEmail(email);
    if (user)
      throw new HttpException(
        'The email address you chose is already registered. If it is yours, please try signing in, or register with a different email address.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

    const response = await this.userService.createUser(
      email,
      username,
      password,
      profile,
    );

    return response;
  }

  @Post('/send_email_confirmation')
  async sendEmailConfirmation(@Body() { sub }) {
    const user = await this.userService.findOnebySub(sub);
    if (user.email_confirmed) {
      throw new HttpException(
        'Email already confirmed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (process.env.EMAIL_ENABLED == 'true') {
      await sendEmailConfirmation(user);
    } else {
      throw new HttpException(
        "referer not set.. can't send confirmation", //'Email confirmation disabled',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      message:
        'Sent confirmation email with subject ' +
        process.env.EMAIL_CONFIRM_SUBJECT,
    };
  }

  @Post('/confirm_email')
  async confirmEmail(@Body() { token }) {
    const user = await this.userService.findOne({ email_confirm_token: token });
    if (!user) {
      throw new HttpException(
        'Invalid token',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    console.log(user);
    if (user.email_confirmed == true) {
      throw new HttpException(
        'Email already confirmed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    user.email_confirmed = true;
    user.times.confirm_email = new Date();
    await this.userService.updatebySub(user.sub, user);
    return { message: 'Email address confirmed! Please re-login.' };
  }

}
