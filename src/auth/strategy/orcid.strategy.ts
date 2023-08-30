import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-orcid";
import { AuthService } from "../auth.service";
import { Profile } from "passport";

@Injectable()
export class OrcidStrategy extends PassportStrategy(Strategy, 'orcid') {
    constructor(private authService:AuthService) {
        super({
            sandbox: process.env.NODE_ENV !== 'production', // use the sandbox for non-production environments
            clientID: process.env.ORCID_CLIENT_ID,
            clientSecret: process.env.ORCID_CLIENT_SECRET,
            callbackURL: process.env.ORCID_CALLBACK_URL,
            // scope: ['given_names', 'family_names','email', 'orcid'],
            //https://info.orcid.org/documentation/integration-guide/customizing-the-sign-in-register-screen/#Pre-fill_the_registrationSign-in_form0
        });
    }

    async validate(accessToken: string, refreshToken: string, params: any, profile: Profile, done: Function) {
        console.log("orcid validate", params);
        let user = await this.authService.verifyOrcidUser(params.orcid);
        const profileParsed = { orcid: params.orcid, name: params.name }
        return {user, profile: profileParsed};
    }
}