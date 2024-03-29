
//contrib
var express = require('express');
var router = express.Router();
var request = require('request');
var jwt = require('express-jwt');
var clone = require('clone');
var passport = require('passport');
var GitHubStrategy = require('passport-facebook').Strategy;

//mine
var config = require('../config');

var common = require('../common');
var db = require('../models');

//TODO - why is this using GitHubStrategy!?
passport.use(new GitHubStrategy({
    clientID: config.facebook.app_id,
    clientSecret: config.facebook.app_secret,
    callbackURL: config.facebook.callback_url,
}, function(accessToken, refreshToken, profile, cb) {
    db.mongo.User.findOne({facebook: profile.id}).then(function(user) {
        cb(null, user, profile);
    });
}));

//normal signin
router.get('/signin', passport.authenticate('facebook'));

//callback that handles both normal and association(if cookies.associate_jwt is set and valid)
router.get('/callback', jwt({
    secret: config.auth.public_key,
    algorithms: [config.auth.sign_opt.algorithm],
    credentialsRequired: false,
    getToken: function(req) { return req.cookies.associate_jwt; },
}), function(req, res, next) {
    console.log("facebook signin /callback called ");
    passport.authenticate('facebook', function(err, user, info) {
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
                    message: "Your facebook account is already associated to another account"
                }];
                res.cookie('messages', JSON.stringify(messages), {path: '/'});
                return res.redirect(config.auth.settingsCallback);
            }
            db.User.findOne({sub: req.user.sub}).then(function(user) {
                if(!user) throw new Error("couldn't find user record with sub:"+req.user.sub);
                user.ext.facebook = info.id;
                user.save().then(function() {
                    console.log("saved");
                    console.dir(user);
                    console.dir(info);
                    res.redirect(config.auth.settingsCallback);
                });
            });
        } else {
            if(!user) {
                return res.redirect('/auth/#!/signin?msg='+"Your facebook account is not registered yet. Please login using your username/password first, then associate your facebook account inside account settings.");
            }

            const error = common.checkUser(user, req);
            if(error) return next(error);
            common.createClaim(user, function(err, claim) {
                if(err) return next(err);
                var jwt = common.signJwt(claim);
                user.times.facebook_login = new Date();
                user.reqHeaders = req.headers;
                user.markModified('times');
                user.save().then(function() {
                    common.publish("user.login."+user.sub, {type: "facebook", username: user.username, exp: claim.exp, headers: req.headers});
                    res.redirect('/auth/#!/success/'+jwt);
                });
            });
        }
    })(req, res, next);
});

//start facebook account association
router.get('/associate/:jwt', jwt({
    secret: config.auth.public_key, 
    algorithms: [config.auth.sign_opt.algorithm],
    getToken: function(req) { return req.params.jwt; }
}), function(req, res, next) {
    res.cookie("associate_jwt", req.params.jwt, {
        //it's really overkill but .. why not? (maybe helps to hide from log?)
        httpOnly: true,
        secure: true,
        maxAge: 1000*60*5,//5 minutes should be enough
    });
    passport.authenticate('facebook')(req, res, next);
});

//should I refactor?
router.put('/disconnect', jwt({
    secret: config.auth.public_key,
    algorithms: [config.auth.sign_opt.algorithm],
}), function(req, res, next) {
    db.mongo.User.findOne({sub: req.user.sub}).then(function(user) {
        if(!user) res.status(401).end();
        user.ext.facebook = null;
        user.save().then(function() {
            res.json({message: "Successfully disconnected facebook account.", user});
        });    
    });
});

module.exports = router;
