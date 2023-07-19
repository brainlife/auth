import { HttpException, Injectable, HttpStatus } from '@nestjs/common';
import { UserService } from '../users/user.service';
import { checkPassword } from 'src/utils/common.utils';
import { queuePublisher,checkUser,signJWT } from 'src/utils/common.utils';
import { RedisService } from '../redis/redis.service';
import { FailedLoginService } from 'src/failedLogins/failedLogin.service'; 
import { FailedLogin } from 'src/schema/failedLogin.schema';
import { CreateFailedLoginDto } from 'src/dto/create-failedLogin.dto';
import { use } from 'passport';
@Injectable()
export class AuthService {
  constructor(private userService: UserService,
    private readonly redisService: RedisService,
    private readonly failedLoginService: FailedLoginService
    ) {}

  async validateUser(usernameOrEmail: string, pass: string,req:any): Promise<any> {

    const user = await this.userService.findOne({
      $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
    });

    if (!user) {
      return { message: 'Incorrect email or username', code: 'bad_username' }
    }

    if (!user.password_hash) return { 
      message: 'Password login is not enabled for this account (please try 3rd party authentication)', 
      code: 'no_password' 
    }

    const fails = await this.redisService.get("auth.fail."+user.username+".*");
    if(fails && fails.length > 3) return { message: 'Account Locked ! Try after an hour' }

    const passwordMatch = await checkPassword(pass, user.password_hash);
    
    if(!passwordMatch) return { message: 'Incorrect user/password', code: 'bad_password' }

    return user;

    // const user = await this.userService.findOne({
    //   $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
    // });
    // console.log('User found', user);
    // if (!user) {
    //   throw new HttpException('User not found', HttpStatus.NOT_FOUND); // here
    // }

    // const passwordMatch = await checkPassword(pass, user.password_hash);

    // if (!passwordMatch) {
      
    //   const publishMessage = {type: "userpass", headers: req.headers, message: "Invalid credentials", username: user.username}; // need to confirm the message
    //   queuePublisher.publishToQueue("user.login_fail", publishMessage.toString());
    //   this.redisService.set("auth.fail."+user.username+"."+(new Date().getTime()), "failedLogin", 3600); 
    //   throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED); // need to confirm the message
    // }

    // // should I change implementation of checkUser to return a boolean?
    // const status = checkUser(user,req)
    // if(status && status.message) {
      
    //   const userDocument = user as any;

    //   let failedLogin: CreateFailedLoginDto = {
    //     username: user.username, // Add this
    //     user_id: userDocument._id.toString(), // And this
    //     code: status.code, 
    //     headers: req.headers,
    //     create_date: new Date() // And this
    //   }
    
    //   await this.failedLoginService.create(failedLogin);
    //   console.log("Failed login created", failedLogin);
    //   throw new HttpException(status.message, HttpStatus.UNAUTHORIZED); 
    // }

    // //TODO implement create claim 
    // console.log('User validated', user);
    //     //TODO implement to use claim
    //     // convert user to object

    // const jwt = signJWT({...user});
    // if(!user.times) user.times = {};
    // user.times.last_login = new Date();
    // user.reqHeaders = req.headers;
    // await this.userService.updatebySub(user.sub, user);
    
    // // queuePublisher.publishToQueue("user.login."+user.sub, {type: "userpass", username: user.username, exp: claim.exp, headers: req.headers});

    // return {message: "Login Success", jwt, sub: user.sub};
  }
}

