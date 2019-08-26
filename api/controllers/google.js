
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
var logger = winston.createLogger(config.logger.winston);

var common = require('../common');
var db = require('../models');

passport.use(new GoogleStrategy({
    clientID: config.google.client_id,
    clientSecret: config.google.client_secret,
    callbackURL: config.google.callback_url,
}, function(accessToken, refreshToken, profile, cb) {
    console.dir(profile);
    db.mongo.User.findOne({'ext.googleid': profile.id, active: true}).then(function(user) {
        cb(null, user, profile);
    });
}));

/* profile sample
_json: 
 { kind: 'plus#person',
   etag: '"xw0en60W6-NurXn4VBU-CMjSPEw/dXLp7lxIORcKBZb8-ywaX36Ffh8"',
   nickname: 'JoeyNuts',
   occupation: 'Software Engineer',
   skills: 'Programming, Bicycling, Guitar, Blender-3D Editing',
   gender: 'male',
   urls: [ [Object], [Object], [Object], [Object], [Object], [Object] ],
   objectType: 'person',
   id: '112741998841961652162',
   displayName: 'Soichi Hayashi',
   name: { familyName: 'Hayashi', givenName: 'Soichi' },
   tagline: 'Software Engineer who loves Software Engineering',
   braggingRights: 'Founder for dsBudget,Father of 2',
   aboutMe: 'Work at Indiana University for Open Science Grid Operations team.',
   url: 'https://plus.google.com/+SoichiHayashi2014',
   image: 
    { url: 'https://lh6.googleusercontent.com/-zBuz_fiQ2Iw/AAAAAAAAAAI/AAAAAAAA7_k/EsAaFZtWSgM/photo.jpg?sz=50',
      isDefault: false },
   organizations: [ [Object], [Object] ],
   placesLived: [ [Object], [Object] ],
   isPlusUser: true,
   language: 'en',
   verified: false,
   cover: { layout: 'banner', coverPhoto: [Object], coverInfo: [Object] } } }
*/

//normal signin
router.get('/signin', passport.authenticate('google', {scope: ['profile']}));

//callback that handles both normal and association(if cookies.associate_jwt is set and valid)
router.get('/callback', jwt({
    secret: config.auth.public_key,
    credentialsRequired: false,
    getToken: req=>req.cookies.associate_jwt,
}), function(req, res, next) {
    console.log("google signin /callback called ");
    passport.authenticate('google', function(err, user, profile) {
        if(err) {
            console.error(err);
            return res.redirect('/auth/#!/signin?msg='+"Failed to authenticate");
        }
        if(req.user) {
            //association
            res.clearCookie('associate_jwt');
            if(user) {
                //TODO - #/settings/account doesn't handle msg yet
                var messages = [{
                    type: "error", 
                    message: "Your Google account is already associated to another account. Please signoff / login with your google account.",
                }];
                res.cookie('messages', JSON.stringify(messages), {path: '/'});
                return res.redirect('/auth/#!/settings/account');
            }
            db.mongo.User.findOne({sub: req.user.sub, active: true}).then(function(user) {
                if(!user) throw new Error("couldn't find user record with sub:"+req.user.sub);
                user.ext.googleid = profile.id;
                user.save().then(function() {
                    res.redirect('/auth/#!/settings/account');
                });
            });
        } else {
            //normal sign in
            logger.debug("handling normal signin");
            if(!user) {
                if(config.google.auto_register) {
                    register_newuser(profile, res, next);
                } else {
                    res.redirect('/auth/#!/signin?msg='+"Your google account is not registered yet. Please login using your username/password first, then associate your google account inside account settings.");
                }
            } else {
                common.createClaim(user, function(err, claim) {
                    if(err) return next(err);
                    user.times.google_login = new Date();
                    user.markModified('times');
                    user.save().then(function() {
                        common.publish("user.login."+user.sub, {type: "google", username: user.username, exp: claim.exp, headers: req.headers});
                        var jwt = common.signJwt(claim);
                        res.redirect('/auth/#!/success/'+jwt);
                    });
                });
            }
        }
    })(req, res, next);
});
/*
1|auth     | { id: '112741998841961652162',
1|auth     |   displayName: 'Soichi Hayashi',
1|auth     |   name: { familyName: 'Hayashi', givenName: 'Soichi' },
1|auth     |   photos:
1|auth     |    [ { value:
1|auth     |         'https://lh6.googleusercontent.com/-zBuz_fiQ2Iw/AAAAAAAAAAI/AAAAAAAA7_k/EsAaFZtWSgM/s50/photo.jpg' } ],

 */

function register_newuser(profile, res, next) {
    //issue temporary token to complete the signup process
    let ext = {
        googleid: profile.id,
    }

    let _default = {
        fullname: profile.displayName,
    }

    var temp_jwt = common.signJwt({ exp: (Date.now() + config.auth.ttl)/1000, ext, _default})
    logger.info("signed temporary jwt token for google signup:"+temp_jwt);
    res.redirect('/auth/#!/signup/'+temp_jwt);
}

//start account association
router.get('/associate/:jwt', jwt({secret: config.auth.public_key, 
getToken: function(req) { return req.params.jwt; }}), 
function(req, res, next) {
    res.cookie("associate_jwt", req.params.jwt, {
        //it's really overkill .. but why not? (maybe helps to hide from log?)
        httpOnly: true,
        secure: true,
        maxAge: 1000*60*5,//5 minutes should be enough
        //expires: exp,
    });
    passport.authenticate('google', { scope: ['profile'], /*callbackURL: callbackurl*/ })(req, res, next);
});

//should I refactor?
router.put('/disconnect', jwt({secret: config.auth.public_key}), function(req, res, next) {
    db.mongo.User.findOne({sub: req.user.sub}).then(function(user) {
        if(!user) res.status(401).end();
        user.ext.googleid = null;
        user.save().then(function() {
            res.json({message: "Successfully disconnected google account.", user: user});
        });    
    });
});

module.exports = router;
