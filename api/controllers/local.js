
const express = require('express');
const router = express.Router();
const passport = require('passport');
const passport_localst = require('passport-local').Strategy;
const winston = require('winston');
const jwt = require('express-jwt');

const config = require('../config');
const logger = winston.createLogger(config.logger.winston);
const common = require('../common');
const db = require('../models');

passport.use(new passport_localst(
    function(username_or_email, password, done) {
        db.mongo.User.findOne({$or: [{"username": username_or_email}, {"email": username_or_email}]}).then(user=>{
            if (!user) {
                setTimeout(function() {
                    done(null, false, { message: 'Incorrect email or username', code: 'bad_username' });
                }, 2000);
                return;
            } else {
                if(!user.password_hash) {
                    return done(null, false, { 
                        message: 'Password login is not enabled for this account (please try 3rd party authentication)', 
                        code: 'no_password' 
                    });
                }
                if(!common.check_password(user, password)) {
                    //delay returning to defend against password sweeping attack
                    setTimeout(function() {
                        done(null, false, { message: 'Incorrect user/password', code: 'bad_password' });
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
 * @apiDescription Perform authentication using username(or email) and password get JWT token.
 * @apiGroup Local
 *
 * @apiParam {String} username Username or email address
 * @apiParam {String} password Password!
 * @apiParam {String} [ttl]    time-to-live in milliseconds (if not set, it will be defaulted to server default)
 *
 * @apiSuccess {Object} jwt JWT token
 */
router.post('/auth', function(req, res, next) {
    passport.authenticate('local', function(err, user, info) {
        if (err) return next(err);
        if (!user) {
            const audit = new db.mongo.FailedLogin({username: req.body.username, code: info.code, headers: req.headers});
            audit.save();
            common.publish("user.login_fail", {type: "userpass", headers: req.headers, message: info.message, username: req.body.username});
            return next(info);
        }

        const error = common.checkUser(user, req);
        if(error) return next(error);
        common.createClaim(user, function(err, claim) {
            if(err) return next(err);
            if(req.body.ttl) claim.exp = (Date.now() + req.body.ttl)/1000;
            var jwt = common.signJwt(claim);
            user.times.local_login = new Date();
            user.reqHeaders = req.headers;
            user.markModified('times');
            user.save().then(function() {
                common.publish("user.login."+user.sub, {type: "userpass", username: user.username, exp: claim.exp, headers: req.headers});
                res.json({message: "Login Success", jwt, sub: user.sub});
            });
        });
    })(req, res, next);
});

//used to setpassword if password_hash is empty or update exiting password (with a valid current password)
router.put('/setpass', jwt({
    secret: config.auth.public_key,
    algorithms: [config.auth.sign_opt.algorithm],
}), function(req, res, next) {
    db.mongo.User.findOne({sub: req.user.sub}).then(user=>{
        logger.debug("setting password for sub:"+req.user.sub);
        if(user) {
            if(user.password_hash) {
                if(!common.check_password(user, req.body.password_old)) {
                    common.publish("user.setpass_fail."+user.sub, {username: user.username, message: "wrong current pass"});
                    return setTimeout(function() {
                        next("Wrong current password");
                    }, 2000);
                }
            }
            common.hash_password(req.body.password, (err, hash)=>{
                if(err) return next(err);
                user.password_hash = hash;
                user.times.password_reset = new Date();
                user.save().then(()=>{
                    common.publish("user.setpass."+user.sub, {username: user.username});
                    res.json({status: "ok", message: "Password reset successfully."});
                });
            });
        } else {       
            logger.info("failed to find user with sub:"+req.user.sub);
            res.status(404).end();
        }
    });
});

/**
 * @api {post} /local/resetpass Handle both resetpass request and fulfillment request
 * @apiName LocalAuth
 * @apiDescription  (mode 1)
 *                  When this API is called with email field, it will create reset token associated with the owner of the email address 
 *                  and send reset request email with the token on the URL. While doing so, it sets httpOnly cookie with random string
 *                  to be stored on user's browser.
 *                  (mode 2)
 *                  When user receives an email, click on the URL, it will open /forgotpass page which then provide user password reset form.
 *                  The form then submits token, and new password along with the httpOnly cookie back to this API which will then do the
 *                  actual resetting of the password, and clear the password_reset_token.
 * @apiGroup Local
 *
 * @apiParam {String} email     (mode1) User's email address registere.
 * @apiParam {String} token     (mode2) User's password reset token
 * @apiParam {String} password  (mode2) User's new password
 * @apiParam {String} password_reset (mode2) [via cookie] browser secret token to verify user is using the same browser to reset password
 *
 * @apiSuccess {Object} message Containing success message
 */
router.post('/resetpass', function(req, res, next) {
    if(req.body.email)  {
        //initiate password reset
        var email = req.body.email;
        db.mongo.User.findOne({email}).then(user=>{
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
        if(!token || !password) return next("missing parameters");
        db.mongo.User.findOne({password_reset_token: token, password_reset_cookie: cookie}).then(user=>{
            if(user) {
                common.hash_password(password, (err, hash)=>{
                    if(err) return next(err);
                    user.password_hash = hash;
                    user.password_reset_token = null;
                    user.password_reset_cookie = null;
                    user.times.password_reset = new Date();
                    user.markModified('times');
                    user.save().then(function() {
                        res.json({status: "ok", message: "Password reset successfully."});
                    });
                });
            } else return next("Couldn't find the token provided.");
        });
    }
});

module.exports = router;
