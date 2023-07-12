import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CreateUserDto } from "../dto/create-user.dto";
import { UpdateUserDto } from "../dto/update-user.dto";


import { User, UserDocument } from "../schema/user.schema";

@Injectable()
export class UserService {

    constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

    async create(createUserDto: CreateUserDto): Promise<User> {
        const User = new this.userModel(createUserDto);
        return User.save();
    }

    async findAll(): Promise<User[]> {
        return this.userModel.find().exec();
    }

    async findOne(sub: number): Promise<User> {
        return this.userModel.findById(sub).exec();
    }

    async update(sub: number, updateUserDto: UpdateUserDto): Promise <UserDocument> {
        return this.userModel.findByIdAndUpdate(sub, updateUserDto);
    }

    async remove(sub: number): Promise<User> {
        return this.userModel.findByIdAndRemove(sub);
    }
}