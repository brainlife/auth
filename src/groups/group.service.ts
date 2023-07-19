import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Group, GroupDocument } from '../schema/group.schema';
import { CreateGroupDto } from '../dto/create-group.dto';
import { ClientRMQ } from '@nestjs/microservices';

@Injectable()
export class GroupService {
    
    constructor(@InjectModel(Group.name) private groupModel: Model<GroupDocument>){}

    async create(createGroupDto: CreateGroupDto): Promise<Group> {
        const Group = new this.groupModel(createGroupDto);
        return Group.save();
    }

    async findAll(): Promise<Group[]> {
        return this.groupModel.find().exec();
    }

    async findBy(item:any): Promise<Group[]> {
        return this.groupModel.find(item);
    }

    async findOne(id: string): Promise<Group> {
        return this.groupModel.findById(id);
    }

    async update(id: string, updateGroupDto: CreateGroupDto): Promise<Group> {
        return this.groupModel.findByIdAndUpdate(updateGroupDto);
    }

    async remove(id: string): Promise<Group> {
        return this.groupModel.findByIdAndRemove(id);
    }
}