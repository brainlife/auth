import { Document } from "mongodb";

export class User{
    sub: number;
    username: string;
    fullname: string;
    email: string;
    email_confrimed: boolean;
    email_confirmation_token: string;
    profile: {
        public: any,
        private: any,
    }
    geocode: any;
    password_hash: string;
    password_reset_token?: string;
    password_reset_cookie? : string;
    ext: {
        iucas?: string;
        ldap?: string;
        google?: string;
        facebook?: string;
        orcid?: string;
        globus?: string;
        logingov?: string;
        x509dns?: string[];
        openids?: string[];
    };
    times: any;
    reqHeaders: any;
    scopes: any;
    active: boolean;
}