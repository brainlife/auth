#!/bin/env node
'use strict';

///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Update specified user's scope 
//

//contrib
var argv = require('optimist').argv;
var winston = require('winston');
var jwt = require('jsonwebtoken');
var fs = require('fs');
var _ = require('underscore');

//mine
var config = require('../api/config');
var logger = new winston.Logger(config.logger.winston);
var db = require('../api/models');

switch(argv._[0]) {
case "modscope": modscope(); break;
case "listuser": listuser(); break;
case "issue": issue(); break;
case "setpass": setpass(); break;
case "newuser": newuser(); break;
default:
    console.log(fs.readFileSync(__dirname+"/usage.txt", {encoding: "utf8"})); 
}

function listuser() {
    db.User.findAll({/*attributes: ['id', 'username', 'email', 'active', 'scopes', 'times', 'createdAt'],*/ raw: true})
    .then(function(users) {
        console.dir(users);
    }); 
}

function issue() {
    if(!argv.scopes || !argv.sub) {
        logger.error("./auth.js issue --scopes '{common: [\"user\"]}' --sub 'my_service' [--out token.jwt] [--key test.key]");
        process.exit(1);
    }

    var claim = {
        "iss": config.auth.iss,
        //"exp": (Date.now() + "+(argv.exp*1000*3600*24)+")/1000, //no expiration?
        "iat": (Date.now())/1000,
        "scopes": JSON.parse(argv.scopes),
        "sub": argv.sub,
    };
    
    if(argv.key) {
        console.log("using specified private key");
        config.auth.private_key = fs.readFileSync(argv.key);
        //console.dir(config.auth);
    }
    /*
    if(argv.pub) {
        console.log("using specified public key");
        config.auth.public_key = fs.readFileSync(argv.pub);
        //console.dir(config.auth);
    }
    */

    var token = jwt.sign(claim, config.auth.private_key, config.auth.sign_opt);
    if(argv.out) {
        fs.writeFileSync(argv.out, token);
    } else {
        console.log(token);
    }

    /*
    //verify to check
    jwt.verify(token, config.auth.public_key, function(err, decoded) {
        if(err) throw err;
        console.log("decoded:");
        console.log(JSON.stringify(decoded, null, 4));
    });
    */
}

function modscope() {
    if(!argv.username) {
        logger.error("please specify --username <username> --set/add/del '{{common: [\"user\", \"admin\"]}}'");
        process.exit(1);
    }

    function add(base, sub) {
        if(sub.constructor == Array) {
            sub.forEach(function(item) {
                if(!~base.indexOf(item)) base.push(item);
            });
        } else {
            for(var k in sub) {
                if(base[k] === undefined) base[k] = sub[k];
                else add(base[k], sub[k]);
            }
        }
        return base;
    }

    function del(base, sub) {
        if(typeof sub == 'object' && sub.constructor == Array) {
            sub.forEach(function(item) {
                var pos = base.indexOf(item);
                if(~pos) base.splice(pos, 1);
            });
        } else if(typeof sub == 'object') {
            for(var k in sub) {
                if(base[k] !== undefined) del(base[k], sub[k]);
            }
        }
        return base;
    }

    db.User.findOne({where: {"username": argv.username}})
    .then(function(user) {
        if(!user) return logger.error("can't find user:"+argv.username);
        if(argv.set) {
            user.scopes = JSON.parse(argv.set);
        }
        if(argv.add) {
            user.scopes = add(_.clone(user.scopes), JSON.parse(argv.add));
        }
        if(argv.del) {
            user.scopes = del(_.clone(user.scopes), JSON.parse(argv.del));
        }
        user.save().then(function() {
            logger.info("successfully updated user scope. user must re-login for it to take effect)");
        }).catch(function(err) {
            logger.error(err);
        });
    })
}

function setpass() {
    if(!argv.username) {
        logger.error("please specify --username <username>");
        process.exit(1);
    }
    if(!argv.password) {
        logger.error("please specify --password <password>");
        process.exit(1);
    }

    db.User.findOne({where: {"username": argv.username}})
    .then(function(user) {
        if(!user) return logger.error("can't find user:"+argv.username);
        user.setPassword(argv.password, function(err) {
            if(err) throw err;
            user.save().then(function() {
                logger.log("successfully updated password");
            }).catch(function(err) {
                logger.error(err);
            });
        });
    })
}

function newuser() {
    if(!argv.username) {
        logger.error("please specify --username <username>");
        process.exit(1);
    }
    if(!argv.fullname) {
        logger.error("please specify --fullname <fullname>");
        process.exit(1);
    }
    if(!argv.email) {
        logger.error("please specify --email <fullname>");
        process.exit(1);
    }

    db.User.create({
        username: argv.username,
        fullname: argv.fullname,
        email: argv.email,
        email_confirmed: true,
    }).then(function(_user) {
        if(!_user) return logger.error("couldn't register new user");
        logger.info("successfully created a user - now you might want to reset password / setscope");
    });
}
