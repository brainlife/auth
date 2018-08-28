
//contrib
const express = require('express');
const router = express.Router();
const request = require('request');
const winston = require('winston');
const jwt = require('express-jwt');
const clone = require('clone');
const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2').Strategy;
const xml2js = require('xml2js');

//mine
const config = require('../config');
const logger = new winston.Logger(config.logger.winston);

const common = require('../common');
const db = require('../models');

var cache_idps = null;
request.get({url: config.oidc.idplist}, (err, res, xml)=>{
    if(err) throw err;
    xml2js.parseString(xml, (err, list)=>{
        if(err) throw err;
        cache_idps = list.idps.idp;
    });
});

const oidc_strat = new OAuth2Strategy({
    authorizationURL: config.oidc.authorization_url,
    tokenURL: config.oidc.token_url,
    clientID: config.oidc.client_id,
    clientSecret: config.oidc.client_secret,
    callbackURL: config.oidc.callback_url,
    scope: "openid profile email org.cilogon.userinfo",
}, function(accessToken, refreshToken, profile, cb) {

    //cilogon doesn't set profile.. I need to make another call to fetch the info
    logger.debug("oidc loading userinfo ..", accessToken, profile);
    request.get({url: config.oidc.userinfo_url, qs: {access_token: accessToken}, json: true},  function(err, _res, profile) {
        if(err) return cb(err); 
        db.User.findOne({where: {"oidc_subs": {$like: "%\""+profile.sub+"\"%"}, active: true}}).then(function(user) {
            cb(null, user, profile);
        });
    });
});
oidc_strat.name = "oauth2-oidc";
passport.use(oidc_strat);

//initiate oauth2 login!
OAuth2Strategy.prototype.authorizationParams = function(options) {
    return { selected_idp: options.idp }
}
router.get('/signin', function(req, res, next) {
    logger.debug("oidc signin commencing");
    passport.authenticate(oidc_strat.name, {
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
router.get('/callback', 
jwt({ secret: config.auth.public_key, credentialsRequired: false, getToken: req=>req.cookies.associate_jwt }),
function(req, res, next) {
    passport.authenticate(oidc_strat.name, function(err, user, profile) {
        logger.debug("oidc callback", profile);
        if(err) {
            console.error(err);
            return res.redirect('/auth/#!/signin?msg='+"Failed to authenticate oidc");
        }
        if(req.user) {
            //logged in via associate_jwt..
            logger.info("handling oidc association");
            res.clearCookie('associate_jwt');
            if(user) {
                //SUB is already registered to another account..
                //TODO - should I let user *steal* the OIDC sub from another account?
                var messages = [{
                    type: "error", 
                    message: "There is another account with the same OIDC ID registered. Please contact support."
                }];
                res.cookie('messages', JSON.stringify(messages), {path: '/'});
                res.redirect('/auth/#!/settings/account');
            } else {
                db.User.findOne({where: {id: req.user.sub}}).then(function(user) {
                    if(!user) throw new Error("couldn't find user record with sub:"+req.user.sub);
                    var subs = user.get('oidc_subs');
                    if(!subs) subs = [];
                    if(!~find_profile(subs, profile.sub)) subs.push(profile);
                    user.set('oidc_subs', subs);
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
            logger.info("handling oidc callback");
            if(!user) {
                if(config.oidc.auto_register) {
                    register_newuser(profile, res, next);
                } else {
                    res.redirect('/auth/#!/signin?msg='+"Your InCommon account("+profile.sub+") is not yet registered. Please login using your username/password first, then associate your InCommon account inside the account settings.");
                }
            } else {
                issue_jwt(user, profile, function(err, jwt) {
                    if(err) return next(err);
                    res.redirect('/auth/#!/success/'+jwt);
                });
            }            
        }
    })(req, res, next);
});

function register_newuser(profile, res, next) {
    //var u = clone(config.auth.default);

    //email may not be set on some IdP(?)
    //more importantly, it could collide with already existing account - let signup take care of this
    //u.email = profile.email;
    //u.email_confirmed = true; //let's trust InCommon
    
    var user = {
        oidc_subs: [profile],
        fullname: profile.given_name+" "+profile.family_name,
        email: profile.email, //not sure if this exists
    }
    var temp_jwt = common.signJwt({ exp: (Date.now() + config.auth.ttl)/1000, user })
    logger.info("signed temporary jwt token for oidc signup:", temp_jwt);
    res.redirect('/auth/#!/signup/'+temp_jwt);

    /*
    db.User.create(u).then(function(user) {
        logger.info("registered new user", JSON.stringify(user));
        user.addMemberGroups(u.gids, function() {
            issue_jwt(user, profile, function(err, jwt) {
                if(err) return next(err);
                logger.info("registration success", jwt);
                res.redirect('/auth/#!/signup/'+jwt);
            });
        });
    });
    */
}

function issue_jwt(user, profile, cb) {
    common.createClaim(user, function(err, claim) {
        if(err) return cb(err);
        var jwt = common.signJwt(claim);
        user.updateTime('oidc_login:'+profile.sub);
        user.save().then(function() {
            cb(null, jwt);
        });
    });
}

//start oidc account association
router.get('/associate/:jwt', jwt({secret: config.auth.public_key, getToken: req=>req.params.jwt}), 
function(req, res, next) {
    res.cookie("associate_jwt", req.params.jwt, {
        //it's really overkill but .. why not? (maybe helps to hide from log?)
        httpOnly: true,
        secure: true,
        maxAge: 1000*60*5,//5 minutes should be enough
    });
    passport.authenticate(oidc_strat.name)(req, res, next);
});

//should I refactor?
router.put('/disconnect', jwt({secret: config.auth.public_key}), function(req, res, next) {
    var sub = req.body.sub;
    db.User.findOne({
        where: {id: req.user.sub}
    }).then(function(user) {
        if(!user) res.status(401).end();
        var subs = user.get('oidc_subs');
        var pos = find_profile(subs, sub);
        if(~pos) subs.splice(pos, 1);
        user.set('oidc_subs', subs);
        user.save().then(function() {
            logger.debug(user.toString());
            res.json({message: "Successfully disconnected an OIDC account", user: user});
        });    
    });
});

//query idp
router.get('/idp', function(req, res, next) {
    if(!cache_idps) return next("idp list not yet loaded");
    var query = req.query.q;
    if(!query) return next("no query");
    if(query) query = query.toLowerCase();
    logger.debug(req.params);
    var idps = [];
    cache_idps.forEach(function(idp) {
        var match = false;
        if(idp.Organization_name && ~idp.Organization_Name[0].toLowerCase().indexOf(query)) match = true;
        if(idp.Home_Page && ~idp.Home_Page[0].toLowerCase().indexOf(query)) match = true;
        if(match) {
            idps.push({
                idp: idp.$.entityID,
                org: idp.Organization_Name[0],
                home: idp.Home_Page[0],
            });
        }
    });
    res.json(idps);
});

module.exports = router;
