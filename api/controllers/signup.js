
//contrib
const express = require('express');
const router = express.Router();
const winston = require('winston');
const clone = require('clone');
const async = require('async');
const jwt = require('express-jwt');

//mine
const config = require('../config');
const logger = new winston.Logger(config.logger.winston);
const db = require('../models');
const common = require('../common');

function registerUser(body, done) {
    var u = clone(config.auth.default);
    u.username = body.username;
    u.fullname = body.fullname;
    u.email = body.email;
    var user = db.User.build(u);
    logger.info("registering new user: "+u.username);
    //logger.info(user);
    user.setPassword(body.password, function(err) {
        if(err) return done(err);
        logger.debug("set password done");
        user.save().then(function() {
            //add to default groups
            user.addMemberGroups(u.gids, function() {
                done(user);    
            });
        });
    });
}

function updateUser(req, done) {
    db.User.findOne({where: {id: req.user.sub} }).then(function(user) {
        if(!user) return done("can't find user");

        //set things if it's not set yet
        if(!user.username) user.username = req.body.username;
        if(!user.fullname) user.fullname = req.body.fullname;
        if(!user.email) user.email = req.body.email;
        if(!user.password_hash) {
            user.setPassword(req.body.password, function(err) {
                if(err) return done(err);
                user.save().then(()=>{
                    done(null, user);
                });
            });
        } else {
            user.save().then(()=>{
                done(null, user);
            });
        }
    });
}

/**
 * @api {post} /signup Register new user
 * @apiName Signup
 * @apiDescription Register new user with username and email
 * @apiGroup Local
 *
 * @apiParam {String} username Username
 * @apiParam {String} password Password
 * @apiParam {String} email Email
 *
 */

router.post('/', jwt({secret: config.auth.public_key, credentialsRequired: false}), function(req, res, next) {
    var username = req.body.username;
    var email = req.body.email;

    function post_process(err, user) {
        if(err) return next(err);
        common.createClaim(user, function(err, claim) {
            if(err) return next(err);
            var jwt = common.signJwt(claim);
            if(config.local.email_confirmation) {
                common.send_email_confirmation(req.headers.referer||config.local.url, user, function(err) {
                    if(err) {
                        if(!req.user) {
                            //if we fail to send email, we should unregister the user we just created
                            user.destroy({force: true}).then(function() {
                                logger.error("removed newly registred record - email failurer");
                                res.status(500).json({message: "Failed to send confirmation email. Please make sure your email address is valid."});
                            });
                        } else {
                            res.status(500).json({message: "Failed to send confirmation email. Please make sure your email address is valid"});
                        }
                    } else {
                        res.json({path:'/confirm_email/'+user.id, message: "Confirmation Email has been sent. Please check your email inbox.", jwt: jwt});
                    }
                });
            } else {
                //no need for email confrmation..
                res.json({jwt: jwt, sub: user.id});
            }
        });
    }

    //TODO - validate password strength? (req.body.password)
    //check for username already taken
    db.User.findOne({where: {username: username} }).then(function(user) {
        if(user) {
            //TODO - maybe I should go ahead and forward user to login form?
            return next('The username you chose is already registered. If it is yours, please try signing in, or register with a different username.');
        } else {
            //check for email already taken
            db.User.findOne({where: {email: email} }).then(function(user) {
                if(user) {
                    //TODO - maybe I should go ahead and forward user to login form?
                    return next('The email address you chose is already registered. If it is yours, please try signing in, or register with a different email address.');
                } else {
                    if(req.user) {
                        updateUser(req, post_process);
                    } else {
                        registerUser(req.body, post_process);
                    }
                }
            });
        }
    });
})

module.exports = router;

