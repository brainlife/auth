'use strict';

const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('express-jwt');
const async = require('async');

//mine
const config = require('../config');
const common = require('../common');
const db = require('../models');

//fields that are safe to include in public profile api
let safe_fields = ["sub", "fullname", "email", "username", "active", "profile.public"/*, "times.register" - collide with times*/];

/**
 * @apiGroup Profile
 * @api {put} /profile/:sub? 
 *                          Set user profile
 *
 * @apiDescription          Update user's auth profile. :sub? can be set by admin to update user's profile
 *
 * @apiName PutProfile
 *
 * @apiHeader {String}      authorization A valid JWT token (Bearer:)
 *
 * @apiSuccess {Object}     updated user object
 */
router.patch('/:sub?', jwt({
    secret: config.auth.public_key,
    algorithms: [config.auth.sign_opt.algorithm],
}), function(req, res, next) {
    let sub = req.user.sub;
    if(common.has_scope(req, "admin") && req.params.sub) sub = req.params.sub;
    let select = [...safe_fields, "profile.private"];
    db.mongo.User.findOne({sub, active: true}).select(select).then(function(user) {
        if(!user) return next("no such active user");
        if(req.body.fullname) user.fullname = req.body.fullname;
        if(req.body.profile) {
            user.markModified("profile");
            if(req.body.profile.public) {
                Object.assign(user.profile.public, req.body.profile.public);
            }
            if(req.body.profile.private) {
                Object.assign(user.profile.private, req.body.profile.private);
            }
            /*
            if(req.body.profile.admin && common.has_scope(req, "admin")) {
                Object.assign(user.profile.admin, req.body.profile.admin);
            }
            */
        }
        user.save().then(function() {
            common.publish("user.update."+user.sub, req.body);
            res.json(user);
        });
    }).catch(next);
});

/**
 * @apiGroup Profile
 * @api {get} /profile/list          Query auth profiles (public api)
 * @apiDescription              Query auth profiles
 * @apiName Get auth (public) profiles
 *
 * @apiParam {Object} find      Optional sequelize where query - defaults to {} (can onlu query certain field)
 * @apiParam {Object} order     Optional sequelize sort object - defaults to [['fullname', 'DESC']]
 * @apiParam {Number} limit     Optional Maximum number of records to return - defaults to 100
 * @apiParam {Number} offset    Optional Record offset for pagination
 *
 */
//TODO - I feel very iffiy about this.. I should create separate API for
//each use cases for any publicaly accessible APIs
//users:
//  warehouse/ui components/contactlist.vue 
//  warehouse/ui mixin/authprofilecache (used by contact.vue)
//  warehouse/api common/cache_contact
//  warehouse/api common/mail - users_general, etc..
//  warehouse/app bin/metrics.js contact_details
//  cli.queryProfiles / queryAllProfiles
router.get('/list', jwt({
    secret: config.auth.public_key, 
    algorithms: [config.auth.sign_opt.algorithm],
    credentialsRequired: false,
}), async (req, res, next)=>{
    var dirty_find = {};
    if(req.query.where) dirty_find = JSON.parse(req.query.where);
    if(req.query.find) dirty_find = JSON.parse(req.query.find);

    //for non-admin, limit the field that user can query on
    //TODO this doesn't prevent user from constructing queries like "$or: { private.field}" to do
    //the search!
    let find = {};
    for(let k in dirty_find) {
        if(common.has_scope(req, "admin") || ~safe_fields.indexOf(k)) find[k] = dirty_find[k];
    }

    //TODO - we should let user specify which field to actually select..
    let select = safe_fields.slice();
    if(common.has_scope(req, "admin")) {
        select.push("times");
        select.push("profile.private");
    }

    var order = 'fullname';
    if(req.query.order) order = JSON.parse(req.query.order);

    let limit = 100;
    if(req.query.limit) limit = parseInt(req.query.limit);
    let skip = 0;
    if(req.query.offset) skip = parseInt(req.query.offset);

    let count = await db.mongo.User.countDocuments(find);
    let users = await db.mongo.User
        .find(find)
        .sort(order)
        .limit(limit)
        .skip(skip)
        .select(select);
    res.json({profiles: users, count});
});

//count number of users based on profile.private.position info
//it users group logic configured in config.positionGroups
router.get('/poscount', jwt({secret: config.auth.public_key,algorithms: [config.auth.sign_opt.algorithm]}), async (req, res, next)=>{
    if(!common.has_scope(req, "admin")) return next("admin only");
    const users = await db.mongo.User.find({}, {"profile.private.position": 1});
    const counts = {};
    users.forEach(user=>{
        if(!user.profile || !user.profile.private || !user.profile.private.position) return;
        const position = user.profile.private.position.toLowerCase();
        if(position.length <= 1) return;
        let match = null;
        for(const group in config.positionGroups) {
            if(config.positionGroups[group].test(position)) {
                match = group;
                break;
            }
        }
        if(!match) match = "Other";
        if(!counts[match]) counts[match] = 0;
        counts[match]++;
    });
    res.json(counts);
});

//public api to download user map (user's institution location)
router.get('/userlocs', async (req, res, next)=>{
    const users = await db.mongo.User.find({'profile.public.showOnMap': true}, {
        "profile.public.lat": 1, 
        "profile.public.lng": 1,
        "profile.public.institution": 1,
    });
    res.json(users.map(u=>u.profile.public));
});

/**
 * @apiGroup Profile
 * @api {get} /profile/:sub?    Get user profile
 * @apiDescription              Get user's private profile. Admin can specify optional :sub to retrieve
 *                              other user's private profile
 *
 * @apiHeader {String}          Authorization A valid JWT token "Bearer: xxxxx"
 *
 */
router.get("/:sub?", jwt({secret: config.auth.public_key,algorithms: [config.auth.sign_opt.algorithm],}), 
function(req, res, next) {
    let sub = req.user.sub;
    if(common.has_scope(req, "admin") && req.params.sub) sub = req.params.sub;
    let select = [...safe_fields, "profile.private"];
    db.mongo.User.findOne({sub, active: true}).select(select).lean().then(user=>{
        res.json(user);
    }).catch(next);
});

//return recently registered users
router.get('/recreg/:days', async (req, res, next)=>{
    let date = new Date();
    date.setDate(date.getDate()-req.params.days);
    let users = await db.mongo.User
        .find({"times.register":{"$gt": date},"email_confirmed":true})
        .sort('times.register')
        .select(safe_fields);
    res.json({users});
});

module.exports = router;

