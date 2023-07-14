import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export class Ext {
  @Prop({ unique: true, sparse: true })
  iucas?: string;

  @Prop({ unique: true, sparse: true })
  ldap?: string;

  @Prop({ unique: true, sparse: true })
  googleid?: string;

  @Prop({ unique: true, sparse: true })
  github?: string;

  @Prop({ unique: true, sparse: true })
  facebook?: string;

  @Prop({ unique: true, sparse: true })
  orcid?: string;

  @Prop({ unique: true, sparse: true })
  globus?: string;

  @Prop({ unique: true, sparse: true })
  logingov?: string;

  @Prop({ type: [String] })
  x509dns?: string[];

  @Prop({ type: [String] })
  openids?: string[];
}

class Profile {
  @Prop({ type: Object, default: {} })
  public: Record<string, unknown>;

  @Prop({ type: Object, default: {} })
  private: Record<string, unknown>;
}

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop({ unique: true, required: true })
  sub: number;
  unique: true;

  @Prop({ unique: true, required: true })
  username: string;

  @Prop()
  fullname: string;

  @Prop({ unique: true })
  email: string;

  @Prop()
  email_confirmed: boolean;

  @Prop()
  email_confirmation_token: string;

  @Prop({ type: Profile, default: () => ({}) })
  profile: {
    public: any;
    private: any;
  };

  @Prop({ type: Object, default: {} })
  geocode: Record<string, unknown>;

  @Prop()
  password_hash: string;

  @Prop()
  password_reset_token?: string;

  @Prop()
  password_reset_cookie?: string;

  @Prop({ type: Ext })
  ext?: Ext;

  @Prop({ type: Object, default: {} })
  times: Record<string, unknown>;

  @Prop({ type: Object, default: {} })
  reqHeaders: Record<string, unknown>;

  @Prop({ type: Object, default: {} })
  scopes: Record<string, unknown>;

  @Prop({ default: true })
  active: boolean;
}

export class DefaultScopes {}

export const UserSchema = SchemaFactory.createForClass(User);
