import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { ObjectId } from 'mongodb';
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

    @Prop({ default: false })
    removed: boolean;
}

export enum InvitationStatus {
    Pending = "Pending",
    Accepted = "Accepted",
    Declined = "Declined"
}

@Schema()
export class OrganizationInvitation {
    @Prop({ required: true })
    inviter: ObjectId;

    @Prop({ required: true })
    invitee: ObjectId;

    @Prop({ default: Date.now })
    invitationDate: Date;

    invitationExpiration: Date;

    @Prop({ required: true })
    invitationRole: string;

    @Prop({ required: true })
    organization: string;

    @Prop({ default: InvitationStatus.Pending, enum: InvitationStatus })
    status: InvitationStatus;

    @Prop({ default: () => Date.now(), index: true })
    updateDate: Date;
}



export const OrganizationInvitationSchema = SchemaFactory.createForClass(OrganizationInvitation);
export type OrganizationInvitationDocument = OrganizationInvitation & Document;

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
export type OrganizationDocument = Organization & Document;