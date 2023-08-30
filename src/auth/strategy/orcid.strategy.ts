import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-orcid";
import { AuthService } from "../auth.service";
import { Profile } from "passport";

@Injectable()
export class OrcidStrategy extends PassportStrategy(Strategy, 'orcid') {
    constructor(private authService:AuthService) {
        console.log(process.env.ORCID_AUTHORIZATION_URL, process.env.ORCID_TOKEN_URL);
        super({
            authorizationURL: process.env.ORCID_AUTHORIZATION_URL,
            tokenURL: process.env.ORCID_TOKEN_URL,
            clientID: process.env.ORCID_CLIENT_ID,
            clientSecret: process.env.ORCID_CLIENT_SECRET,
            callbackURL: process.env.ORCID_CALLBACK_URL,
            scope: "/authenticate",
            // scope: ['given_names', 'family_names','email', 'orcid'],
            //https://info.orcid.org/documentation/integration-guide/customizing-the-sign-in-register-screen/#Pre-fill_the_registrationSign-in_form0
        });
    }

    async validate(accessToken: string, refreshToken: string, profile: Profile, done: Function) {
        let user = await this.authService.verifyOrcidUser(profile);
        return {user, profile};
    }
}