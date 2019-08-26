
//contrib
const express = require('express');
const router = express.Router();
const request = require('request');
const winston = require('winston');
const jwt = require('express-jwt');
const clone = require('clone');
const passport = require('passport');
const GitHubStrategy = require('passport-github').Strategy;

//mine
const config = require('../config');
const logger = winston.createLogger(config.logger.winston);

const common = require('../common');
const db = require('../models');

passport.use(new GitHubStrategy({
    clientID: config.github.client_id,
    clientSecret: config.github.client_secret,
    callbackURL: config.github.callback_url,
}, function(accessToken, refreshToken, profile, cb) {
    db.mongo.User.findOne({'ext.github': profile.username, active: true}).then(function(user) {
        cb(null, user, profile);
    });
}));

//normal signin
router.get('/signin', passport.authenticate('github'));

//callback that handles both normal and association(if cookies.associate_jwt is set and valid)
router.get('/callback', jwt({
    secret: config.auth.public_key,
    credentialsRequired: false,
    getToken: function(req) {
        return req.cookies.associate_jwt;
    },
}), function(req, res, next) {
    console.log("github signin /callback called ");
    passport.authenticate('github', /*{failureRedirect: '/auth/error'},*/ function(err, user, profile) {
        //logger.debug("github callback", JSON.stringify(profile, null, 4));
        if(err) {
            console.error(err);
            return res.redirect('/auth/#!/signin?msg='+"Failed to authenticate");
        }
        if(req.user) {
            //association
            res.clearCookie('associate_jwt');
            if(user) {
                var messages = [{
                    type: "error", 
                    message: "Your github account is already associated to another account. Please signoff / login with your github account."
                }];
                res.cookie('messages', JSON.stringify(messages), {path: '/'});
                return res.redirect('/auth/#!/settings/account');
            }
            db.mongo.User.findOne({sub: req.user.sub, active: true}).then(function(user) {
                if(!user) throw new Error("couldn't find user record with sub:"+req.user.sub);
                user.ext.github = profile.username;
                user.save().then(function() {
                    var messages = [{
                        type: "success", 
                        message: "Successfully associated your github account"
                    }];
                    res.cookie('messages', JSON.stringify(messages), {path: '/'});
                    res.redirect('/auth/#!/settings/account');
                });
            });
        } else {
            if(!user) {
                if(config.github.auto_register) {
                    register_newuser(profile, res, next);
                } else {
                    res.redirect('/auth/#!/signin?msg='+"Your github account is not yet registered. Please login using your username/password first, then associate your github account inside account settings.");
                }
            } else {
                common.createClaim(user, function(err, claim) {
                    if(err) return next(err);
                    user.times.github_login = new Date();
                    user.markModified('times');
                    user.save().then(function() {
                        common.publish("user.login."+user.sub, {type: "github", username: user.username, exp: claim.exp, headers: req.headers});
                        let jwt = common.signJwt(claim);
                        res.redirect('/auth/#!/success/'+jwt);
                    });
                });
            }
        }
    })(req, res, next);
});

function register_newuser(profile, res, next) {
    //issue temporary token to complete the signup process
    let ext = {
        github: profile.username, //don't need ext. here
    }

    let _default = {
        username: profile.username, //default to github username.. (user can change it)
        fullname: profile.displayName,
    }
    if(profile.emails && profile.emails[0]) _default.email = profile.emails[0].value; //some user doesn't have email in profile..

    if(profile.email && profile.emails.length > 0) user.email = profile.emails[0].value;
    var temp_jwt = common.signJwt({ exp: (Date.now() + config.auth.ttl)/1000, ext, _default})
    logger.info("signed temporary jwt token for github signup:"+temp_jwt);
    res.redirect('/auth/#!/signup/'+temp_jwt);
}

//start github account association
router.get('/associate/:jwt', jwt({secret: config.auth.public_key, getToken: function(req) { return req.params.jwt; }}), 
function(req, res, next) {
    res.cookie("associate_jwt", req.params.jwt, {
        //it's really overkill but .. why not? (maybe helps to hide from log?)
        httpOnly: true,
        secure: true,
        maxAge: 1000*60*5,//5 minutes should be enough
    });
    passport.authenticate('github')(req, res, next);
});

//should I refactor?
router.put('/disconnect', jwt({secret: config.auth.public_key}), function(req, res, next) {
    db.mongo.User.findOne({sub: req.user.sub}).then(function(user) {
        if(!user) return res.status(401).end();
        user.ext.github = null;
        user.save().then(function() {
            res.json({message: "Successfully disconnected github account.", user: user});
        });    
    });
});

module.exports = router;
