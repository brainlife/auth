import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Group, GroupDocument } from '../schema/group.schema';
import { CreateGroupDto } from '../dto/create-group.dto';
import { ClientRMQ } from '@nestjs/microservices';

@Injectable()
export class GroupService {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
  ) {}

  async create(createGroupDto: CreateGroupDto): Promise<Group> {
    const Group = new this.groupModel(createGroupDto);
    return Group.save();
  }

  async findAll(): Promise<Group[]> {
    return this.groupModel.find().exec();
  }

  async findBy(item: any): Promise<Group[]> {
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

  async findGroups(find:any,skip:number,limit:number) {
    const groups = await this.groupModel.find(find).skip(skip).limit(limit).lean().populate('admins members', 'email fullname username sub').exec();

    const count = await this.groupModel.countDocuments(find).exec();
    //forcing to add canedit property to each group
    groups.forEach((group:any) => group.canedit = true);
    return {groups:  groups, count: count};
  }
}
