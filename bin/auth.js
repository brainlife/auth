#!/usr/bin/env node
'use strict';

///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Update specified user's scope 
//

let argv = require('optimist').argv;
let winston = require('winston');
let jwt = require('jsonwebtoken');
let fs = require('fs');
let _ = require('underscore');

let config = require('../api/config');
let logger = new winston.Logger(config.logger.winston);
let db = require('../api/models');
let common = require('../api/common');

switch(argv._[0]) {
case "modscope": modscope(); break;
case "listuser": listuser(); break;
case "issue": issue(); break;
case "setpass": setpass(); break;
case "useradd": useradd(); break;
case "userdel": userdel(); break;
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
    if((!argv.scopes || argv.sub === undefined) && !argv.username) {
        logger.error("./auth.js issue --username <userrname>");
        logger.error("./auth.js issue --scopes '{common: [\"user\"]}' --sub 'my_service' [--exp 1514764800]  [--out token.jwt] [--key test.key]");
        process.exit(1);
    }

    if(argv.username) {
        //load claim from user table
        db.User.findOne({where: { 
            $or: [
                {username: argv.username}, 
                {id: argv.id}, 
            ]} 
        }).then(user=>{
            common.createClaim(user, (err, claim)=>{ 
                if(err) throw err;
                issue(claim);
            });
        });
    } else {
        //let admin construct the claim
        issue({
            "iss": config.auth.iss,
            "iat": (Date.now())/1000,
            "sub": argv.sub,
        });
    }

    function issue(claim) {
        if(argv.scopes) {
            claim.scopes = JSON.parse(argv.scopes);
        }
        if(argv.profile) {
            claim.profile = JSON.parse(argv.profile);
        }
        if(argv.gids) {
            claim.gids = JSON.parse(argv.gids);
        }
        if(argv.exp) {
            claim.exp = argv.exp;
        }
        if(argv.ttl) { //in milliseconds
            let d = (new Date()).getTime();
            claim.exp = (d+argv.ttl)/1000;
        }
        if(argv.key) {
            console.log("using specified private key");
            config.auth.private_key = fs.readFileSync(argv.key);
        }
        var token = jwt.sign(claim, config.auth.private_key, config.auth.sign_opt);
        if(argv.out) {
            fs.writeFileSync(argv.out, token);
        } else {
            console.log(token);
        }
    } 
}

function modscope() {
    if(!argv.username && !argv.id) {
        logger.error("please specify --username <username> (or --id <userid>) --set/add/del '{{common: [\"user\", \"admin\"]}}'");
        process.exit(1);
    }

    function add(base, sub) {
        if(sub.constructor == Array) {
            sub.forEach(function(item) {
                if(!~base.indexOf(item)) base.push(item);
            });
        } else if(typeof sub == 'string') {
            console.log("adding", sub);
            if(!~base.indexOf(sub)) base.push(sub);
        } else if(typeof sub == 'object') {
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

    db.User.findOne({where: { 
        $or: [
            {username: argv.username}, 
            {id: argv.id}, 
        ]} 
    }).then(function(user) {
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
            logger.info(user.scopes);
            logger.info("successfully updated user scope. user must re-login for it to take effect)");
        }).catch(function(err) {
            logger.error(err);
        });
    })
}

function setpass() {
    if(!argv.username && !argv.id) {
        logger.error("please specify --username <username> or --id <userid>");
        process.exit(1);
    }
    if(!argv.password) {
        logger.error("please specify --password <password>");
        process.exit(1);
    }

    db.User.findOne({where: { 
        $or: [
            {username: argv.username}, 
            {id: argv.id}, 
        ]} 
    }).then(function(user) {
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

function useradd() {
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

    var user = db.User.build(
        //extend from default
        Object.assign({
            username: argv.username,
            fullname: argv.fullname,
            email: argv.email,
            email_confirmed: true,
        }, config.auth.default)
    );
    user.save().then(function(_user) {
        if(!_user) return logger.error("couldn't register new user");
        logger.info("successfully created a user");
        if(argv.password) setpass();
        else logger.info("you might want to reset password / setscope");
    });
}

function userdel() {
    if(!argv.username && !argv.id) {
        logger.error("please specify --username <username> or --id <userid>");
        process.exit(1);
    }

    //TODO - does this cascade to group?
    db.User.destroy({
        where: { $or: [
            {username: argv.username}, 
            {id: argv.id}, 
        ]} 
    }).then(function(count) {
        if(count == 1) logger.info("successfully removed user");
        else logger.info("failed to remove user - maybe doesn't exist?")
    });
}


