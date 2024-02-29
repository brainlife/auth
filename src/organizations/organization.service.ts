import { Inject, Injectable } from "@nestjs/common";
import { UpdateOrganizationDto } from "../dto/update-organization.dto";
import { Organization, OrganizationDocument } from "../schema/organization.schema";
import { CreateOrganizationDto } from "src/dto/create-organization.dto";
import { Model } from "mongoose";
import { InjectModel } from "@nestjs/mongoose";

@Injectable()
export class OrganizationService {
    constructor(
        @InjectModel(Organization.name)
        private organizationModel: Model<OrganizationDocument>

    ) { }
    async create(createOrganizationDto: CreateOrganizationDto): Promise<Organization> {
        const createdOrganization = new this.organizationModel(createOrganizationDto);
        return createdOrganization.save();
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
        // update the modified date
        updateOrganizationDto.modified = new Date();
        return this.organizationModel.findByIdAndUpdate(id, updateOrganizationDto, { new: true });
    }

    async remove(id: string): Promise<Organization> {
        // update the modified date, just mark removed = true
        return this.organizationModel.findByIdAndUpdate(id, { removed: true, modified: new Date() }, { new: true });
    }

}