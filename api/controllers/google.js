
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
    db.User.findOne({where: {googleid: profile.id, active: true}}).then(function(user) {
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
    passport.authenticate('google', function(err, user, info) {
        if(err) {
            console.error(err);
            return res.redirect('/auth/#!/signin?msg='+"Failed to authenticate");
        }
        if(req.user) {
            //association
            logger.debug("handling association");
            res.clearCookie('associate_jwt');
            if(user) {
                //TODO - #/settings/account doesn't handle msg yet
                var messages = [{
                    type: "error", 
                    message: "Your Google account is already associated to another account.",
                }];
                res.cookie('messages', JSON.stringify(messages), {path: '/'});
                return res.redirect('/auth/#!/settings/account');
            }
            db.User.findOne({where: {id: req.user.sub}}).then(function(user) {
                if(!user) throw new Error("couldn't find user record with sub:"+req.user.sub);
                user.googleid = info.id;
                user.save().then(function() {
                    //console.log("saved");
                    //console.dir(user);
                    res.redirect('/auth/#!/settings/account');
                });
            });
        } else {
            //normal sign in
            logger.debug("handling normal signin");
            if(!user) {
                return res.redirect('/auth/#!/signin?msg='+"Your google account is not registered yet. Please login using your username/password first, then associate your google account inside account settings.");
            }
            common.createClaim(user, function(err, claim) {
                if(err) return next(err);
                var jwt = common.signJwt(claim);
                user.updateTime('google_login');
                user.save().then(function() {
                    //res.json({message: "Login Success!", jwt: jwt});
                    //res.set('jwt', jwt);
                    res.redirect('/auth/#!/success/'+jwt);
                });
            });
        }
    })(req, res, next);
});

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
