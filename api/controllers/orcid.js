
//contrib
const express = require('express');
const router = express.Router();
const request = require('request-promise');
const winston = require('winston');
const jwt = require('express-jwt');
const clone = require('clone');
const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2').Strategy;

//mine
const config = require('../config');
const logger = winston.createLogger(config.logger.winston);

const common = require('../common');
const db = require('../models');

const orcid_strat = new OAuth2Strategy({
    authorizationURL: config.orcid.authorization_url,
    tokenURL: config.orcid.token_url,
    clientID: config.orcid.client_id,
    clientSecret: config.orcid.client_secret,
    callbackURL: config.orcid.callback_url,
    scope: "/authenticate",
}, function(accessToken, refreshToken, profile, _needed, cb) {
    logger.debug("orcid loading userinfo ..", accessToken, refreshToken, profile);
    db.mongo.User.findOne({'ext.orcid': profile.orcid}).then(function(user) {
        cb(null, user, profile);
    });
});
orcid_strat.name = "oauth2-orcid";
passport.use(orcid_strat);

//initiate oauth2 login!
OAuth2Strategy.prototype.authorizationParams = function(options) {
    return { selected_idp: options.idp }
}
router.get('/signin', function(req, res, next) {
    passport.authenticate(orcid_strat.name, {
        //this will be used by my authorizationParams() and selected_idp will be injected to authorized url
        idp: req.query.idp
    })(req, res, next);
});

function find_profile(profiles, sub) {
    var idx = -1;
    profiles.forEach(function(profile, x) {
        if(profile.sub == sub) idx = x;
    });
    return idx;
}

//this handles both normal callback from incommon and account association (if cookies.associate_jwt is set)
router.get('/callback', jwt({ 
    secret: config.auth.public_key, 
    algorithms: [config.auth.sign_opt.algorithm],
    credentialsRequired: false, 
    getToken: req=>req.cookies.associate_jwt 
}), function(req, res, next) {
    passport.authenticate(orcid_strat.name, function(err, user, profile) {
        logger.debug("orcid callback", profile);
        if(err) {
            console.error(err);
            return res.redirect('/auth/#!/signin?msg='+"Failed to authenticate orcid");
        }
        if(req.user) {
            //logged in via associate_jwt..
            logger.info("handling orcid association");
            res.clearCookie('associate_jwt');
            if(user) {
                //SUB is already registered to another account..
                //TODO - should I let user *steal* the OIDC sub from another account?
                var messages = [{
                    type: "error", 
                    message: "There is another account with the same ORCID registered. Please contact support."
                }];
                res.cookie('messages', JSON.stringify(messages), {path: '/'});
                res.redirect('/auth/#!/settings/account');
            } else {
                db.mongo.User.findOne({sub: req.user.sub}).then(function(user) {
                    if(!user) throw new Error("couldn't find user record with sub:"+req.user.sub);
                    user.ext.orcid = profile.orcid;
                    user.save().then(function() {
                        var messages = [{
                            type: "success", 
                            message: "Successfully associated your OIDC account"
                        }];
                        res.cookie('messages', JSON.stringify(messages), {path: '/'});
                        res.redirect('/auth/#!/settings/account');
                    });
                });
            }
        } else {
            logger.info("handling orcid callback");
            if(!user) {
                if(config.orcid.auto_register) {
                    register_newuser(profile, res, next);
                } else {
                    res.redirect('/auth/#!/signin?msg='+"Your InCommon account("+profile.sub+") is not yet registered. Please login using your username/password first, then associate your InCommon account inside the account settings.");
                }
                return;
            } 

            const error = common.checkUser(user, req);
            if(error) return next(error);
            common.createClaim(user, function(err, claim) {
                if(err) return next(err);
                var jwt = common.signJwt(claim);
                user.times.orcid_login = new Date();
                user.markModified('times');
                user.reqHeaders = req.headers;
                user.save().then(function() {
                    common.publish("user.login."+user.sub, {type: "orcid", username: user.username, exp: claim.exp, headers: req.headers});
                    res.redirect('/auth/#!/success/'+jwt);
                });
            });
        }
    })(req, res, next);
});

async function register_newuser(profile, res, next) {
    let detail = await request.get({url: "https://pub.orcid.org/v2.1/"+profile.orcid+"/record", json: true});
    //console.log(JSON.stringify(detail.person, null, 4));

    let ext = {
        orcid: profile.orcid,
    }
    let _default = {};
    if(detail.person) {
        if(detail.person.name) {
            _default.fullname = detail.person.name["given-names"].value + " "+detail.person.name["family-name"].value
        }
        if(detail.person.emails) {
            detail.person.emails.email.forEach(email=>{
                if(email.primary) _default.email = email.email;
            });
        }
    }

    //guest user id from email
    if(_default.email) {
        _default.username = _default.email.split("@")[0];
    }

    var temp_jwt = common.signJwt({ exp: (Date.now() + config.auth.ttl)/1000, ext, _default })
    logger.info("signed temporary jwt token for orcid signup:"+temp_jwt)
    logger.debug(JSON.stringify(profile, null, 4));
    res.redirect('/auth/#!/signup/'+temp_jwt);
}

//start orcid account association
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
    passport.authenticate(orcid_strat.name)(req, res, next);
});

//should I refactor?
router.put('/disconnect', jwt({
    secret: config.auth.public_key,
    algorithms: [config.auth.sign_opt.algorithm],
}), function(req, res, next) {
    var sub = req.body.sub;
    db.mongo.User.findOne({sub: req.user.sub}).then(user=>{
        if(!user) res.status(401).end();
        user.ext.orcid = null;
        user.save().then(function() {
            res.json({message: "Successfully disconnected an ORCID account", user: user});
        });    
    });
});

module.exports = router;
