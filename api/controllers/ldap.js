
//contrib
var express = require('express');
var router = express.Router();
var passport = require('passport');
var passportldap = require('passport-ldapauth');
var winston = require('winston');
var jwt = require('express-jwt');
var clone = require('clone');

//mine
var config = require('../config');
var logger = new winston.Logger(config.logger.winston);
var common = require('../common');
var db = require('../models');

function registerUser(ldapuser, cb) {
    var u = clone(config.auth.default);
    u.username = ldapuser.cn;
    u.ldap = ldapuser.cn; 
    u.iucas = ldapuser.cn; //TODO should I do this?
    u.email = ldapuser.mail;
    u.email_confirmed = true; //let's trust IU
    u.fullname = ldapuser.givenName+" "+ldapuser.sn;
    var user = db.User.build(u);
    logger.info("registering user through first time ldap auth - ldap.cn:"+u.username);
    //logger.info(user);
    user.save().then(function() {
        cb(null, user);
    });
}

passport.use(new passportldap(config.ldap,
    function(ldapuser, done) {
        logger.info("handling ldap auth post processing");
        //look for ldap field, but also look for username (for now) so that users who registered with 
        //local username/pass can be authenticated
        //TODO - this means IU user can *takeover* non-IU user.. eventually I might allow both
        //local and ldap authentication, but it will be very confusing to the user.
        db.User.findOne({where: {$or: {ldap: ldapuser.cn, username: ldapuser.cn }, active: true}}).then(function(user) {
            if (!user) {
                //first time(?) .. auto register
                //TODO - need to handle username collision
                registerUser(ldapuser, done);
            } else {
                if(!user.ldap) {
                    //if user is matched using username, and ldap is empty, populate ldap so that 
                    //user will be matched with ldap next time .. 
                    //eventually I should make username matching optional or completely drop it..
                    logger.warn("user account matched via username but ldap was empty - setting ldap account:"+ldapuser.cn);
                    user.ldap = ldapuser.cn;
                    user.save().then(function() {
                        done(null, user);
                    });
                } else {
                    done(null, user);
                }
            }
        });
    }
));

/**
 * @api {post} /ldap/auth Perform ldap authentication
 * @apiName LDAPAuth
 * @apiDescription Perform ldap authentication using username / password params
 * @apiGroup Local
 *
 * @apiParam {String} username LDAP Username
 * @apiParam {String} password LDAP password
 *
 * @apiSuccess {Object} jwt JWT token
 */
router.post('/auth', function(req, res, next) {
    passport.authenticate('ldapauth', {session: false}, function(err, user, info) {
        if (err) return next(err);
        if (!user) return res.status(404).json(info);
        common.createClaim(user, function(err, claim) {
            if(err) return next(err);
            var jwt = common.signJwt(claim);
            user.updateTime('ldap_login');
            user.save().then(function() {
                res.json({message: "Login Success!", jwt: jwt});
            });
        });
    })(req, res, next);
});

module.exports = router;
