import { Inject, Injectable } from '@nestjs/common';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import {
  InvitationStatus,
  Organization,
  OrganizationDocument,
  OrganizationInvitation,
  OrganizationInvitationDocument,
} from '../schema/organization.schema';
import {
  CreateOrganizationDto,
  CreateOrganizationInvitationDto,
} from 'src/dto/create-organization.dto';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { ObjectId } from 'mongodb';
import { In } from 'typeorm';
import { UserService } from 'src/users/user.service';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectModel(Organization.name)
    private organizationModel: Model<OrganizationDocument>,
    @InjectModel(OrganizationInvitation.name)
    private organizationInvitationModel: Model<OrganizationInvitationDocument>,
  ) { }

  async create(
    createOrganizationDto: CreateOrganizationDto,
  ): Promise<Organization> {
    const createdOrganization = new this.organizationModel(
      createOrganizationDto,
    );
    return createdOrganization.save();
  }

  async createInvitation(
    createOrganizationInvitationDto: CreateOrganizationInvitationDto,
  ): Promise<OrganizationInvitation> {
    const createdOrganizationInvitation = new this.organizationInvitationModel(
      createOrganizationInvitationDto,
    );
    return createdOrganizationInvitation.save();
  }

  async findAll(
    find?: any,
    select?: string,
    skip?: number,
    sort?: any,
    limit?: number,
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

  async update(
    id: string,
    updateOrganizationDto: UpdateOrganizationDto,
  ): Promise<Organization> {
    updateOrganizationDto.modified = new Date();
    return this.organizationModel.findByIdAndUpdate(id, updateOrganizationDto, {
      new: true,
    });
  }

  async remove(id: string): Promise<Organization> {
    return this.organizationModel.findByIdAndUpdate(
      id,
      { removed: true, modified: new Date() },
      { new: true },
    );
  }

  isUserOwner(organization: Organization, userID: string): boolean {
    return organization.owner == userID;
  }

  async isUserAdmin(organization: Organization, userID: string): Promise<boolean> {
    const adminRole = organization.roles.find(role => role.role === 'admin');
    return adminRole ? adminRole.members.includes(userID) : false;
  }


  isUserMember(organization: Organization, userID: string): boolean {
    return organization.roles.some((role) => role.members.includes(userID));
  }

  isUserSpecificMember(organization: Organization, userID: string): boolean {
    const memberRole = organization.roles.find(role => role.role === 'member');
    return memberRole ? memberRole.members.includes(userID) : false;
  }

  addMember(organization: Organization, userID: string): Organization {
    const memberRoleIndex = organization.roles.findIndex(role => role.role === 'member');

    if (memberRoleIndex === -1) {
      organization.roles.push({ role: 'member', members: [userID] });
    } else {
      if (!organization.roles[memberRoleIndex].members.includes(userID)) {
        organization.roles[memberRoleIndex].members.push(userID);
      }
    }

    return organization;
  }


  addAdmin(organization: Organization, userID: string): Organization {
    const adminRoleIndex = organization.roles.findIndex(role => role.role === 'admin');

    if (adminRoleIndex === -1) {
      organization.roles.push({ role: 'admin', members: [userID] });
    } else {
      if (!organization.roles[adminRoleIndex].members.includes(userID)) {
        organization.roles[adminRoleIndex].members.push(userID);
      }
    }

    return organization;
  }




  async inviteUserToOrganization(
    organization: string,
    inviter: string,
    invitee: string,
    role: string,
  ) {
    // Check if the user is already a member of the organization or has a pending invitation
    const existingInvitation = await this.organizationInvitationModel.findOne({
      organization: new ObjectId(organization),
      invitee: new ObjectId(invitee),
      status: 'Pending',
    });

    if (existingInvitation) {
      throw new Error('User already has a pending invitation');
    }

    const existingOrganization = await this.organizationModel.findById(
      organization,
    );
    if (!existingOrganization) {
      throw new Error('Organization not found');
    }

    const createOrganizationInvitation = new CreateOrganizationInvitationDto();
    createOrganizationInvitation.inviter = new ObjectId(inviter);
    createOrganizationInvitation.invitee = new ObjectId(invitee);
    createOrganizationInvitation.invitationRole = role;
    createOrganizationInvitation.organization = new ObjectId(organization);
    createOrganizationInvitation.invitationExpiration = new Date(
      new Date().getTime() + 7 * 24 * 60 * 60 * 1000,
    ); // 7 days

    return this.createInvitation(createOrganizationInvitation);
  }

  async answerInvitation(
    organization: string,
    invitee: string,
    answer: boolean,
  ) {

    const invitation = await this.organizationInvitationModel.findOne({
      organization: new ObjectId(organization),
      invitee: new ObjectId(invitee),
      // status: 'Pending',
    });

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'Pending') {
      throw new Error('Invitation already answered');
    }

    if (invitation.invitationExpiration < new Date()) {
      throw new Error('Invitation expired');
    }

    invitation.status = answer ? InvitationStatus.Accepted : InvitationStatus.Declined;

    if (answer) {
      let organization: Organization = await this.organizationModel.findById(
        invitation.organization,
      );

      if (!organization) {
        throw new Error('Organization not found');
      }

      if (invitation.invitationRole == 'admin') {
        if (this.isUserAdmin(organization, invitee)) {
          throw new Error('User is already an admin of the organization');
        }
        organization = this.addAdmin(organization, invitee);
      } else {
        if (this.isUserSpecificMember(organization, invitee)) {
          throw new Error('User is already a member of the organization');
        }
        organization = this.addMember(organization, invitee);
      }
      await organization.save();
    } else {
      invitation.status = InvitationStatus.Declined;
    }

    invitation.updateDate = new Date();
    await invitation.save();
    return invitation;
  }
}
