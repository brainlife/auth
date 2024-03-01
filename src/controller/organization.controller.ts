import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, Res, HttpException, HttpStatus } from '@nestjs/common';
import { OrganizationService } from 'src/organizations/organization.service';
import { CreateOrganizationDto } from 'src/dto/create-organization.dto';
import { UpdateOrganizationDto } from 'src/dto/update-organization.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { check } from 'prettier';
import { checkUser, hasScope } from 'src/utils/common.utils';
import { Organization } from 'src/schema/organization.schema';
import { HttpErrorByCode } from '@nestjs/common/utils/http-error-by-code.util';


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

        const isMember = this.organizationService.isUserMember(organization, req.user.sub);
        if (isMember) return organization;
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }


    @UseGuards(JwtAuthGuard)
    @Post('create')
    async create(@Req() req, @Body() createOrganizationDto: CreateOrganizationDto) {

        if (!this.organizationService.isUserOwner(createOrganizationDto, req.user.sub)) {
            throw new HttpErrorByCode[403]('The user must be the owner of the organization to create it');
        }

        const isAdminOfOrganization = await this.organizationService.isUserAdmin(createOrganizationDto, req.user.sub);
        if (!isAdminOfOrganization) {
            throw new HttpErrorByCode[403]('The user must be the admin of the organization to create it');
        }

        return this.organizationService.create(createOrganizationDto);
    }


    @Put(':id')
    @UseGuards(JwtAuthGuard)
    async update(@Req() req, @Param('id') id: string, @Body() updateOrganizationDto: UpdateOrganizationDto) {
        const organization: Organization = await this.organizationService.findOnebyId(id);


        const isBrainlifeAdmin = hasScope(req.user, 'admin');
        const isOwner = this.organizationService.isUserOwner(organization, req.user.sub);

        const isAdminOfOrganization = this.organizationService.isUserAdmin(organization, req.user.sub);

        if (!isBrainlifeAdmin && !isOwner && !isAdminOfOrganization) {
            throw new HttpErrorByCode[403]('The user has no permission to update this organization.');
        }

        return this.organizationService.update(id, updateOrganizationDto);
    }


    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    async remove(@Req() req, @Param('id') id: string) {
        const organization: Organization = await this.organizationService.findOnebyId(id);

        const isBrainlifeAdmin = hasScope(req.user, 'admin');
        const isOwner = this.organizationService.isUserOwner(organization, req.user.sub);

        const isAdminOfOrganization = this.organizationService.isUserAdmin(organization, req.user.sub);


        if (!isBrainlifeAdmin && !isOwner && !isAdminOfOrganization) {
            throw new HttpErrorByCode[403]('The user has no permission to delete this organization.');
        }

        return this.organizationService.remove(id);
    }
}