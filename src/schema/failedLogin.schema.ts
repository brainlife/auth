import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FailedLoginDocument = FailedLogin & Document;

@Schema()
export class FailedLogin {
  @Prop({ type: String })
  username: string;

  @Prop({ type: String, ref: 'User' })
  user_id: string;

  @Prop({ type: Object })
  headers: Record<string, unknown>;

  @Prop({ type: String })
  code: string;

  @Prop({ type: Date, default: Date.now })
  create_date: Date;
}

export const FailedLoginSchema = SchemaFactory.createForClass(FailedLogin);
