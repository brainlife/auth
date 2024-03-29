import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrganizationService } from './organization.service';
import { OrganizationController } from '../controller/organization.controller';
import { Organization, OrganizationSchema } from '../schema/organization.schema';
import { OrganizationInvitation, OrganizationInvitationSchema } from '../schema/organization.schema';
@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Organization.name, schema: OrganizationSchema },
            { name: OrganizationInvitation.name, schema: OrganizationInvitationSchema }
        ])
    ],
    controllers: [OrganizationController],
    providers: [OrganizationService],
    exports: [OrganizationService]
})
export class OrganizationModule { }
