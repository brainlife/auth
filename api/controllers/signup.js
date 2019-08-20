
//contrib
const express = require('express');
const router = express.Router();
const winston = require('winston');
const async = require('async');
const jwt = require('express-jwt');

//mine
const config = require('../config');
const logger = winston.createLogger(config.logger.winston);
const db = require('../models');
const common = require('../common');

async function register_newuser(req, done) {
    //username / email check should have already done at this point

    var u = Object.assign({
        sub: await common.get_nextsub(),
        times: {register: new Date()},
        username: req.body.username,
        fullname: req.body.fullname,
        email: req.body.email,
    }, config.auth.default);
    
    //signup is used to finalize first time 3rd party login (like github)
    //when github auth succeeds for the first time, it creates a temporary jwt token 
    //containing github ID for example. We can apply that info here
    if(req.user && req.user.ext) u.ext = req.user.ext;

    ///////////////////////////////////////////////////////////////////////////////////////////////
    //
    //now register (deprecated)
    //
    /*
    var user = db.User.build(u);
    logger.info("registering new user", u);
    user.setPassword(req.body.password, function(err) {
        if(err) return done(err);
        logger.debug("password set");
        user.updateTime('register');
        user.save().then(function() {
            //add to default groups
            user.addMemberGroups(u.gids, function() {
                //done(null, user);    
            });
        });
    });
    */
    //
    ///////////////////////////////////////////////////////////////////////////////////////////////

    common.hash_password(req.body.password, async (err, hash)=>{
        if(err) return done(err);
        u.password_hash = hash;
        let user = new db.mongo.User(u);
        user.save().then(user=>{
            let raw_user = user.toObject();
            raw_user._profile = req.body.profile;
            logger.debug("publishing to "+user.sub);
            logger.debug(raw_user);
            common.publish("user.create."+user.sub, raw_user);
            done(null, user);
        }).catch(err=>{
            done(err.toString());
        });
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

router.post('/', jwt({secret: config.auth.public_key, credentialsRequired: false}), async (req, res, next)=>{
    let username = req.body.username;
    let email = req.body.email;
    let profile = req.body.profile;

    //check for username already taken
    let user = await db.mongo.User.findOne({username});
    if(user) return next('The username you chose is already registered. If it is yours, please try signing in, or register with a different username.');
    user = await db.mongo.User.findOne({email});
    if(user) return next('The email address you chose is already registered. If it is yours, please try signing in, or register with a different email address.');

    //all good .. register!
    register_newuser(req, (err, user)=>{
        if(err) return next(err);

        //post process
        if(config.local.email_confirmation) {
            common.send_email_confirmation(req.headers.referer||config.local.url, user, function(err) {
                if(err) {
                    if(!req.user) {
                        //if we fail to send email, we should unregister the user we just created
                        user.remove().then(()=>{
                            logger.error("removed newly registred record - email failurer");
                            res.status(500).json({message: "Failed to send confirmation email. Please make sure your email address is valid."});
                        });
                    } else {
                        res.status(500).json({message: "Failed to send confirmation email. Please make sure your email address is valid"});
                    }
                } else {
                    res.json({path:'/confirm_email/'+user.sub, message: "Confirmation email has been sent. Please follow the instruction once you receive it."});
                }
            });
        } else {
            
            //no need for email confrmation.. issue jwt!
            common.createClaim(user, function(err, claim) {
                if(err) return next(err);

                var jwt = common.signJwt(claim);
                res.json({jwt: jwt, sub: user.sub});
            });
        }
    });
})

module.exports = router;

