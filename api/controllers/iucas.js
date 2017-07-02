
//contrib
var express = require('express');
var router = express.Router();
var request = require('request');
var winston = require('winston');
var jwt = require('express-jwt');
var clone = require('clone');

//mine
var config = require('../config');
var logger = new winston.Logger(config.logger.winston);

var common = require('../common');
var db = require('../models');

function finduserByiucasid(id, cb) {
    db.User.findOne({where: {"iucas": id}}).then(function(user) {
        cb(null, user);
    });
}

//TODO - maybe I should refactor this?
function associate(jwt, uid, res, cb) {
    logger.info("associating user with iucas id:"+uid);
    db.User.findOne({where: {id: jwt.sub}}).then(function(user) {
        if(!user) return cb("couldn't find user record with SCA sub:"+jwt.sub);
        user.iucas = uid;
        user.save().then(function() {
            var messages = [{type: "success", /*title: "IUCAS ID Associated",*/ message: "We have associated IU ID:"+uid+" to your account"}];
            res.cookie('messages', JSON.stringify(messages), {path: '/'});
            issue_jwt(user, function(err, jwt) {
                if(err) return cb(err);
                cb(null, jwt);
            });
        });
    });
}

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
            //TODO I should refactor this part somehow..
            db.User.create(u).then(function(user) {
                user.addMemberGroups(u.gids, function() {
                    //done(user);    
                    issue_jwt(user, function(err, jwt) {
                        if(err) return next(err);
                        res.json({jwt:jwt, registered: true});
                    });
                });
            });
        }
    });
}

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

/*
router.get('/lock', function(req, res, next) {
    logger.debug("trying to lock it up");
    request('https://soichi7.ppa.iu.edu/api/profile/noret', function(err, _res, body) {
        if(err) return next(err); 
        logger.debug("out of request");
        res.json(body);
    });
});
*/

router.get('/verify', jwt({secret: config.auth.public_key, credentialsRequired: false}), function(req, res, next) {
    var ticket = req.query.casticket;

    //guess casurl using referer - TODO - should I use cookie and pass it from the UI method begin_iucas() instead?
    //var casurl = config.iucas.home_url;
    if(!req.headers.referer) return next("Referer not set in header..");
    casurl = req.headers.referer;
    request({
        url: 'https://cas.iu.edu/cas/validate?cassvc=IU&casticket='+ticket+'&casurl='+casurl,
        timeout: 1000*5, //long enough?
    }, function (err, response, body) {
        if(err) return next(err);
        if (response.statusCode == 200) {
            var reslines = body.split("\n");
            if(reslines[0].trim() == "yes") {
                var uid = reslines[1].trim();
                finduserByiucasid(uid, function(err, user) {
                    if(err) return next(err);
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
                        } else if(config.iucas.auto_register) {
                            register_newuser(uid, res, next);
                        } else {
                            res.redirect('/auth/#!/signin?msg='+"Your IU account("+profile.sub+") is not yet registered. Please login using your username/password first, then associate your IU account inside the account settings.");
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
                });
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

router.put('/disconnect', jwt({secret: config.auth.public_key}), function(req, res, next) {
    db.User.findOne({
        where: {id: req.user.sub}
    }).then(function(user) {
        if(!user) res.status(401).end();
        user.iucas = null;
        user.save().then(function() {
            res.json({message: "Successfully disconnected IUCAS account.", user: user});
        });    
    });
});

module.exports = router;
