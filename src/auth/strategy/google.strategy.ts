import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthService } from '../auth.service';
import { Profile,Strategy } from 'passport-github';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(private authService: AuthService) {
        super({
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL,
            scope: ['profile'],
        });
    };

    async validate(accessToken: string, refreshToken: string, profile: Profile, done: Function) {
        let user = await this.authService.verifyGoogleUser(profile);
        return {user, profile};
    }
}