import { Controller } from '@nestjs/common';
import { Get, UseGuards, Param, Put } from '@nestjs/common';
import { Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { OrcidOauthGuard } from '../auth/guards/oauth.guards';
import { UserService } from '../users/user.service';
import { GroupService } from '../groups/group.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  checkUser,
  decodeJWT,
  createClaim,
  signJWT,
} from '../utils/common.utils';
import { settingsCallback, ttl, orcid } from '../auth/constants';
import axios from 'axios';

interface DefaultData {
  fullname?: string;
  email?: string;
  username?: string;
}

@Controller('orcid')
export class OrcidController {
  constructor(
    private readonly userService: UserService,
    private readonly groupService: GroupService,
  ) {}

  @Get('signin')
  @UseGuards(OrcidOauthGuard)
  signIn() {
    // This route is protected by Orcid authentication
    // NestJS will automatically redirect the user to Orcid for authentication
  }

  @Get('callback')
  @UseGuards(OrcidOauthGuard)
  async callback(@Req() req: Request, @Res() res: Response) {
    // This route is protected by Orcid authentication
    // NestJS will automatically redirect the user to Orcid for authentication

    console.log('orcid callback', req?.user);
    const {
      user: { user: userParsedfromOrcid, profile },
    } = req?.user as any;

    console.log('orcid callback', userParsedfromOrcid);

    let userParsedfromCookie = null;
    if (req.cookies['associate_jwt'])
      userParsedfromCookie = decodeJWT(req.cookies['associate_jwt']);
    console.log('orcid callback', userParsedfromOrcid);

    if (userParsedfromCookie) {
      res.clearCookie('associate_jwt');
      if (userParsedfromOrcid) {
        const messages = [
          {
            type: 'error',
            message:
              'Your orcid account is already associated to another account. Please signoff / login with your orcid account.',
          },
        ];
        res.cookie('messages', JSON.stringify(messages), { path: '/' });
        res.redirect('/auth/#!/signin');
        return;
      }
      const userRecord = await this.userService.findOne({
        sub: userParsedfromCookie.sub,
      });
      if (!userRecord)
        throw new Error(
          "Couldn't find user record with sub:" + userParsedfromCookie.sub,
        );
      userRecord.profile = profile;
      await this.userService.updatebySub(userRecord.sub, userRecord);
      res.redirect(settingsCallback);
    } else {
      if (!userParsedfromOrcid) {
        console.log('orcid.autoRegister', profile);
        if (orcid.autoRegister) this.registerNewUser(profile, res);
        else {
          res.redirect(
            '/auth/#!/signin?msg=' +
              'Your ORCID account(' +
              profile.orcid +
              ') is not yet registered. Please login using your username/password first, then associate your InCommon account inside the account settings.',
          );
        }
        return;
      }
      if (checkUser(userParsedfromOrcid, req)?.message)
        return new Error(checkUser(userParsedfromOrcid, req).message);

      const claim = await createClaim(
        userParsedfromOrcid,
        this.userService,
        this.groupService,
      );
      userParsedfromOrcid.times.orcid_login = new Date();
      userParsedfromOrcid.reqHeaders = req.headers;
      await this.userService.updatebySub(
        userParsedfromOrcid.sub,
        userParsedfromOrcid,
      );
      const jwt = signJWT(claim);
      res.redirect('/auth/#!/success/' + jwt);
    }
  }

  async registerNewUser(profile: any, res: Response) {
    try {
      const detail = await axios.get(
        'https://pub.orcid.org/v2.1/' + profile.orcid + '/record',
      );

      const ext = {
        orcid: profile.orcid,
      };

      const _default: DefaultData = {};

      if (detail.data.person) {
        if (detail.data.person.name) {
          _default.fullname = `${detail.data.person.name['given-names'].value} ${detail.data.person.name['family-name'].value}`;
        }

        if (detail.data.person.emails) {
          detail.data.person.emails.email.forEach((email) => {
            if (email.primary) _default.email = email.email;
          });
        }
      }

      // guest user id from email
      if (_default.email) {
        _default.username = _default.email.split('@')[0];
      }

      const temp_jwt = signJWT({
        exp: (Date.now() + ttl) / 1000,
        ext,
        _default,
      });

      //   console.info(`signed temporary jwt token for orcid signup: ${tempJwt}`);
      console.debug(JSON.stringify(profile, null, 4));

      res.redirect(`/auth/#!/signup/${temp_jwt}`);
    } catch (error) {
      throw new Error(`Failed to get orcid detail: ${error.message}`);
    }
  }
}
