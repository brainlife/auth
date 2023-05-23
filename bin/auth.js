#!/usr/bin/env node
'use strict';

///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Update specified user's scope 
//

let argv = require('optimist').argv;
let jwt = require('jsonwebtoken');
let fs = require('fs');

let config = require('../api/config');
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
        console.log(fs.readFileSync(__dirname + "/usage.txt"));
}

function listuser() {
    db.init(err=>{
        if(err) throw err;
        db.mongo.User.find({}).then(function(users) {
            console.dir(users);
            db.disconnect();
        });
    });
}

function issue() {
    if((!argv.scopes || argv.sub === undefined) && !argv.username) {
        console.error("./auth.js issue --username <userrname>");
        console.error("./auth.js issue --scopes '{common: [\"user\"]}' --sub 'my_service' [--exp 1514764800]  [--out token.jwt] [--key test.key]");
        process.exit(1);
    }

    if(argv.username) {
        //load claim from user table
        db.init(err=>{
            db.mongo.User.findOne({$or: [
                {sub: argv.id}, 
                {username: argv.username}, 
            ]}).then(user=>{
                db.disconnect();
                common.createClaim(user, (err, claim)=>{ 
                    if(err) throw err;
                    issue(claim);
                });
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
        if(argv.ttl) { //in days
            let d = (new Date()).getTime();
            claim.exp = (d+argv.ttl*3600*24)/1000;
        }
        if(argv.key) {
            console.debug("using specified private key");
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
        console.error("please specify --username <username> (or --id <userid>) --set/add/del '{{common: [\"user\", \"admin\"]}}'");
        process.exit(1);
    }

    function add(base, sub) {
        if(sub.constructor == Array) {
            sub.forEach(function(item) {
                if(!~base.indexOf(item)) base.push(item);
            });
        } else if(typeof sub == 'string') {
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

    db.init(err=>{
        if(err) throw err;
        db.mongo.User.findOne({$or: [
                {sub: argv.id}, 
                {username: argv.username}, 
        ]}).then(function(user) {
            if(!user) return console.error("can't find user:"+argv.username);
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
                console.info(user.scopes);
                console.info("successfully updated user scope. user must re-login for it to take effect)");
                db.disconnect();
            }).catch(function(err) {
                console.error(err);
                db.disconnect();
            });
        })
    });
}

async function setpass() {
    if(!argv.username && !argv.id) {
        console.error("please specify --username <username> or --id <userid>");
        process.exit(1);
    }
    if(!argv.password) {
        console.error("please specify --password <password>");
        process.exit(1);
    }

    try {
        await db.init();
        const user = await db.mongo.User.findOne({$or: [
            {sub: argv.id},
            {username: argv.username},
        ]});
        if(!user) {
            console.error("User not found: "+argv.username);
            await db.disconnect();
            return;
        }
        const hash = await common.hash_password(argv.password);
        user.password_hash = hash;
        if (!user.times)
            user.times = {}; //could be empty first
        user.times.password_reset = new Date();
        await user.save();
        console.log("Successfully updated password");
        await db.disconnect();
        console.log(user);   
    } catch(err) {
        console.error(err);
        await db.disconnect();
    }
}

function useradd() {
    if(!argv.username) {
        console.error("please specify --username <username>");
        process.exit(1);
    }
    if(!argv.fullname) {
        console.error("please specify --fullname <fullname>");
        process.exit(1);
    }
    if(!argv.email) {
        console.error("please specify --email <fullname>");
        process.exit(1);
    }

    db.init(err=>{
        if(err) throw err;
        var user = db.mongo.User.build(
            //extend from default
            Object.assign({
                username: argv.username,
                fullname: argv.fullname,
                email: argv.email,
                email_confirmed: true,
            }, config.auth.default)
        );
        user.save().then(function(_user) {
            if(!_user) return console.error("couldn't register new user");
            console.info("successfully created a user");
            if(argv.password) setpass();
            else console.info("you might want to reset password / setscope");
            db.disconnect();
        });
    });
}

function userdel() {
    if(!argv.username && !argv.id) {
        console.error("please specify --username <username> or --id <userid>");
        process.exit(1);
    }

    db.init(err=>{
        if(err) throw err;
        db.mongo.User.findOne({$or: [
            {sub: argv.id}, 
            {username: argv.username}, 
        ]}).then(user=>{
            if(!user) return console.error("no such user");
            db.mongo.Group.update({members: user}, {$pull : { members: user }}, {multi: true});
            db.mongo.Group.update({admins: user}, {$pull : { admins: user }}, {multi: true});
            user.remove(); //TODO - should I just mark as inactive?

            db.disconnect();
        });
    });
}


