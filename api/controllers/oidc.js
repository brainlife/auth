
//contrib
var express = require('express');
var router = express.Router();
var request = require('request');
var winston = require('winston');
var jwt = require('express-jwt');
var clone = require('clone');
var passport = require('passport');
var OAuth2Strategy = require('passport-oauth2').Strategy;
var xml2js = require('xml2js');

//mine
var config = require('../config');
var logger = new winston.Logger(config.logger.winston);

var common = require('../common');
var db = require('../models');

//cache idp list
/*
1|sca-auth | [ { '$': { entityID: 'https://login.aaiedu.hr/edugain/saml2/idp/metadata.php' },
1|sca-auth |     Organization_Name: [ 'AAI@EduHr - Croatian Research and Education Federation' ],
1|sca-auth |     Home_Page: [ 'http://www.aaiedu.hr' ],
1|sca-auth |     Technical_Name: [ 'Dubravko Voncina' ],
1|sca-auth |     Technical_Address: [ 'dubravko.voncina@srce.hr' ],
1|sca-auth |     Whitelisted: [ '1' ] },
*/
var cache_idps = null;
request.get({url: config.oidc.idplist}, (err, res, xml)=>{
    if(err) throw err;
    xml2js.parseString(xml, (err, list)=>{
        if(err) throw err;
        cache_idps = list.idps.idp;
    });
});

passport.use(new OAuth2Strategy({
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
        //profile contains { sub: given_name: family_name email: }
        console.dir(profile);
        db.User.findOne({where: {"oidc_subs": {$like: "%\""+profile.sub+"\"%"}}}).then(function(user) {
            cb(null, user, profile);
        });
    });
}));

//initiate oauth2 login!
OAuth2Strategy.prototype.authorizationParams = function(options) {
    return { selected_idp: options.idp }
}
router.get('/signin', function(req, res, next) {
    passport.authenticate('oauth2', {
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
    passport.authenticate('oauth2', function(err, user, profile) {
        logger.debug("callback", profile);
        if(err) {
            console.error(err);
            return res.redirect('/auth/#!/signin?msg='+"Failed to authenticate oidc");
        }
        if(req.user) {
            //logged in via associate_jwt..
            logger.info("handling oidc association");
            res.clearCookie('associate_jwt');
            db.User.findOne({where: {id: req.user.sub}}).then(function(user) {
                if(!user) throw new Error("couldn't find user record with sub:"+req.user.sub);
                var subs = user.get('oidc_subs');
                if(!subs) subs = [];
                if(!~find_profile(subs, profile.sub)) subs.push(profile);
                user.save().then(function() {
                    res.redirect('/auth/#!/settings/account');
                });
            });
        } else {
            logger.info("handling oidc callback");
            if(!user) {
                return res.redirect('/auth/#!/signin?msg='+"Your InCommon account("+profile.sub+") is not yet registered. Please login using your username/password first, then associate your InCommon account inside account settings.");
            }
            common.createClaim(user, function(err, claim) {
                if(err) return next(err);
                var jwt = common.signJwt(claim);
                user.updateTime('oidc_login:'+profile.sub);
                user.save().then(function() {
                    res.redirect('/auth/#!/success/'+jwt);
                });
            });
        }
    })(req, res, next);
});

//start oidc account association
router.get('/associate/:jwt', jwt({secret: config.auth.public_key, getToken: req=>req.params.jwt}), 
function(req, res, next) {
    res.cookie("associate_jwt", req.params.jwt, {
        //it's really overkill but .. why not? (maybe helps to hide from log?)
        httpOnly: true,
        secure: true,
        maxAge: 1000*60*5,//5 minutes should be enough
    });
    passport.authenticate('oauth2')(req, res, next);
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
        user.save().then(function() {
            res.json({message: "Successfully disconnected an oauth2 account", user: user});
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
