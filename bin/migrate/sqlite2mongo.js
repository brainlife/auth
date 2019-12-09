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
    await db.mongo.User.remove({});
    await db.mongo.Group.remove({});
    //await mongoose.connection.db.dropDatabase();

    logger.debug("loading users");
    let users = await db.User.findAll({});
    //users.forEach(user=>console.log(user.id));
    load_users(users);
}


function load_users(users) {
    //let d_usernames = [];
    //let d_emails = [];
    let o_users = {};

    async.eachSeries(users, (user, next_user)=>{
        console.log(user.times);
        //let times = JSON.parse(user.times);
        let times = user.times;
        for(let key in times) {
            //TODO - I used to store login dates for oidc and x509 under a keys like "oidc_login:https://oidc.com/123" on sqlite
            //mongo doesn't allow "." in the key so I can't store it like this. I think I should store array of dates with index
            //corresponding to the index of the oidc/x509 entries.. but for now let's just not migrate over
            if(key.includes("oidc_login:")) delete times[key];
            if(key.includes("x509_login:")) delete times[key];
        }

        let newuser = {
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
            }, //set below..

            times,
            //scopes: JSON.parse(user.scopes),
            scopes: user.scopes,

            active: !!user.active,
        };

        //let's not set things to null ..
        if(user.iucas) newuser.ext.iucas = user.iucas;
        if(user.ldap) newuser.ext.ldap = user.ldap;
        if(user.googleid) newuser.ext.googleid = user.googleid;
        if(user.facebook) newuser.ext.facebook = user.facebook;
        if(user.orcid) newuser.ext.orcid = user.orcid;
        if(user.github) newuser.ext.github = user.github;

        //let openids = JSON.parse(user.oidc_subs)||[];
        if(user.x509dns) newuser.ext.x509dns = user.x509dns;
        if(user.oidc_subs) newuser.ext.openids = user.oidc_subs.map(o=>o.cert_subject_dn); //if oids_subs is set, pull out cert_subject_dn

        //console.log(newuser.ext);

        //console.log(JSON.stringify(newuser, null, 4));
        (new db.mongo.User(newuser)).save().then(newuser_saved=>{
            o_users[user.id] = newuser_saved;
            next_user();
        }).catch(next_user);
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
