'use strict';

const express = require('express');
const router = express.Router();
const passport = require('passport');
const winston = require('winston');
const jwt = require('express-jwt');
const async = require('async');

//mine
const config = require('../config');
const logger = winston.createLogger(config.logger.winston);
const common = require('../common');
const db = require('../models');

//fields that are safe to include in public profile api
let safe_fields = ["sub", "fullname", "email", "username", "active", "profile.public", "times.register"];

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
router.patch('/:sub?', jwt({secret: config.auth.public_key}), function(req, res, next) {
    let sub = req.user.sub;
    if(common.has_scope(req, "admin") && req.params.sub) sub = req.params.sub;
    let select = [...safe_fields, "profile"];
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
            if(req.body.profile.admin && common.has_scope(req, "admin")) {
                Object.assign(user.profile.admin, req.body.profile.admin);
            }
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
//TODO - I feel very iffiy about this.. I should probably create separate API for
//each use cases for any publicaly accessible APIs
//users:
//  warehouse/api common/cache_contact
//  warehouse/ui components/contactlist.vue 
//  warehouse/ui mixin/authprofilecache (used by contact.vue)
//  warehosue/api common/mail - users_general, etc..
//  cli.queryProfiles / queryAllProfiles
router.get('/list', jwt({secret: config.auth.public_key, credentialsRequired: false}), async (req, res, next)=>{
    var dirty_find = {};
    if(req.query.where) dirty_find = JSON.parse(req.query.where);
    if(req.query.find) dirty_find = JSON.parse(req.query.find);

    //for non-admin, limit the field that user can query on
    let find = {};
    for(let k in dirty_find) {
        if(common.has_scope(req, "admin") || ~safe_fields.indexOf(k)) find[k] = dirty_find[k];
    }

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

/**
 * @apiGroup Profile
 * @api {get} /profile/:sub?    Get user profile
 * @apiDescription              Get user's private profile. Admin can specify optional :sub to retrieve
 *                              other user's provate profile
 *
 * @apiHeader {String}          Authorization A valid JWT token "Bearer: xxxxx"
 *
 */
router.get("/:sub?", jwt({secret: config.auth.public_key}), function(req, res, next) {
    let sub = req.user.sub;
    if(common.has_scope(req, "admin") && req.params.sub) sub = req.params.sub;
    let select = [...safe_fields, "profile"];
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

