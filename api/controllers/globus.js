
const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('express-jwt');
const passport = require('passport');
const GlobusStrategy = require('passport-globus').Strategy;
const jsonwebtoken = require('jsonwebtoken');

const config = require('../config');
const common = require('../common');
const db = require('../models');

const globusStrategy = new GlobusStrategy({
    clientID: config.globus.client_id,
    clientSecret: config.globus.client_secret,
    callbackURL: config.globus.callback_url,
}, function(accessToken, refreshToken, params, _empty, cb) {
    console.debug("GlobusStrategy");
    //console.log("accessToken", accessToken);
    //console.log("refreshToken", refreshToken);
    //console.log("params", params);
    //console.log("profile", profile);
    const profile = jsonwebtoken.decode(params.id_token);
    console.log("parseed token", profile);
    /* example token from globus
    {
      sub: 'b56a1182-d274-11e5-9b2b-1760c13ed76e',
      organization: 'Indiana University-Bloomington',
      name: 'Soichi Hayashi',
      preferred_username: 'hayashis@globusid.org',
      identity_provider: '41143743-f3c8-4d60-bbdb-eeecaba85bd9',
      identity_provider_display_name: 'Globus ID',
      email: 'hayashis@iu.edu',
      last_authentication: 1554158186,
      identity_set: [
        {
          sub: 'b56a1182-d274-11e5-9b2b-1760c13ed76e',
          organization: 'Indiana University-Bloomington',
          name: 'Soichi Hayashi',
          username: 'hayashis@globusid.org',
          identity_provider: '41143743-f3c8-4d60-bbdb-eeecaba85bd9',
          identity_provider_display_name: 'Globus ID',
          email: 'hayashis@iu.edu',
          last_authentication: 1554158186
        },
        ...
        {
          sub: '5e5597f0-df02-11e5-bc5b-cf561580ecee',
          organization: 'Indiana University',
          name: 'Soichi  Hayashi',
          username: 'hayashis@xsede.org',
          identity_provider: '36007761-2cf2-4e74-a068-7473afc1d054',
          identity_provider_display_name: 'XSEDE',
          email: 'hayashis@iu.edu',
          last_authentication: null
        }
      ],
      iss: 'https://auth.globus.org',
      aud: '9be31767-b65e-4467-876a-1fd5cd9d707e',
      exp: 1636815046,
      iat: 1636642246,
      at_hash: 'y7XH1Tv7Qnf6NNwn0X45iSTb9k8n6eUT0kjsxfCZ_j0'
    }
    */
    db.mongo.User.findOne({'ext.globus': profile.sub}).then(function(user) {
        cb(null, user, profile);
    });
});

passport.use(globusStrategy);
router.get('/signin', passport.authenticate(globusStrategy.name, {
    scope: ['email', 'profile', 'openid'] //needed to received the full profile in token
}));

//this handles both normal callback from incommon and account association (if cookies.associate_jwt is set)
router.get('/callback', jwt({ 
    secret: config.auth.public_key, 
    algorithms: [config.auth.sign_opt.algorithm],
    credentialsRequired: false, 
    getToken: req=>req.cookies.associate_jwt 
}), (req, res, next)=>{
    passport.authenticate(globusStrategy.name, {
        //scope: ['email', 'profile', 'openid']
    }, (err, user, profile)=>{
        console.debug("globus callback", profile);
        if(err) {
            console.error(err);
            return res.redirect('/auth/#!/signin?msg='+"Failed to authenticate globus");
        }
        if(req.user) {
            //logged in via associate_jwt..
            console.log("handling globus association");
            res.clearCookie('associate_jwt');
            if(user) {
                //SUB is already registered to another account..
                //TODO - should I let user *steal* the OIDC sub from another account?
                var messages = [{
                    type: "error", 
                    message: "There is another account with the same globus ID registered. Please contact support."
                }];
                res.cookie('messages', JSON.stringify(messages), {path: '/'});
                res.redirect(config.auth.settingsCallback);
            } else {
                db.mongo.User.findOne({sub: req.user.sub}).then(function(user) {
                    if(!user) throw new Error("couldn't find user record with sub:"+req.user.sub);
                    user.ext.globus = profile.sub;
                    user.save().then(function() {
                        var messages = [{
                            type: "success", 
                            message: "Successfully associated your OIDC account"
                        }];
                        res.cookie('messages', JSON.stringify(messages), {path: '/'});
                        res.redirect(config.auth.settingsCallback);
                    });
                });
            }
        } else {
            console.log("handling globus callback");
            if(user) {
                const error = common.checkUser(user, req);
                if(error) return next(error);
                common.createClaim(user, function(err, claim) {
                    if(err) return next(err);
                    var jwt = common.signJwt(claim);
                    user.times.globus_login = new Date();
                    user.markModified('times');
                    user.reqHeaders = req.headers;
                    user.save().then(function() {
                        common.publish("user.login."+user.sub, {type: "globus", username: user.username, exp: claim.exp, headers: req.headers});
                        res.redirect('/auth/#!/success/'+jwt);
                    });
                });
            } else {
                if(config.globus.auto_register) {
                    register_newuser(profile, res, next);
                } else {
                    res.redirect('/auth/#!/signin?msg='+"Your globus account("+profile.sub+") is not yet registered. Please login using your username/password first, then associate your InCommon account inside the account settings.");
                }
            }
        }
    })(req, res, next);
});

function register_newuser(profile, res, next) {
    //create temporary token to registe
    const temp_jwt = common.signJwt({ 
        exp: (Date.now() + config.auth.ttl)/1000, 
        ext: {globus: profile.sub}, 
        _default: {
            username: profile.preferred_username.split("@")[0], //grab "hayashis" from hayashis@globusid.org
            fullname: profile.name,
            email: profile.email,
            institution: profile.organization,
        }
    })
    console.log("signed temporary jwt token for globus signup");
    console.debug(JSON.stringify(profile, null, 4));
    res.redirect('/auth/#!/signup/'+temp_jwt);
}

//start globus account association
router.get('/associate/:jwt', jwt({
    secret: config.auth.public_key, 
    algorithms: [config.auth.sign_opt.algorithm],
    getToken: req=>req.params.jwt
}), function(req, res, next) {
    res.cookie("associate_jwt", req.params.jwt, {
        //it's really overkill but .. why not? (maybe helps to hide from log?)
        httpOnly: true,
        secure: true,
        maxAge: 1000*60*5,//5 minutes should be enough
    });
    passport.authenticate(globusStrategy.name)(req, res, next);
});

//should I refactor?
router.put('/disconnect', jwt({
    secret: config.auth.public_key,
    algorithms: [config.auth.sign_opt.algorithm],
}), function(req, res, next) {
    var sub = req.body.sub;
    db.mongo.User.findOne({sub: req.user.sub}).then(user=>{
        if(!user) res.status(401).end();
        user.ext.globus = null;
        user.save().then(function() {
            res.json({message: "Successfully disconnected an globus account", user: user});
        });    
    });
});

module.exports = router;
