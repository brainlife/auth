import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Document } from 'mongoose';

interface Role {
    role: string;
    members: string[];
}

@Schema()
export class Organization extends Document {
    @Prop({ required: true })
    owner: string;

    @Prop({ required: true })
    name: string;

    @Prop({ default: Date.now })
    created: Date;

    @Prop({ default: Date.now })
    modified: Date;

    @Prop({ type: [Object], default: [] })
    roles: Role[];
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
export type OrganizationDocument = Organization & Document;