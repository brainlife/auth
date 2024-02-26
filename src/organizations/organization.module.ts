import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrganizationService } from './organization.service';
import { OrganizationController } from '../controller/organization.controller';
import { Organization, OrganizationSchema } from '../schema/organization.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Organization.name, schema: OrganizationSchema }])
    ],
    controllers: [OrganizationController],
    providers: [OrganizationService],
    exports: [OrganizationService] // Export OrganizationService if it's used outside this module
})
export class OrganizationModule { }
