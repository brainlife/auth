import { Inject, Injectable } from "@nestjs/common";
import { UpdateOrganizationDto } from "../dto/update-organization.dto";
import { Organization, OrganizationDocument, OrganizationInvitation, OrganizationInvitationDocument } from "../schema/organization.schema";
import { CreateOrganizationDto, CreateOrganizationInvitationDto } from "src/dto/create-organization.dto";
import { Model } from "mongoose";
import { InjectModel } from "@nestjs/mongoose";
import { ObjectId } from "mongodb";
import { In } from "typeorm";

@Injectable()
export class OrganizationService {
    constructor(
        @InjectModel(Organization.name) private organizationModel: Model<OrganizationDocument>,
        @InjectModel(OrganizationInvitation.name)
        private organizationInvitationModel: Model<OrganizationInvitationDocument>
    ) { }

    async create(createOrganizationDto: CreateOrganizationDto): Promise<Organization> {
        const createdOrganization = new this.organizationModel(createOrganizationDto);
        return createdOrganization.save();
    }

    async createInvitation(createOrganizationInvitationDto: CreateOrganizationInvitationDto): Promise<OrganizationInvitation> {
        const createdOrganizationInvitation = new this.organizationInvitationModel(createOrganizationInvitationDto);
        return createdOrganizationInvitation.save();
    }

    async findAll(
        find?: any,
        select?: string,
        skip?: number,
        sort?: any,
        limit?: number
    ): Promise<Organization[]> {

        let query = this.organizationModel.find(find);
        if (select) {
            query = query.select(select);
        }
        if (skip) {
            query = query.skip(skip);
        }
        if (sort) {
            query = query.sort(sort);
        }
        if (limit) {
            query = query.limit(limit);
        }
        return query.exec();
    }

    async findOnebyId(id: string): Promise<Organization> {
        return this.organizationModel.findById(id);
    }

    async update(id: string, updateOrganizationDto: UpdateOrganizationDto): Promise<Organization> {
        updateOrganizationDto.modified = new Date();
        return this.organizationModel.findByIdAndUpdate(id, updateOrganizationDto, { new: true });
    }

    async remove(id: string): Promise<Organization> {
        return this.organizationModel.findByIdAndUpdate(id, { removed: true, modified: new Date() }, { new: true });
    }

    isUserOwner(organization: Organization, user: string): boolean {
        return organization.owner == user;
    }

    async isUserAdmin(organization: Organization, userID: string): Promise<boolean> {
        return organization.roles[0].members.includes(userID);
    }

    isUserMember(organization: Organization, userID: string): boolean {
        return organization.roles.some(role => role.members.includes((userID)));
    }

    async inviteUserToOrganization(organization: string, inviter: string, invitee: string, role: string) {
        // Check if the user is already a member of the organization or has a pending invitation
        const existingInvitation = await this.organizationInvitationModel.findOne({
            organization: organization,
            invitee: invitee,
            status: "Pending"
        });

        if (existingInvitation) {
            throw new Error("User already has a pending invitation");
        }

        const existingOrganization = await this.organizationModel.findById(organization);
        if (!existingOrganization) {
            throw new Error("Organization not found");
        }

        const createOrganizationInvitation = new CreateOrganizationInvitationDto();
        createOrganizationInvitation.inviter = new ObjectId(inviter);
        createOrganizationInvitation.invitee = new ObjectId(invitee);
        createOrganizationInvitation.invitationRole = role;
        createOrganizationInvitation.organization = organization;
        createOrganizationInvitation.invitationExpiration = new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

        return this.createInvitation(createOrganizationInvitation);
    }

}