import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';

@Injectable()
export class GoogleOauthGuard extends AuthGuard('google') {
    handleRequest<TUser = any>(err: any, user: any, info: any, context: ExecutionContext, status?: any) {
        if (err || !user) {
            const res: Response = context.switchToHttp().getResponse();
            res.redirect('/auth/#!/signin?msg='+"Failed to authenticate");
            return;
        }
        return user;
    }
}

@Injectable()
export class GithubOauthGuard extends AuthGuard('github') {
    handleRequest<TUser = any>(err: any, user: any, info: any, context: ExecutionContext, status?: any) {
        if (err || !user) {
            const res: Response = context.switchToHttp().getResponse();
            res.redirect('/auth/#!/signin?msg='+"Failed to authenticate");
            return;
        }
        return user;
    }
}

@Injectable()
export class OrcidOauthGuard extends AuthGuard('orcid') {
    handleRequest<TUser = any>(err: any, user: any, info: any, context: ExecutionContext, status?: any) {
        if (err || !user) {
            const res: Response = context.switchToHttp().getResponse();
            res.redirect('/auth/#!/signin?msg='+"Failed to authenticate");
            return;
        }
        return user;
    }
}