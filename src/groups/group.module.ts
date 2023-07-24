import { Module } from '@nestjs/common';
import { GroupService } from './group.service';
import { Group, GroupSchema } from '../schema/group.schema';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Group.name, schema: GroupSchema }]),
  ],
  providers: [GroupService],
  exports: [GroupService],
})
export class GroupModule {}
