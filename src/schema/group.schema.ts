import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';
import { Types } from 'mongoose';
@Schema()
export class Group extends Document {
  @Prop()
  id: number;

  @Prop()
  name: string;

  @Prop()
  desc: string;

  @Prop([{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }])
  admins: Types.ObjectId[];

  @Prop([{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }])
  members: Types.ObjectId[];

  @Prop({ default: true })
  active: boolean;

  @Prop({ default: Date.now })
  create_date: Date;
}

export const GroupSchema = SchemaFactory.createForClass(Group);

export type GroupDocument = Group & Document;
