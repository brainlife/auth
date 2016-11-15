
//contrib
var express = require('express');
var router = express.Router();
var request = require('request');
var winston = require('winston');
var jwt = require('express-jwt');
var clone = require('clone');
var passport = require('passport');
var GitHubStrategy = require('passport-github').Strategy;

//mine
var config = require('../config');
var logger = new winston.Logger(config.logger.winston);

var common = require('../common');
var db = require('../models');

passport.use(new GitHubStrategy({
    clientID: config.github.client_id,
    clientSecret: config.github.client_secret,
    callbackURL: config.github.callback_url,
}, function(accessToken, refreshToken, profile, cb) {
    /*
    User.findOrCreate({ githubId: profile.id }, function (err, user) {
      return cb(err, user);
    });
    */
    //console.log("authenticated with github ID:"+profile.id);
    //console.dir(profile);
    db.User.findOne({where: {"github": profile.username }}).then(function(user) {
        cb(null, user, profile);
    });
}));

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
    user.updateTime('iucas_login');
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
    passport.authenticate('github', /*{failureRedirect: '/auth/error'},*/ function(err, user, info) {
        if(err) {
            console.error(err);
            return res.redirect('/auth/#/signin?msg='+"Failed to authenticate");
        }
        if(req.user) {
            //association
            res.clearCookie('associate_jwt');
            if(user) {
                //TODO - #/settings/account doesn't handle msg yet
                return res.redirect('/auth/#/settings/account?msg=The google account is already associated to a SCA account');
            }
            db.User.findOne({where: {id: req.user.sub}}).then(function(user) {
                if(!user) throw new Error("couldn't find user record with SCA sub:"+req.user.sub);
                user.github = info.username;
                user.save().then(function() {
                    //console.log("saved");
                    //console.dir(user);
                    res.redirect('/auth/#/settings/account');
                });
            });
        } else {
            if(!user) {
                return res.redirect('/auth/#/signin?msg='+"Your github account is not registered to SCA yet. Please login using your username/password first, then associate your github account inside account settings.");
            }
            common.createClaim(user, function(err, claim) {
                if(err) return next(err);
                var jwt = common.signJwt(claim);
                user.updateTime('github_login');
                user.save().then(function() {
                    //res.json({message: "Login Success!", jwt: jwt});
                    //res.set('jwt', jwt);
                    res.redirect('/auth/#/success/'+jwt);
                });
            });
        }
    })(req, res, next);
});

//start github account association
router.get('/associate/:jwt', jwt({secret: config.auth.public_key, 
getToken: function(req) { return req.params.jwt; }}), 
function(req, res, next) {
    //var exp = new Date();
    //exp.setMinutes(exp.getMinutes()+5); //only valid for 5 minutes (and will be removed once account is associated)
    res.cookie("associate_jwt", req.params.jwt, {
        //it's really overkill but .. why not? (maybe helps to hide from log?)
        httpOnly: true,
        secure: true,
        maxAge: 1000*60*5,//5 minutes should be enough
        //expires: exp,
    });
    passport.authenticate('github')(req, res, next);
});

/*
router.get('/callback/associate/:jwt', jwt({secret: config.auth.public_key, 
getToken: function(req) {
    return req.params.jwt; 
}}), 
function(req, res, next) {
    passport.authenticate('github', function(err, user, info) {
        //ignore error
        if(!info) return next("failed to obtain your github info");
        //console.log("/callback/associate called. username: "+info.username);
        db.User.findOne({where: {id: req.user.sub}}).then(function(user) {
            if(!user) throw new Error("couldn't find user record with SCA sub:"+req.user.sub);
            user.github = info.username;
            user.save().then(function() {
                res.redirect('/auth/#/settings/account');
            });
        });
    })(req, res, next);
});
*/

/*
router.get('/verify', jwt({secret: config.auth.public_key, credentialsRequired: false}), function(req, res, next) {
    var ticket = req.query.casticket;

    request('https://cas.iu.edu/cas/validate?cassvc=IU&casticket='+ticket+'&casurl='+casurl, function (err, response, body) {
        if(err) return next(err);
        if (response.statusCode == 200) {
            var reslines = body.split("\n");
            if(reslines[0].trim() == "yes") {
                var uid = reslines[1].trim();
                db.User.findOne({where: {"iucas": uid}}).then(function(user) {
                //finduserByiucasid(uid, function(err, user) {
                //    if(err) return next(err);
                    if(!user) {
                        if(req.user) {
                            //If user is already logged in, but no iucas associated yet.. then auto-associate.
                            //If someone with only local account let someone else login via iucas on the same browser, while the first person is logged in,
                            //that someone else can then start using the first person's account after he leaves the computer. However, user intentionally
                            //visiting /auth page when the first user is already logged into a system is very unlikely, since the user most likely will
                            //sign out so that second user can login. also, if this situation to ever occur, user should be presented with 
                            //"we have associated your account" message so that first user should be aware of this happening
                            associate(req.user, uid, res, function(err, jwt) {
                                res.json({jwt: jwt});
                            });
                        } else {
                            register_newuser(uid, res, next);
                        }
                    } else {
                        var err = user.check();
                        if(err) return next(err);
                        
                        //all good. issue token
                        logger.debug("iucas authentication successful. iu id:"+uid);
                        issue_jwt(user, function(err, jwt) {
                            if(err) return next(err);
                            res.json({jwt:jwt});
                        });
                    }
                }).catch(next); //pass the err object
            } else {
                logger.error("IUCAS failed to validate");
                res.sendStatus("403");//Is 403:Forbidden appropriate return code?
            }
        } else {
            //non 200 code...
            next(body);
        }
    })
});
*/

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
