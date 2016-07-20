
//contrib
var express = require('express');
var router = express.Router();
var passport = require('passport');
var passportldap = require('passport-ldapauth');
var winston = require('winston');
var jwt = require('express-jwt');

//mine
var config = require('../config');
var logger = new winston.Logger(config.logger.winston);
var common = require('../common');
var db = require('../models');

function registerUser(ldapuser, cb) {
    var u = clone(config.auth.default);
    u.ldap = ldapuser.cn; 
    u.username = ldapuser.cn;
    u.iucas = ldapuser.cn; //TODO should I do this?
    u.email = ldapuser.mail;
    u.email_confirmed = true; //let's trust IU
    u.fullname = ldapuser.givenName+" "+ldapuser.sn;
    var user = db.User.build(u);
    logger.info("registering user through first time ldap auth");
    logger.info(user);
    user.save().then(cb);
}

passport.use(new passportldap(config.ldap,
    function(ldapuser, done) {
        logger.info("handling ldap auth post processing");
        //look for ldap field, but also look for username (for now)
        //TODO - this means IU user can *takeover* non-IU SCA user.. eventually I might drop this
        db.User.findOne({where: {$or: {"ldap": ldapuser.cn, "username": ldapuser.cn }}}).then(function(user) {
            if (!user) {
                //first time(?) .. auto register
                //TODO - need to handle username collision
                registerUser(ldapuser, function(err, user) {
                    done(null, user);
                }); 
            } else {
                done(null, user);
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
        if (!user) return next(info);
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
