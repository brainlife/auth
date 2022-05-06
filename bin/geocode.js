#!/usr/bin/env node
"use strict";

const async = require('async');
const fs = require('fs');
const db = require('../api/models');
const NodeGeocoder = require('node-geocoder');
const config = require('../api/config');

const cache = require(config.auth.geocode.cacheFile);
const geocoder = NodeGeocoder(config.auth.geocode.options);

db.mongo.User.find({}).select('profile fullname active').then(users=>{
    async.eachSeries(users, (user,next_user)=>{
        if(!user.active) {
            console.log("not active",user);
            return next_user();
        }
        if(!user.profile.public) {
            console.log("no public profile",user);
            return next_user();
        }
        const inst = user.profile.public.institution;
        lookupAddress(inst, async (err,info)=>{
            if(err) console.error(err);
            else user.geocode = info; 
            user.markModified("geocode"); //is this needed?
            await user.save();
            next_user();
        });
    }, err=>{
        if(err) console.error(err);
        console.log("all done.. saving cache");
        fs.writeFileSync(config.auth.geocode.cacheFile, JSON.stringify(cache, null, 4));
        process.exit(0);
    });
});

async function lookupAddress(inst, cb) {

    if(!inst) return cb("no inst");

    const linst = inst.toLowerCase().trim();

    //try the cache first
    if(cache[linst] === undefined) {
        console.log("using cache");
        return cb(null, cache[linst]);
    }

    console.log(linst, "cache miss.. looking up from google");
    geocoder.geocode(linst).then(res=>{
        if(!res[0]) {
            cache[linst] = null;
            return cb("failed to lookup");
        }
        if(res[0].extra.confidence < 0.9) {
            cache[linst] = null;
            return cb("low confidence");
        }
        console.dir(res);
        /*
        cache[inst] = {
            lat: res[0].latitude,
            lng: res[0].longitude,
            country: res[0].country,
            countryCode: res[0].countryCode
        };
        */
        cache[linst] = res[0];
        cb(null, cache[linst]);
    });
}


