
//contrib
var express = require('express');
var router = express.Router();
var request = require('request');
var winston = require('winston');
var jwt = require('express-jwt');
var clone = require('clone');
var passport = require('passport');
var OAuth2Strategy = require('passport-oauth2').Strategy;

//mine
var config = require('../config');
var logger = new winston.Logger(config.logger.winston);

var common = require('../common');
var db = require('../models');

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
        db.User.findOne({where: {"oidc_subs": {$like: "%\""+profile.sub+"\"%"}}}).then(function(user) {
            cb(null, user, profile);
        });
    });
}));

router.get('/signin', passport.authenticate('oauth2'));

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
            logger.info("handling oidc association");
            res.clearCookie('associate_jwt');
            db.User.findOne({where: {id: req.user.sub}}).then(function(user) {
                if(!user) throw new Error("couldn't find user record with sub:"+req.user.sub);
                var subs = user.get('oidc_subs');
                if(!subs) subs = [];
                if(!~subs.indexOf(profile.sub)) subs.push(profile.sub);
                //user.set('oidc_subs', subs);
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
                    //res.json({message: "Login Success!", jwt: jwt});
                    //res.set('jwt', jwt);
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
        var pos = subs.indexOf(sub);
        if(~pos) subs.splice(sub, 1);
        //user.set('oidc_subs', subs); //maybe not needed?
        user.save().then(function() {
            res.json({message: "Successfully disconnected an oauth2 account", user: user});
        });    
    });
});

module.exports = router;
