import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Group, GroupDocument } from '../schema/group.schema';
import { CreateGroupDto } from '../dto/create-group.dto';
import { ClientRMQ } from '@nestjs/microservices';
import { InjectConnection } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

@Injectable()
export class GroupService {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectConnection() private readonly connection: mongoose.Connection,
  ) {}
  
  //TODO: needs extra testing to check for transactions
  async create(createGroupDto: CreateGroupDto): Promise<Group> {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      let groupID = 1;
      const lastGroup = await this.groupModel.findOne().sort({ _id: -1 }).exec();
      console.log('lastGroup', lastGroup);
      if (lastGroup) groupID = lastGroup.id + 1;
      createGroupDto.id = groupID;
      const Group = new this.groupModel(createGroupDto);
      return Group.save();
    } catch (error) {
      await session.abortTransaction();
    } finally {
      await session.endSession();
    }
    
  }

  async findAll(): Promise<Group[]> {
    return this.groupModel.find().exec();
  }

  async findBy(item: any): Promise<Group[]> {
    return this.groupModel.find(item);
  }

  async findOne(id: string): Promise<Group> {
    return this.groupModel.findOne({ id: id }).exec();
  }

  async update(id: string, updateGroupDto: CreateGroupDto): Promise<Group> {
    //new returns the updated document
    return await this.groupModel.findOneAndUpdate({ id: id }, updateGroupDto);
  }

  async remove(id: string): Promise<Group> {
    return this.groupModel.findByIdAndRemove(id);
  }

  async findGroups(find: any, skip: number, limit: number) {
    const groups = await this.groupModel
      .find(find)
      .skip(skip)
      .limit(limit)
      .lean()
      .populate('admins members', 'email fullname username sub')
      .exec();

    const count = await this.groupModel.countDocuments(find).exec();
    //forcing to add canedit property to each group
    groups.forEach((group: any) => (group.canedit = true));
    return { groups: groups, count: count };
  }

}
