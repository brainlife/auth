
//contrib
var express = require('express');
var router = express.Router();
var passport = require('passport');
var passport_localst = require('passport-local').Strategy;
var winston = require('winston');
var jwt = require('express-jwt');

//mine
var config = require('../config');
var logger = new winston.Logger(config.logger.winston);
var common = require('../common');
var db = require('../models');

passport.use(new passport_localst(
    function(username, password, done) {
        db.User.findOne({where: {$or: {"username": username, "email": username }}}).then(function(user) {
            if (!user) {
                return done(null, false, { message: 'Incorrect email or username' });
            } else {
                var err = user.check();
                if(err) return done(null, false, err);
                if(!user.password_hash) {
                    return done(null, false, { message: 'Password login is not enabled for this account' });
                }
                if(!user.isPassword(password)) {
                    //delay returning to defend against password sweeping attack
                    setTimeout(function() {
                        done(null, false, { message: 'Incorrect password' });
                    }, 2000);
                    return;
                }
                done(null, user);
            }
        });
    }
));

/**
 * @api {post} /local/auth Perform authentication
 * @apiName LocalAuth
 * @apiDescription Perform authentication using username(or email) and SCA password get JWT token.
 * @apiGroup Local
 *
 * @apiParam {String} username Username or email address
 * @apiParam {String} password SCA local Password
 *
 * @apiSuccess {Object} jwt JWT token
 */
router.post('/auth', function(req, res, next) {
    passport.authenticate('local', function(err, user, info) {
        if (err) return next(err);
        if (!user) return next(info);
        common.createClaim(user, function(err, claim) {
            if(err) return next(err);
            var jwt = common.signJwt(claim);
            user.updateTime('local_login');
            user.save().then(function() {
                res.json({message: "Login Success!", jwt: jwt});
            });
        });
    })(req, res, next);
});

//used to setpassword if password_hash is empty or update exiting password (with a valid current password)
router.put('/setpass', jwt({secret: config.auth.public_key}), function(req, res, next) {
    db.User.findOne({where: {id: req.user.sub}}).then(function(user) {
        logger.debug("setting password for sub:"+req.user.sub);
        if(user) {
            if(user.password_hash) {
                if(!user.isPassword(req.body.password_old)) {
                    return setTimeout(function() {
                        next("Wrong current password");
                    }, 2000);
                }
            }
            user.setPassword(req.body.password, function(err) {
                if(err) return next(err);
                user.updateTime('password_reset');
                user.save().then(function() {
                    res.json({status: "ok", message: "Password reset successfully."});
                });
            });
        } else {       
            logger.info("failed to find user with sub:"+req.user.sub);
            res.status(404).end();
        }
    });
});

//(post) will initiate password reset
router.post('/resetpass', function(req, res, next) {
    if(req.body.email)  {
        //initiate password reset
        var email = req.body.email;
        db.User.findOne({where: {email: email}}).then(function(user) {
            if(!user) return res.status(404).json({message: "No such email registered"});
            //we need 2 tokens - 1 to confirm user, and 1 to match the browser (cookie)
            user.password_reset_token = Math.random().toString(36).substr(2);
            user.password_reset_cookie = Math.random().toString(36).substr(2);
            common.send_resetemail(req.headers.referer||config.local.url, user, function(err) {
                if(err) return next(err);
                user.save().then(function() {
                    res.cookie('password_reset', user.password_reset_cookie, {httpOnly: true, secure: true}); //should be default to session cookie
                    res.json({message: "Reset token sent"});
                });
            });

        }).catch(next);
    } else {
        //fulfull password reset
        var token = req.body.token;
        var password = req.body.password;
        var cookie = req.cookies.password_reset;
        console.log("-------------------------------");
        console.log(token);
        console.log(cookie);
        if(!token || !password) return next("missing parameters");
        //TODO should I apply minimum password length?
        db.User.findOne({where: {password_reset_token: token, password_reset_cookie: cookie}}).then(function(user) {
            if(user) {
                user.setPassword(password, function(err) {
                    if(err) return next(err);
                    user.password_reset_token = null;
                    user.password_reset_cookie = null;
                    user.save().then(function() {
                        res.json({status: "ok", message: "Password reset successfully."});
                    });
                });
            } else return next("couldn't find the token provided");
        });
    }
});

//reset password (with a valid reset token) ?token=123
router.put('/resetpass', function(req, res, next) {
});

module.exports = router;
