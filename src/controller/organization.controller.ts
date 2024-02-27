import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, Res, HttpException, HttpStatus } from '@nestjs/common';
import { OrganizationService } from 'src/organizations/organization.service';
import { CreateOrganizationDto } from 'src/dto/create-organization.dto';
import { UpdateOrganizationDto } from 'src/dto/update-organization.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { check } from 'prettier';
import { checkUser } from 'src/utils/common.utils';
import { Organization } from 'src/schema/organization.schema';


@Controller('organization')
export class OrganizationController {
    constructor(
        private readonly organizationService: OrganizationService
    ) { }


    // brainlife admin can access this and get all organizations
    // if not bl admin then only get the organizations that the user is a member of
    // as a admin or as a user
    @Get()
    @UseGuards(JwtAuthGuard)
    async findAll(@Req() req, @Res() res) {
        let where = {};
        if (req.query.find) where = JSON.parse(req.query.find);
        console.log('where', where);

        if (!req.user.roles.includes('admin')) {
            // MongoDB query to find organizations where the user's ID is in the members array of any role
            where['roles.members'] = req.user.sub;
        }

        const limit = req.query.limit || 0;
        const skip = req.query.skip || 0;
        const select =
            req.query.select ||
            'owner name created modified roles removed';
        return res.json(
            await this.organizationService.findAll(
                where,
                select,
                skip,
                null,
                limit,
            ));
    }

    // brainlife admin can access any organization
    // organization admin can access their organization
    // if not admin then only get the organization that the user is a member of
    @UseGuards(JwtAuthGuard)
    @Get(':id')
    async findOne(@Req() req, @Param('id') id: string) {
        const organization = await this.organizationService.findOne(id); // Ensure this operation is awaited
        // Direct admin access
        if (req.user.roles.includes('admin')) return organization;
        // Check if the user is a member of the organization in any role
        const isMember = organization.roles.some(role => role.members.includes(req.user.sub));
        if (isMember) return organization;
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }


    // any authenticated user can create an organization
    @UseGuards(JwtAuthGuard)
    @Post()
    create(@Req() req, @Body() createOrganizationDto: CreateOrganizationDto) {
        // validate the user is admin of the organization
        // validate that the owner is the user
        if (createOrganizationDto.owner != req.user.sub) {
            throw new Error('The owner of the organization must be the user');
        }

        // Check if the user has the "admin" role and is a member of the organization
        const isAdmin = createOrganizationDto.roles.some(role => role.role === 'admin' && role.members.includes(req.user.sub));
        if (!isAdmin) {
            throw new Error('The user must be an admin of the organization');
        }

        return this.organizationService.create(createOrganizationDto);
    }


    // admin of the organization and brainlife admin can update an organization
    @Put(':id')
    @UseGuards(JwtAuthGuard)
    async update(@Req() req, @Param('id') id: string, @Body() updateOrganizationDto: UpdateOrganizationDto) {
        const organization: Organization = await this.organizationService.findOne(id);

        // Check if the user is a brainlife admin or the owner of the organization.
        const isBrainlifeAdmin = req.user.roles.includes('admin');
        const isOwner = organization.owner === req.user.sub;

        // Check if the user is an admin within the organization
        const isAdminOfOrganization = organization.roles.some(role => role.role === 'admin' && role.members.includes(req.user.sub));

        // If the user is not a brainlife admin, the owner, or an admin in the organization, throw an error.
        if (!isBrainlifeAdmin && !isOwner && !isAdminOfOrganization) {
            throw new Error('The user must be an admin, the owner of the organization, or a brainlife admin to perform this operation.');
        }

        // If the checks pass, proceed to update the organization.
        return this.organizationService.update(id, updateOrganizationDto);
    }


    // admin of the organization and brainlife admin can delete an organization
    @Delete(':id')
    async remove(@Req() req, @Param('id') id: string) {
        const organization: Organization = await this.organizationService.findOne(id);

        // Check if the user is a brainlife admin or the owner of the organization.
        const isBrainlifeAdmin = req.user.roles.includes('admin');
        const isOwner = organization.owner === req.user.sub;

        // Check if the user is an admin within the organization
        const isAdminOfOrganization = organization.roles.some(role => role.role === 'admin' && role.members.includes(req.user.sub));

        // If the user is not a brainlife admin, the owner, or an admin in the organization, throw an error.
        if (!isBrainlifeAdmin && !isOwner && !isAdminOfOrganization) {
            throw new Error('The user must be an admin, the owner of the organization, or a brainlife admin to perform this operation.');
        }

        // If the checks pass, proceed to update the organization.
        return this.organizationService.remove(id);
    }
}