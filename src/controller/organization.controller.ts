import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { OrganizationService } from 'src/organizations/organization.service';
import { CreateOrganizationDto } from 'src/dto/create-organization.dto';
import { UpdateOrganizationDto } from 'src/dto/update-organization.dto';


@Controller('organization')
export class OrganizationController {
    constructor(
        private readonly organizationService: OrganizationService
    ) { }

    @Get('/all')
    findAll() {
        console.log('Finding all organizations');
        return this.organizationService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.organizationService.findOne(id);
    }

    @Post()
    create(@Body() createOrganizationDto: CreateOrganizationDto) {
        return this.organizationService.create(createOrganizationDto);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() updateOrganizationDto: UpdateOrganizationDto) {
        return this.organizationService.update(id, updateOrganizationDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.organizationService.remove(id);
    }
}