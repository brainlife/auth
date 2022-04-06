#!/usr/bin/env node
"use strict";

const async = require('async');
const fs = require('fs');
let db = require('../api/models');
const NodeGeocoder = require('node-geocoder');

const config = require('../api/config');

const options = {
    provider: 'google',
    apiKey: config.geocode.apiKey, 
}

const cache_filename = "geocode_cache.json";
const cache = require(__dirname+'/'+cache_filename);

const geocoder = NodeGeocoder(options);

const select = 'profile fullname active'


db.mongo.User.find({}).select(select).then(users=>{
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
        lookupAddress(inst, (err,info)=>{
            if(err) console.error(err);
            else user.geocode = info; 
            user.markModified("geocode");
            user.save();
            next_user();
        });
        // next_user();
    }, err=>{
        if(err) console.error(err);
        console.log("all done");
    });
});

async function lookupAddress(inst, cb) {
    if(!inst) return cb("no inst");
    //try the cache first
    if(cache[inst]) {
        console.log("using cache");
        return cb(null, cache[inst]);
    }

    console.log("no cache.. looking up from google");
    
    geocoder.geocode(inst).then(res=>{
        console.dir(res,inst);
        if(!res[0]) return cb("failed to lookup");
        if(res[0].extra.confidence < 0.9) return cb("low confidence");
        cache[inst] = {
            lat: res[0].latitude,
            lng: res[0].longitude,
            country: res[0].country,
            countryCode: res[0].countryCode
        };
        fs.writeFileSync(__dirname+"/"+cache_filename, JSON.stringify(cache, null, 4));
        cb(null, cache[inst]);
    });
}