#!/usr/bin/env node

const winston = require('winston');
const async = require('async');

const config = require('../api/config');
const logger = winston.createLogger(config.logger.winston);
const db = require('../api/models');
const common = require('../api/common');

async function run() {
    logger.debug("waiting to conect");
    await db.mongo.connection;

    logger.debug("truncating");
    await db.mongo.User.deleteMany({});
    await db.mongo.Group.deleteMany({});

    logger.debug("loading users");
    let users = await db.User.findAll({raw: true});
    load_users(users);
}

function load_users(users) {
    //let d_usernames = [];
    //let d_emails = [];
    let o_users = {};

    async.eachSeries(users, (user, next_user)=>{

        /*
        if(~d_usernames.indexOf(user.username)) {
            logger.error("duplicate username..skipping");
            console.dir(user);
            return next_user();
        }
        d_usernames.push(user.username);

        if(~d_emails.indexOf(user.email)) {
            logger.error("duplicate email..skipping");
            console.dir(user);
            return next_user();
        }
        d_emails.push(user.email);
        */

        let times = JSON.parse(user.times);
        for(let key in times) {
            //TODO - I used to store login dates for oidc and x509 under a keys like "oidc_login:https://oidc.com/123" on sqlite
            //mongo doesn't allow "." in the key so I can't store it like this. I think I should store array of dates with index
            //corresponding to the index of the oidc/x509 entries.. but for now let's just not migrate over
            if(key.includes("oidc_login:")) delete times[key];
            if(key.includes("x509_login:")) delete times[key];
        }

        //if oids_subs is set, pull out cert_subject_dn
        let openids = JSON.parse(user.oidc_subs);
        if(openids) openids = openids.map(o=>o.cert_subject_dn);

        let newuser = new db.mongo.User({
            sub: user.id,
            username: user.username,

            fullname: user.fullname,
            email: user.email,
            email_confirmed: !!user.email_confirmed,
            email_confirmation_token: user.email_confirmation_token,

            password_hash: user.password_hash,
            password_reset_token: user.password_reset_token,
            password_reset_cookie: user.password_reset_cookie,

            ext: {
                iucas: user.iucas,
                ldap:user.ldap,
                googleid: user.googleid,
                github: user.github,
                facebook: user.facebook,
                orcid: user.orcid,

                x509dns: JSON.parse(user.x509dns),
                openids,
            },

            times,
            scopes: JSON.parse(user.scopes),

            active: !!user.active,
        });

        //console.dir(JSON.parse(user.oidc_subs));
        //console.dir(newuser.ext.openids.toString());
        //if(user.oidc_subs) process.exit();

        /*
         *    '[{"sub":"http://cilogon.org/serverA/users/7051","idp_name":"Indiana University","idp":"urn:mace:incommon:iu.edu","eppn":"hayashis@iu.edu","cert_subject_dn":"/DC=org/DC=cilogon/C=US/O=Indiana University/CN=Soichi Hayashi A35421 email=hayashis@iu.edu","eptid":"urn:mace:incommon:iu.edu!https://cilogon.org/shibboleth!t+5InYEarg/v8gSO9Ri9afLlecI=","name":"Hayashi, Soichi","given_name":"Soichi","family_name":"Hayashi","email":"hayashis@iu.edu"}]',

        */

        newuser.save().then(newuser_saved=>{
            //console.log(JSON.stringify(newuser_saved, null, 4));
            o_users[user.id] = newuser_saved;
            next_user();
        });
    }, async err=>{
        if(err) throw err;
        let groups = await db.Group.findAll();
        await load_groups(groups, o_users);
    });
}

function load_groups(groups, o_users, cb) {
    return new Promise((resolve, reject)=>{
        async.eachSeries(groups, (group, next_group)=>{
            group.getAdmins().then(admins=>{
                group.getMembers().then(members=>{
                    admins.forEach(a=>console.log(a.id));
                    members.forEach(m=>console.log(m.id));
                    let newgroup = db.mongo.Group({
                        id: group.id,
                        name: group.name,
                        desc: group.desc,
                        admins: admins.map(m=>o_users[m.id]._id),
                        members: members.map(m=>o_users[m.id]._id),
                        active: !!group.active,
                    });
                    newgroup.save().then(newgroup_saved=>{
                        next_group();
                    });
                });
            });
        }, err=>{
            if(err) throw err;
            console.log("all done");
        });
    });
}

run();

/*
db.Group.findAll({raw: true})
.then(groups=>{
    console.dir(groups);
}); 
*/
