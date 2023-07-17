import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { HttpException, HttpStatus } from '@nestjs/common';

import { Inject } from '@nestjs/common';

import { User, UserDocument } from '../schema/user.schema';
import {
  hashPassword,
  queuePublisher,
  sendEmailConfirmation,
  signJWT,
  authDefault,
} from '../utils/common.utils';
import { ClientRMQ } from '@nestjs/microservices';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @Inject('RABBITMQ_SERVICE') private client: ClientRMQ,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const User = new this.userModel(createUserDto);
    return User.save();
  }

  async createUser(
    email: string,
    username: string,
    password: string,
    profile: string,
  ) {
    const sub = await this.findNextSub();

    const password_hash = hashPassword(password);

    if (password_hash.message) {
      throw new HttpException(password_hash.message, HttpStatus.BAD_REQUEST);
    }

    const User = await new this.userModel({
      sub,
      email,
      username,
      password_hash,
      profile,
      ...authDefault,
      times: { register: new Date() },
    }).save();

    console.log('User created', User);

    queuePublisher.publishToQueue(
      'user.create.' + sub,
      User.toJSON().toString(),
    );

    if (process.env.EMAIL_ENABLED == 'true') {
      console.log('sending email confirmation');
      // send email confirmation and check for errors
      await sendEmailConfirmation(User).catch((e) => {
        console.log('email confirmation error', e);
      });
    } else {
      console.log('email confirmation disabled', process.env.EMAIL_ENABLED);
      // create Claim
      const jwt = signJWT(User);
      return { jwt: jwt, sub: sub };
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
    return this.userModel.findOne({ sub }).exec();
  }

  async findByEmail(email: string): Promise<User> {
    return this.userModel.findOne({ email: email }).exec();
  }

  async findByUsername(username: string): Promise<User> {
    return this.userModel.findOne({ username: username }).exec();
  }

  async findOne(query: any): Promise<User> {
    return this.userModel.findOne(query).exec();
  }

  async updatebyID(
    id: number,
    updateUserDto: UpdateUserDto,
  ): Promise<UserDocument> {
    return this.userModel.findByIdAndUpdate(id, updateUserDto);
  }

  async updatebySub(
    sub: number,
    updateUserDto: UpdateUserDto,
  ): Promise<UserDocument> {
    return this.userModel.findOneAndUpdate({ sub }, updateUserDto);
  }

  async removebyID(id: number): Promise<User> {
    return this.userModel.findByIdAndRemove(id);
  }

  async removebySub(sub: number): Promise<User> {
    return this.userModel.findOneAndRemove({ sub: sub });
  }

  async findNextSub(): Promise<number> {
    const lastUser: User = await this.userModel.findOne({}).sort('-_id').exec();
    if (!lastUser) return 1;
    return lastUser.sub + 1;
  }
}
