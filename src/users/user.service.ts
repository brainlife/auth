import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CreateUserDto } from "../dto/create-user.dto";
import { UpdateUserDto } from "../dto/update-user.dto";
import { HttpErrorByCode } from "@nestjs/common/utils/http-error-by-code.util";
import { HttpException, HttpStatus } from "@nestjs/common";

import { Inject } from '@nestjs/common';

import { User, UserDocument } from "../schema/user.schema";
import { commandOptions } from "redis";
import  {hashPassword, publishToQueue, sendEmailConfirmation, signJWT } from '../utils/common.utils';
import { ClientProxy } from '@nestjs/microservices';
import e from "express";

@Injectable()
export class UserService {

    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @Inject('RABBITMQ_SERVICE') private client: ClientProxy,
      ) {}

    async create(createUserDto: CreateUserDto): Promise<User> {
        const User = new this.userModel(createUserDto);
        return User.save();
    }

    async createUser(email: string, username: string, password: string, profile: string) {
        const sub =  await this.findNextSub();

        const password_hash = hashPassword(password);

        if (password_hash.message) {
            throw new HttpException(password_hash.message, HttpStatus.BAD_REQUEST);
        }

        const User = await new this.userModel({sub, email, username, password_hash , profile,scopes: {
            brainlife: ["user"],
        },times: {register: new Date()}}).save();

        publishToQueue(this.client,'user.create.'+sub, User.toJSON())
        
        // then(() => {
        //     console.log("published user.create."+sub);
        // }).catch(e => {
        //     console.error("failed to publish user.create."+sub);
        //     throw new HttpException("Failed to publish user.create."+sub, HttpStatus.BAD_REQUEST);
        // });
        
        if(process.env.EMAIL_ENABLED == "true") {
            console.log("sending email confirmation");
            sendEmailConfirmation(User).catch(e => {
                if(User) {
                    this.removebySub(sub);
                    console.error("removed newly registred record - email failurer");
                    throw new HttpException("Failed to send confirmation email. Please make sure your email address is valid", HttpStatus.BAD_REQUEST);
                } else {
                    throw new HttpException("Failed to send confirmation email. Please make sure your email address is valid", HttpStatus.BAD_REQUEST)
                } 
            });

        } else {
            console.log("email confirmation disabled",process.env.EMAIL_ENABLED);
            // create Claim 
            let jwt = signJWT(User);
            return ({jwt:jwt, sub: sub});
        }
        return User;
    }

    async findAll(): Promise<User[]> {
        return this.userModel.find().exec();
    }

    async findOnebyId(id: number): Promise<User> {
        return this.userModel.findById(id).exec();
    }

    async findOnebySub(sub: number): Promise<User> {
        return this.userModel.findOne({sub}).exec();
    }

    async findByEmail(email: string): Promise<User> {
        return this.userModel.findOne({email: email}).exec();
    }

    async findByUsername(username: string): Promise<User> {
        return this.userModel.findOne({username: username}).exec();
    }

    async updatebyID(id: number, updateUserDto: UpdateUserDto): Promise <UserDocument> {
        return this.userModel.findByIdAndUpdate(id, updateUserDto);
    }

    async updatebySub(sub: number, updateUserDto: UpdateUserDto): Promise <UserDocument> {
        return this.userModel.findOneAndUpdate({sub}, updateUserDto);
    }

    async removebyID(id: number): Promise<User> {
        return this.userModel.findByIdAndRemove(id);
    }

    async removebySub(sub: number): Promise<User> {
        return this.userModel.findOneAndRemove({sub: sub});
    }

    async findNextSub(): Promise<number> {
        const lastUser: User = await this.userModel.findOne({}).sort('-_id').exec();
        if (!lastUser) return 1;
        return lastUser.sub + 1;
    }
}