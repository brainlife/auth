import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FailedLogin, FailedLoginDocument } from '../schema/failedLogin.schema';

@Injectable()
export class FailedLoginService {
  constructor(
    @InjectModel(FailedLogin.name)
    private failedLoginModel: Model<FailedLoginDocument>,
  ) {}

  async create(failedLogin: FailedLogin): Promise<FailedLogin> {
    const failedLoginModel = new this.failedLoginModel(failedLogin);
    return failedLoginModel.save();
  }

  async findAll(): Promise<FailedLogin[]> {
    return this.failedLoginModel.find().exec();
  }

  async findOne(id: string): Promise<FailedLogin> {
    return this.failedLoginModel.findById(id);
  }

  async findBy(item: any): Promise<FailedLogin[]> {
    return this.failedLoginModel.find(item);
  }

  async update(id: string, failedLogin: FailedLogin): Promise<FailedLogin> {
    return this.failedLoginModel.findByIdAndUpdate(failedLogin);
  }

  async remove(id: string): Promise<FailedLogin> {
    return this.failedLoginModel.findByIdAndRemove(id);
  }
}
