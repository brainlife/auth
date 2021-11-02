
//contrib
var express = require('express');
var router = express.Router();
var request = require('request');
var jwt = require('express-jwt');

//mine
var config = require('../config');

var common = require('../common');
var db = require('../models');


function register_newuser(req, uid, res, next) {
    console.info("registering new user with iucas id:"+uid);
    let email = uid+"@iu.edu";
    db.mongo.User.findOne({$or: [{username: uid}, {email}]}).then(async user=>{
        if(user) {
            console.warn("username or email already registered for "+uid+"(can't auto register)");
            //TODO - instead of showing this error message, maybe I should redirect user to
            //a page to force user to login via user/pass, then associate the IU CAS IU once user logs in 
            next("This is the first time you login with IU CAS account, "+
                 "but we couldn't register this account since the username '"+uid+"' is already registered in our system. "+
                 "If you have already registered with username / password, please login with username / password first, ");
        } else {
            //brand new user - go ahead and create a new account using IU id as user id
            var u = Object.assign({
                sub: await common.get_nextsub(),
                times: {register: new Date()},
                username: uid, //let's use IU id as local username
                fullname: uid, //TODO - iucas doesn't give me any information about the user.. (I could parse  https://directory.iu.edu/person/details/hayashis?)
                email: uid+"@iu.edu",
                email_confirmed: true, //let's trust IU..
                ext: {
                    iucas: uid,
                }
            }, config.auth.default);
           
            let user = new db.mongo.User(u);
            issue_jwt_and_save(req, user, function(err, jwt) {
                if(err) return next(err);
                res.json({jwt, registered: true});
            });
        }
    });
}

function issue_jwt_and_save(req, user, cb) {
    const err = common.checkUser(user, req);
    if(err) return cb(err);
    common.createClaim(user, function(err, claim) {
        if(err) return cb(err);
        user.times.iucas_login = new Date();
        user.reqHeaders = req.headers;
        user.markModified('times');
        user.save().then(function() {
            common.publish("user.login."+user.sub, {type: "iucas", username: user.username, exp: claim.exp});
            cb(null, common.signJwt(claim));
        });
    });
}

//XHR get only
router.get('/verify', jwt({
    secret: config.auth.public_key, 
    algorithms: [config.auth.sign_opt.algorithm],
    credentialsRequired: false,
}), function(req, res, next) {
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
        console.debug("verify responded:"+response.statusCode+"\n"+body);
        if (response.statusCode == 200) {
            var reslines = body.split("\n");
            if(reslines[0].trim() == "yes") {
                var uid = reslines[1].trim();
                db.mongo.User.findOne({"ext.iucas": uid}).then(user=>{
                    if(!user) {
                        console.debug("no user under iucas id", uid);
                        if(req.user) {
                            //If user is already logged in, but no iucas associated yet.. then auto-associate.
                            //If someone with only local account let someone else login via iucas on the same browser, while the first person is logged in,
                            //that someone else can then start using the first person's account after he leaves the computer. However, user intentionally
                            //visiting /auth page when the first user is already logged into a system is very unlikely, since the user most likely will
                            //sign out so that second user can login. also, if this situation to ever occur, user should be presented with 
                            //"we have associated your account" message so that first user should be aware of this happening
                            console.info("associating user with iucas id:"+uid);
                            db.mongo.User.findOne({sub: req.user.sub}).then(user=>{
                                if(!user) return next("couldn't find user record with sub:"+req.user.sub);
                                user.ext.iucas = uid;
                                var messages = [{type: "success", /*title: "IUCAS ID Associated",*/ message: "We have associated IU ID:"+uid+" to your account"}];
                                res.cookie('messages', JSON.stringify(messages), {path: '/'});
                                issue_jwt_and_save(req, user, (err, jwt)=>{
                                    if(err) return next(err);
                                    res.json({jwt});
                                });
                            });
                        } else if(config.iucas.auto_register) {
                            register_newuser(req, uid, res, next);
                        } else {
                            console.debug("requesting redirect to signin");
                            //res.redirect('/auth/#!/signin?msg='+"Your IU account("+uid+") is not yet registered. Please login using your username/password first, then associate your IU account inside the account settings.");
                            res.json({redirect: '/auth/#!/signin', message: "Your IU account("+uid+") is not yet registered. Please login using your username/password first, then associate your IU account inside the account settings."});
                        }
                    } else {
                        //all good. issue token
                        console.debug("iucas authentication successful. iu id:"+uid);
                        issue_jwt_and_save(req, user, (err, jwt)=>{
                            if(err) return next(err);
                            console.log("issuged token", jwt);
                            res.json({jwt});
                        });
                    }
                });
            } else {
                console.error("IUCAS failed to validate");
                res.sendStatus("403");//Is 403:Forbidden appropriate return code?
            }
        } else {
            //non 200 code...
            next(body);
        }
    })
});

router.put('/disconnect', jwt({
    secret: config.auth.public_key,
    algorithms: [config.auth.sign_opt.algorithm],
}), function(req, res, next) {
    db.mongo.User.findOne({sub: req.user.sub}).then(user=>{
        if(!user) res.status(401).end();
        user.ext.iucas = null;
        user.save().then(function() {
            res.json({message: "Successfully disconnected IUCAS account.", user: user});
        });    
    });
});

module.exports = router;
