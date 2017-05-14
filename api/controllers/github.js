
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
const logger = new winston.Logger(config.logger.winston);

const common = require('../common');
const db = require('../models');

passport.use(new GitHubStrategy({
    clientID: config.github.client_id,
    clientSecret: config.github.client_secret,
    callbackURL: config.github.callback_url,
}, function(accessToken, refreshToken, profile, cb) {
    db.User.findOne({where: {"github": profile.username }}).then(function(user) {
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
        logger.debug("github callback", JSON.stringify(profile, null, 4));
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
                    message: "The google account is already associated to a SCA account"
                }];
                res.cookie('messages', JSON.stringify(messages), {path: '/'});
                res.redirect('/auth/#!/settings/account');
            } else {
                db.User.findOne({where: {id: req.user.sub}}).then(function(user) {
                    if(!user) throw new Error("couldn't find user record with SCA sub:"+req.user.sub);
                    user.github = profile.username;
                    user.save().then(function() {
                        var messages = [{
                            type: "success", 
                            message: "Successfully associated your github account"
                        }];
                        res.cookie('messages', JSON.stringify(messages), {path: '/'});
                        res.redirect('/auth/#!/settings/account');
                    });
                });
            }
        } else {
            if(!user) {
                if(config.github.auto_register) {
                    register_newuser(profile, res, next);
                } else {
                    res.redirect('/auth/#!/signin?msg='+"Your github account is not yet registered. Please login using your username/password first, then associate your github account inside account settings.");
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
    var u = clone(config.auth.default);
    //u.username = profile.username;
    u.email = profile.emails[0].value; //TODO always set?
    u.email_confirmed = true; //let's trust github
    u.github = profile.username;
    u.fullname = profile.displayName;
    db.User.create(u).then(function(user) {
        logger.info("registered new user", JSON.stringify(user));
        user.addMemberGroups(u.gids, function() {
            issue_jwt(user, profile, function(err, jwt) {
                if(err) return next(err);
                logger.info("registration success", jwt);
                res.redirect('/auth/#!/success/'+jwt);
            });
        });
    });
}

function issue_jwt(user, profile, cb) {
    common.createClaim(user, function(err, claim) {
        if(err) return cb(err);
        var jwt = common.signJwt(claim);
        user.updateTime('github_login');
        user.save().then(function() {
            cb(null, jwt);
        });
    });
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
    db.User.findOne({
        where: {id: req.user.sub}
    }).then(function(user) {
        if(!user) res.status(401).end();
        user.github = null;
        user.save().then(function() {
            res.json({message: "Successfully disconnected github account.", user: user});
        });    
    });
});

module.exports = router;
