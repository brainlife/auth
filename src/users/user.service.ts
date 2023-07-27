import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { HttpException, HttpStatus } from '@nestjs/common';

import { User, UserDocument } from '../schema/user.schema';
import {
  hashPassword,
  queuePublisher,
  sendEmailConfirmation,
  signJWT,
  authDefault,
} from '../utils/common.utils';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

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
      const jwt = signJWT(User.toObject());
      return { jwt: jwt, sub: sub };
    }
    return User;
  }

  async findAll(
    find?: any,
    select?: any,
    sort?: any,
    limit?: number,
    skip?: number,
  ): Promise<User[]> {
    if (find) {
      let query = this.userModel.find(find).lean();
      if (select) query = query.select(select);
      if (sort) query = query.sort(sort);
      if (limit) query = query.limit(limit);
      if (skip) query = query.skip(skip);
      return query.exec();
    }
    return this.userModel.find().exec();
  }

  async findOnebyId(id: number): Promise<User> {
    return this.userModel.findById(id).exec();
  }

  async findOnebySub(sub: number, select?: any): Promise<User> {
    if (select) return this.userModel.findOne({ sub }).select(select).exec();
    return this.userModel.findOne({ sub }).exec();
  }

  async findByEmail(email: string): Promise<User> {
    return this.userModel.findOne({ email: email }).exec();
  }

  //no need ? Should I remove it ?
  // async findByUsername(username: string): Promise<User> {
  //   return this.userModel.findOne({ username: username }).exec();
  // }

  async findOne(query: any): Promise<User> {
    //TODO - added limit just to be safe
    return this.userModel.findOne(query).limit(1).exec();
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

  async findUsersbyCount(
    where: any,
    select: string,
    skip: number,
    limit: number,
  ): Promise<{ users: User[]; count: number }> {
    try {
      const users = await this.userModel
        .find(where)
        .select(select)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec();
      const count = await this.userModel.countDocuments(where).exec();
      console.log('users', users, count);
      return { users, count };
    } catch (err) {
      throw err;
    }
  }

  async findbyQuery(query: any): Promise<User[]> {
    return this.userModel.find(query).exec();
  }
}
