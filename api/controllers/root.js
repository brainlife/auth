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

function has_scope(req, role) {
    if(!req.user) return false;
    if(!req.user.scopes) return false;
    if(!req.user.scopes.auth) return false;
    if(!~req.user.scopes.auth.indexOf(role)) return false;
    return true;
}

function scope(role) {
    return function(req, res, next) {
        if(has_scope(req, role)) next();
        else res.status(401).send(role+" role required");
    }
}

/**
 * @api {post} /refresh Refresh JWT Token.
 * @apiDescription 
 *              JWT Token normally lasts for a few hours. Application should call this API periodically
 *              to get it refreshed before it expires. 
 *              You can also use this API to temporarily drop certain privileges you previously had to 
 *              simulate user with less privileges, or make your token more secure by removing unnecessary
 *              privileges (set scopes parameters)
 *
 * @apiName Refresh
 * @apiGroup User
 *
 * @apiHeader {String} authorization    A valid JWT token (Bearer:)
 * @apiParam {Object} scopes    Desired scopes to intersect (you can remove certain scopes)
 *
 * @apiSuccess {Object} jwt New JWT token
 */
router.post('/refresh', jwt({secret: config.auth.public_key}), function(req, res, next) {
    db.mongo.User.findOne({sub: req.user.sub, active: true}).then(user=>{
        if(!user) return next("Couldn't find any user with sub:"+req.user.sub);
        //intersect requested scopes
        if(req.body.scopes) user.scopes = common.intersect_scopes(user.scoppes, req.body.scopes);
        common.createClaim(user, function(err, claim) {
            if(err) return next(err);
            common.publish("user.refresh."+user.sub, {username: user.username, exp: claim.exp});
            var jwt = common.signJwt(claim);
            return res.json({jwt: jwt});
        });
    });
});

//TODO this API send any user email with URL provided by an user - which is a major security risk
//I should use configured URL for referer
router.post('/send_email_confirmation', (req, res, next)=>{ 
    db.mongo.User.findOne({sub: req.body.sub}).then(user=>{
        if(!user) return next("Couldn't find any user with sub:"+req.body.sub);
        if(user.email_confirmed) return next("Email already confirmed.");
        if(!req.headers.referer) return next("referer not set.. can't send confirmation");
        common.send_email_confirmation(req.headers.referer, user, err=>{
            if(err) return next(err);
            res.json({message: 'Sent confirmation email with subject: '+config.local.email_confirmation.subject});
        });
    });
});

router.post('/confirm_email', async (req, res, next)=>{
    let user = await db.mongo.User.findOne({email_confirmation_token: req.body.token});
    if(!user) return next("Couldn't find any user with token:"+req.body.token);
    if(user.email_confirmed) return next("Email already confirmed.");
    user.update({$set: {email_confirmed: true, 'times.confirm_email': new Date()}}).then(()=>{
        //common.publish("user.create."+user.sub, user);
        res.json({message: "Email address confirmed! Please re-login."});
    });
});

/**
 * @api {get} /health Get API status
 * @apiDescription Get current API status
 * @apiName GetHealth
 * @apiGroup System
 *
 * @apiSuccess {String} status 'ok' or 'failed'
 */
router.get('/health', function(req, res) {
    res.json({
        status: 'ok',
        headers: req.headers, 
    });
});

/**
 * @api {get} /me Get user details
 * @apiDescription Returns things that user might want to know about himself.
 * password_hash will be set to true if the password is set, otherwise null
 *
 * @apiGroup User
 * 
 * @apiHeader {String} authorization A valid JWT token "Bearer: xxxxx"
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *         "username": "hayashis",
 *         "fullname": "Soichi Hayashi",
 *         "email": "hayashis@iu.edu",
 *         "email_confirmed": true,
 *         "iucas": "hayashis"
 *     }
 */
router.get('/me', jwt({secret: config.auth.public_key}), function(req, res, next) {
    db.mongo.User.findOne({sub: req.user.sub}).then(function(user) {
        if(!user) return res.status(404).end();
        if(user.password_hash) user.password_hash = true;
        res.json(user);
    });
});

/**
 * @api {get} /users
 * @apiName UserGroups
 * @apiDescription Query list of users
 *
 * @apiGroup User
 *
 * @apiParam {Object} find      Optional sequelize where query - defaults to {}
 * 
 * @apiHeader {String} authorization A valid JWT token "Bearer: xxxxx"
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     [ 1,2,3 ] 
 */
router.get('/users', jwt({secret: config.auth.public_key}), scope("admin"), function(req, res, next) {
    var where = {};
    if(req.query.where) where = JSON.parse(req.query.find||req.query.where);
    db.mongo.User.find(where).select('sub username email_confirmed fullname email ext times scopes active').lean().then(users=>{
        res.json(users);
    });
});

/**
 * @api {get} /user/groups/:id Get list of group IDS that user is member/admin of
 * @apiName UserGroups
 * @apiDescription admin only
 *
 * @apiGroup User
 * 
 * @apiHeader {String} authorization A valid JWT token "Bearer: xxxxx"
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     [ 1,2,3 ] 
 */
router.get('/user/groups/:id', jwt({secret: config.auth.public_key}), scope("admin"), function(req, res, next) {
    db.mongo.User.findOne({sub: req.params.id, active: true}).then(async user=>{
        if(!user) return res.status(404).end();
        try {
            /*
            var gids = [];
            let groups = await user.getAdminGroups({attributes: ['id']});
            groups.forEach(function(group) {
                if(!gids.includes(group.id)) gids.push(group.id);  
            });

            groups = await user.getMemberGroups({attributes: ['id']});
            groups.forEach(function(group) {
                if(!gids.includes(group.id)) gids.push(group.id);  
            });
            */
            let groups = await db.mongo.Group.find({$or: [{admins: user}, {members: user}]}, {id: 1});
            let gids = groups.map(group=>group.id);
            res.json(gids);
        } catch(err) {
            next(err);
        }
    });
});
 
//return detail from just one user - admin only 
//users: (used by event service to query for user's email)
//users: adminuser ui to pull user info
router.get('/user/:id', jwt({secret: config.auth.public_key}), scope("admin"), (req, res, next)=>{
    db.mongo.User.findOne({sub: req.params.id}).select('-password_hash -password_reset_token').then(user=>{
        res.json(user);
    });
});

/**
 * @apiName UserGroups
 * @api {get} /jwt/:id  issue user jwt
 * @apiDescription      (admin only)
 * @apiGroup User
 *
 * @apiParam {String[]} [gids] gids to append
 * 
 * @apiHeader {String} authorization A valid JWT token "Bearer: xxxxx"
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     [ 1,2,3 ] 
 */
router.get('/jwt/:id', jwt({secret: config.auth.public_key}), scope("admin"), function(req, res, next) {
    db.mongo.User.findOne({sub: req.params.id, active: true}).then(user=>{
        if(!user) return next("Couldn't find any user with sub:"+req.params.id);
		common.createClaim(user, function(err, claim) {
			if(err) return next(err);
            if(req.query.claim) {
                let override = JSON.parse(req.query.claim);
                logger.debug('claim override requested');
                logger.debug(override);
                Object.assign(claim, override);
            }
			res.json({jwt: common.signJwt(claim)});
		});
    });
});

//update user info (admin only)
router.put('/user/:id', jwt({secret: config.auth.public_key}), scope("admin"), function(req, res, next) {
    db.mongo.User.findOne({sub: req.params.id}).then(user=>{
        if(!user) return next("can't find user d:"+req.params.id);
        user.updateOne({$set: req.body}).then(()=>{
            common.publish("user.update."+user.sub, req.body);
            res.json({message: "User updated successfully"});
        }).catch(err=>{
            next(err.toString());
        });
    });
});

/**
 * @apiName UserGroups
 * @api {get} /jwt/:id  list all groups
 * @apiDescription      list all groups with basic info (available to all authenticated users) including inactive ones
 * @apiGroup User
 *
 * @apiHeader {String}  authorization A valid JWT token "Bearer: xxxxx"
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     [ 1,2,3 ] 
 */
router.get('/groups', jwt({secret: config.auth.public_key}), async (req, res, next)=>{
    let user = await db.mongo.User.findOne({sub: req.user.sub});
    if(!user) return next("can't find user sub:"+req.user.sub);
    
    let groups;
    if(has_scope(req, "admin")) {
        //return all groups for admin
        groups = await db.mongo.Group.find({})
            .lean().populate('admins members', 'email fullname username');
        groups.forEach(group=>{
            group.canedit = true;
        });
        res.json(groups);
    } else {
        //normal user only gets to see groups that they are admin/members
        let admin_groups = await db.mongo.Group.find({admins: user._id})
            .lean().populate('admins members', 'email fullname username');
        let member_only_groups = await db.mongo.Group.find({admins: {$ne: user._id}, members: user._id})
            .lean().populate('admins members', 'email fullname username');
        admin_groups.forEach(group=>{
            group.canedit = true;
        });

        res.json([...admin_groups, ...member_only_groups]);
    }
});

//update group (super admin, or admin of the group can update)
//admin/members should be a list of user subs (not _id)
router.put('/group/:id', jwt({secret: config.auth.public_key}), function(req, res, next) {
    logger.debug("updating group", req.params.id);
    db.mongo.Group.findOne({id: req.params.id}).populate('admins').then(async group=>{
        if (!group) return next("can't find group id:"+req.params.id);
        logger.debug("loading current admin");
        let isadmin = group.admins.find(contact=>contact.sub == req.user.sub);
        if(!isadmin && !has_scope(req, "admin")) return res.status(401).send("you can't update this group");

        logger.debug("user can update this group.. updating");

        //convert list of subs to list of users
        req.body.admins = await db.mongo.User.find({sub: {$in: req.body.admins}});
        req.body.members = await db.mongo.User.find({sub: {$in: req.body.members}});

        group.updateOne({$set: req.body}).then(()=>{
            common.publish("group.update."+group.id, req.body);
            logger.debug("all done");
            res.json({message: "Group updated successfully"});
        });
    });
});

//create new group (any user can create group?)
//admin/members should be a list of user subs (not _id)
router.post('/group', jwt({secret: config.auth.public_key}), async (req, res, next)=>{

    //find next group id
    let last_record = await db.mongo.Group.findOne({}).sort({_id:-1});
    if(!last_record) req.body.id = 1;
    else req.body.id = last_record.id + 1;
    
    //convert list of subs to list of users
    req.body.admins = await db.mongo.User.find({sub: {$in: req.body.admins}});
    req.body.members = await db.mongo.User.find({sub: {$in: req.body.members}});
    
    var group = new db.mongo.Group(req.body);
    group.save().then(newgroup=>{
        common.publish("group.create."+group.id, newgroup);
        res.json({message: "Group created", group});
    }).catch(function(err) {
        next(err);
    });
});

//return detail from just one group (open to all users)
//redundant with /groups. I should probabaly depcreate this and implement query capability for /groups
router.get('/group/:id', jwt({secret: config.auth.public_key}), function(req, res) {
    db.mongo.Group.findOne({id: req.params.id}).lean().populate('admins members', 'email fullname username')
    .then(function(group) {
        res.json(group);
    });
});

/**
 * @apiGroup Profile
 * @api {put} /profile Set user profile
 * @apiDescription Update user's auth profile
 * @apiName PutProfile
 *
 * @apiHeader {String} authorization A valid JWT token (Bearer:)
 * @apiParam {String} fullname User's fullname
 *
 * @apiSuccess {Object} updated user object
 */
router.put('/profile', jwt({secret: config.auth.public_key}), function(req, res, next) {
    db.mongo.User.findOne({sub: req.user.sub, active: true}).then(function(user) {
        if(!user) return next("no such active user");
        user.fullname = req.body.fullname;
        user.save().then(function() {
            common.publish("user.update."+user.sub, req.body);
            res.json(user);
        });
    });
});

//I feel very iffy about this API.. I should only expose user's auth email.
//maybe I should make this admin only and let other services proxy subsets?
/**
 * @apiGroup Profile
 * @api {get} /profile          Query auth profiles
 * @apiDescription              Query auth profiles
 * @apiName Get auth (public) profiles
 *
 * @apiParam {Object} where     Optional sequelize where query - defaults to {}
 * @apiParam {Object} order     Optional sequelize sort object - defaults to [['fullname', 'DESC']]
 * @apiParam {Number} limit     Optional Maximum number of records to return - defaults to 100
 * @apiParam {Number} offset    Optional Record offset for pagination
 *
 * @apiHeader {String} authorization 
 *                              A valid JWT token "Bearer: xxxxx"
 */
router.get('/profile', jwt({secret: config.auth.public_key}), async (req, res, next)=>{
    var where = {};
    if(req.query.where) where = JSON.parse(req.query.where);
    var order = 'fullname';
    if(req.query.order) order = JSON.parse(req.query.order);

    let limit = 100;
    if(req.query.limit) limit = parseInt(req.query.limit);
    let skip = 0;
    if(req.query.offset) skip = parseInt(req.query.offset);

    let count = await db.mongo.User.countDocuments(where);
    let users = await db.mongo.User.find(where).sort(order).limit(limit).skip(skip).select('sub fullname email active username');
    res.json({profiles: users, count});
});

module.exports = router;
