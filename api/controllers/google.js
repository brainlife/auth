
//contrib
var express = require('express');
var router = express.Router();
var request = require('request');
var winston = require('winston');
var jwt = require('express-jwt');
var clone = require('clone');
var passport = require('passport');
var GoogleStrategy = require('passport-google-oauth20').Strategy;

//mine
var config = require('../config');
var logger = new winston.Logger(config.logger.winston);

var common = require('../common');
var db = require('../models');

passport.use(new GoogleStrategy({
    clientID: config.google.client_id,
    clientSecret: config.google.client_secret,
    callbackURL: config.google.callback_url,
}, function(accessToken, refreshToken, profile, cb) {
    //console.log("authenticated with google");
    //console.dir(profile);
    db.User.findOne({where: {"googleid": profile.id }}).then(function(user) {
        cb(null, user, profile);
    });
}));

/* profile sample
1|sca-auth |   _json: 
1|sca-auth |    { kind: 'plus#person',
1|sca-auth |      etag: '"xw0en60W6-NurXn4VBU-CMjSPEw/dXLp7lxIORcKBZb8-ywaX36Ffh8"',
1|sca-auth |      nickname: 'JoeyNuts',
1|sca-auth |      occupation: 'Software Engineer',
1|sca-auth |      skills: 'Programming, Bicycling, Guitar, Blender-3D Editing',
1|sca-auth |      gender: 'male',
1|sca-auth |      urls: [ [Object], [Object], [Object], [Object], [Object], [Object] ],
1|sca-auth |      objectType: 'person',
1|sca-auth |      id: '112741998841961652162',
1|sca-auth |      displayName: 'Soichi Hayashi',
1|sca-auth |      name: { familyName: 'Hayashi', givenName: 'Soichi' },
1|sca-auth |      tagline: 'Software Engineer who loves Software Engineering',
1|sca-auth |      braggingRights: 'Founder for dsBudget,Father of 2',
1|sca-auth |      aboutMe: 'Work at Indiana University for Open Science Grid Operations team.',
1|sca-auth |      url: 'https://plus.google.com/+SoichiHayashi2014',
1|sca-auth |      image: 
1|sca-auth |       { url: 'https://lh6.googleusercontent.com/-zBuz_fiQ2Iw/AAAAAAAAAAI/AAAAAAAA7_k/EsAaFZtWSgM/photo.jpg?sz=50',
1|sca-auth |         isDefault: false },
1|sca-auth |      organizations: [ [Object], [Object] ],
1|sca-auth |      placesLived: [ [Object], [Object] ],
1|sca-auth |      isPlusUser: true,
1|sca-auth |      language: 'en',
1|sca-auth |      verified: false,
1|sca-auth |      cover: { layout: 'banner', coverPhoto: [Object], coverInfo: [Object] } } }
*/

/*
function register_newuser(uid, res, next) {
    logger.info("registering new user with iucas id:"+uid);
    db.User.findOne({where: {'username': uid}}).then(function(user) {
        if(user) {
            logger.warn("username already registered:"+uid+"(can't auto register)");
            //TODO - instead of showing this error message, maybe I should redirect user to
            //a page to force user to login via user/pass, then associate the IU CAS IU once user logs in 
            next("This is the first time you login with IU CAS account, "+
                 "but we couldn't register this account since the username '"+uid+"' is already registered in our system. "+
                 "If you have already registered with username / password, please login with username / password first, ");
        } else {
            //brand new user - go ahead and create a new account using IU id as sca user id
            var u = clone(config.auth.default);
            u.username = uid; //let's use IU id as local username
            u.email = uid+"@iu.edu";
            u.email_confirmed = true; //let's trust IU..
            u.iucas = uid;
            db.User.create(u).then(function(user) {
                issue_jwt(user, function(err, jwt) {
                    if(err) return next(err);
                    res.json({jwt:jwt, registered: true});
                });
            });
        }
    });
}
*/

/*
function issue_jwt(user, cb) {
    user.updateTime('google_login');
    user.save().then(function() {
        common.createClaim(user, function(err, claim) {
            if(err) return cb(err);
            var jwt = common.signJwt(claim);
            cb(null, jwt);
        });
    });
}
*/

//normal signin
router.get('/signin', passport.authenticate('google', {scope: ['profile']}));
//callback that handles both normal and association(if cookies.associate_jwt is set and valid)
router.get('/callback', jwt({
    secret: config.auth.public_key,
    credentialsRequired: false,
    getToken: function(req) {
        return req.cookies.associate_jwt;
    },
}), function(req, res, next) {
    console.log("google signin /callback called ");
    passport.authenticate('google', function(err, user, info) {
        if(err) {
            console.error(err);
            return res.redirect('/auth/#/signin?msg='+"Failed to authenticate");
        }
        if(req.user) {
            //association
            res.clearCookie('associate_jwt');
            if(user) {
                //TODO - #/settings/account doesn't handle msg yet
                return res.redirect('/auth/#/settings/account?msg=The github account is already associated to a SCA account');
            }
            db.User.findOne({where: {id: req.user.sub}}).then(function(user) {
                if(!user) throw new Error("couldn't find user record with SCA sub:"+req.user.sub);
                user.googleid = info.id;
                user.save().then(function() {
                    //console.log("saved");
                    //console.dir(user);
                    res.redirect('/auth/#/settings/account');
                });
            });
        } else {
            //normal sign in
            if(!user) {
                return res.redirect('/auth/#/signin?msg='+"Your google account is not registered to SCA yet. Please login using your username/password first, then associate your google account inside account settings.");
            }
            common.createClaim(user, function(err, claim) {
                if(err) return next(err);
                var jwt = common.signJwt(claim);
                user.updateTime('google_login');
                user.save().then(function() {
                    //res.json({message: "Login Success!", jwt: jwt});
                    //res.set('jwt', jwt);
                    res.redirect('/auth/#/success/'+jwt);
                });
            });
        }
    })(req, res, next);
});

//start account association
router.get('/associate/:jwt', jwt({secret: config.auth.public_key, 
getToken: function(req) { return req.params.jwt; }}), 
function(req, res, next) {
    //TODO - maybe I should create a temporarly token ?
    //var callbackurl = "https://soichi7.ppa.iu.edu/api/auth/google/callback/associate/"+req.params.jwt;
    //var exp = new Date();
    //exp.setMinutes(exp.getMinutes()+5); //only valid for 5 minutes (and will be removed once account is associated)
    res.cookie("associate_jwt", req.params.jwt, {
        //it's really overkill but .. why not? (maybe helps to hide from log?)
        httpOnly: true,
        secure: true,
        maxAge: 1000*60*5,//5 minutes should be enough
        //expires: exp,
    });
    passport.authenticate('google', { scope: ['profile'], /*callbackURL: callbackurl*/ })(req, res, next);
});

/*
router.get('/callback/associate/:jwt', jwt({secret: config.auth.public_key, 
getToken: function(req) {
    return req.params.jwt; 
}}), 
function(req, res, next) {
    passport.authenticate('google', function(err, user, info) {
        //ignore error
        if(!info) return next("failed to obtain your google account info");
        //console.log("/callback/associate called. google id: "+info.id);
        db.User.findOne({where: {id: req.user.sub}}).then(function(user) {
            if(!user) throw new Error("couldn't find user record with SCA sub:"+req.user.sub);
            user.googleid = info.id;
            user.save().then(function() {
                console.log("saved");
                console.dir(user);
                res.redirect('/auth/#/settings/account');
            });
        });
    })(req, res, next);
});
*/

//should I refactor?
router.put('/disconnect', jwt({secret: config.auth.public_key}), function(req, res, next) {
    db.User.findOne({
        where: {id: req.user.sub}
    }).then(function(user) {
        if(!user) res.status(401).end();
        user.googleid = null;
        user.save().then(function() {
            res.json({message: "Successfully disconnected google account.", user: user});
        });    
    });
});

module.exports = router;
