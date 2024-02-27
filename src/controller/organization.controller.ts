import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { OrganizationService } from 'src/organizations/organization.service';
import { CreateOrganizationDto } from 'src/dto/create-organization.dto';
import { UpdateOrganizationDto } from 'src/dto/update-organization.dto';


@Controller('organization')
export class OrganizationController {
    constructor(
        private readonly organizationService: OrganizationService
    ) { }


    // brainlife admin can access this and get all organizations
    // admin of the organization can access this and get all organizations
    // if not admin then only get the organizations that the user is a member of
    @Get('/all')
    findAll() {
        console.log('Finding all organizations');
        return this.organizationService.findAll();
    }

    // brainlife admin can access any organization
    // organization admin can access their organization
    // if not admin then only get the organization that the user is a member of
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.organizationService.findOne(id);
    }

    // any user can create an organization
    @Post()
    create(@Body() createOrganizationDto: CreateOrganizationDto) {
        return this.organizationService.create(createOrganizationDto);
    }


    // admin of the organization and brainlife admin can update an organization
    @Put(':id')
    update(@Param('id') id: string, @Body() updateOrganizationDto: UpdateOrganizationDto) {
        return this.organizationService.update(id, updateOrganizationDto);
    }

    // admin of the organization and brainlife admin can delete an organization
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.organizationService.remove(id);
    }
}