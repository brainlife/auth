import { Body, Controller, HttpCode, Post, Res } from "@nestjs/common";
import {UserService} from '../users/user.service';
import { error } from "console";
import { HttpErrorByCode } from "@nestjs/common/utils/http-error-by-code.util";

import { HttpException, HttpStatus } from "@nestjs/common";

@Controller('/')
export class SignupController {

    constructor(private readonly userService: UserService) {}
    @Post('signup')
    async create(@Body() {email,username,password,profile} ) {

        //validate email
        if(!email) throw new HttpException("Please provide an email address", HttpStatus.BAD_REQUEST)
        if(!email.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/))
        throw new HttpException("Please provide a valid email address", HttpStatus.BAD_REQUEST)

        //validate username
        if(!username) throw new HttpException("Please provide a username", HttpStatus.BAD_REQUEST)

        //validate password
        if(!password) throw new HttpException("Please provide a password", HttpStatus.BAD_REQUEST)

        //check for existing user
        let user = await this.userService.findByUsername(username);
        if(user) throw new HttpException("The username you chose is already registered. If it is yours, please try signing in, or register with a different username.", HttpStatus.BAD_REQUEST);
        user = await this.userService.findByEmail(email);
        if(user) throw new HttpException("The email address you chose is already registered. If it is yours, please try signing in, or register with a different email address.", HttpStatus.BAD_REQUEST);
        
        const response = await this.userService.createUser(email, username, password, profile);
        return response;
    }
}