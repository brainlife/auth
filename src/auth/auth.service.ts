import { HttpException, Injectable } from '@nestjs/common';
import { UserService } from '../users/user.service';
import { checkPassword } from 'src/utils/common.utils';

@Injectable()
export class AuthService {
  constructor(private userService: UserService) {}

  async validateUser(usernameOremail: string, pass: string): Promise<any> {
    const user = await this.userService.findOne({
        $or: [{ username: usernameOremail }, { email: usernameOremail }],
    });
    console.log('User found', user);
    if(!user) new HttpException('User not found', 500);

    const passwordMatch = await checkPassword(pass, user.password_hash);

    if(!passwordMatch) new HttpException('Password does not match', 500);
    
    console.log('User validated', user);
    return user;
    }
}
