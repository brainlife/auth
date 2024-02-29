import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, Res, HttpException, HttpStatus } from '@nestjs/common';
import { OrganizationService } from 'src/organizations/organization.service';
import { CreateOrganizationDto } from 'src/dto/create-organization.dto';
import { UpdateOrganizationDto } from 'src/dto/update-organization.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { check } from 'prettier';
import { checkUser, hasScope } from 'src/utils/common.utils';
import { Organization } from 'src/schema/organization.schema';


@Controller('organization')
export class OrganizationController {
    constructor(
        private readonly organizationService: OrganizationService
    ) { }

    @Get()
    @UseGuards(JwtAuthGuard)
    async findAll(@Req() req, @Res() res) {
        let where = {};
        if (req.query.find) where = JSON.parse(req.query.find);

        if (!hasScope(req.user, 'admin')) {
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

    @UseGuards(JwtAuthGuard)
    @Get(':id')
    async findOne(@Req() req, @Param('id') id: string) {
        const organization: Organization = await this.organizationService.findOnebyId(id);

        if (hasScope(req.user, "admin")) return organization;

        const isMember = organization.roles.some(role => role.members.includes(req.user.sub));
        if (isMember) return organization;
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }


    @UseGuards(JwtAuthGuard)
    @Post('create')
    create(@Req() req, @Body() createOrganizationDto: CreateOrganizationDto) {

        if (createOrganizationDto.owner != req.user.sub) {
            throw new Error('The owner of the organization must be the user');
        }

        const isAdmin = createOrganizationDto.roles.some(role => role.role === 'admin' && role.members.includes(req.user.sub));
        if (!isAdmin) {
            throw new Error('The user must be an admin of the organization');
        }

        return this.organizationService.create(createOrganizationDto);
    }


    @Put(':id')
    @UseGuards(JwtAuthGuard)
    async update(@Req() req, @Param('id') id: string, @Body() updateOrganizationDto: UpdateOrganizationDto) {
        const organization: Organization = await this.organizationService.findOnebyId(id);


        const isBrainlifeAdmin = hasScope(req.user, 'admin');
        const isOwner = organization.owner === req.user.sub;

        const isAdminOfOrganization = organization.roles.some(role => role.role === 'admin' && role.members.includes(req.user.sub));


        if (!isBrainlifeAdmin && !isOwner && !isAdminOfOrganization) {
            throw new Error('The user must be an admin, the owner of the organization, or a brainlife admin to perform this operation.');
        }

        return this.organizationService.update(id, updateOrganizationDto);
    }


    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    async remove(@Req() req, @Param('id') id: string) {
        const organization: Organization = await this.organizationService.findOnebyId(id);

        const isBrainlifeAdmin = hasScope(req.user, 'admin');
        const isOwner = organization.owner === req.user.sub;

        const isAdminOfOrganization = organization.roles.some(role => role.role === 'admin' && role.members.includes(req.user.sub));


        if (!isBrainlifeAdmin && !isOwner && !isAdminOfOrganization) {
            throw new Error('The user must be an admin, the owner of the organization, or a brainlife admin to perform this operation.');
        }

        return this.organizationService.remove(id);
    }
}