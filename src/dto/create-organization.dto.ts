import { Organization, UserRole } from "src/schema/organization.schema"
import { OrganizationInvitation } from "src/schema/organization.schema"

export class CreateOrganizationInvitationDto extends OrganizationInvitation { }
export class CreateOrganizationDto extends Organization { }
export class InviteUserDto {
    invitee: string;
    role: UserRole = UserRole.Member;
}
