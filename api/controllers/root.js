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

router.use('/profile', require('./profile'));

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
 * @apiParam {Object} [scopes]    Desired scopes to intersect (you can remove certain scopes)
 * @apiParam {Number[]} [gids]    Desired gids to intersect (you can remove certain gids)
 * @apiParam {Boolean} [clearProfile]
 *                              Set this to true if you don't need profile info 
 * @apiParam {String} [ttl]     time-to-live in milliseconds (if not set, it will be defaulted to server default)
 *
 * @apiSuccess {Object} jwt New JWT token
 */
//refactoring with async-await - authored by: Apurva
router.post('/refresh', jwt({
    secret: config.auth.public_key,
    algorithms: [config.auth.sign_opt.algorithm],
}), async function(req, res, next) {
    try {
        const user = await db.mongo.User.findOne({sub: req.user.sub});
        if (!user) {
            return next("Couldn't find any user with sub:" + req.user.sub);
        }
        const error = common.checkUser(user, req);
        if (error) {
            return next(error);
        }
        const claim = await new Promise((resolve, reject) => {
            common.createClaim(user, (err, claim) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(claim);
                }
            });
        });
        if (req.body.scopes) {
            claim.scopes = common.intersect_scopes(claim.scopes, req.body.scopes);
        }
        if (req.body.gids) {
            claim.gids = claim.gids.filter(id => req.body.gids.includes(id));
        }
        if (req.body.clearProfile) {
            delete claim.profile;
        }
        if (req.body.ttl) {
            claim.exp = (Date.now() + req.body.ttl) / 1000;
        }
        const jwt = common.signJwt(claim);
        common.publish("user.refresh." + user.sub, {username: user.username, exp: claim.exp});
        res.json({jwt});
    } catch (err) {
        next(err);
    }
});

//TODO this API send any user email with URL provided by an user - which is a major security risk
//I should use configured URL for referer
//refactoring with async-await - authored by: Apurva
router.post('/send_email_confirmation', async (req, res, next) => { 
    try {
        const user = await db.mongo.User.findOne({sub: req.body.sub});
        if (!user) {
            return next("Couldn't find any user with sub:" + req.body.sub);
        }
        if (user.email_confirmed) {
            return next("Email already confirmed.");
        }
        if (!req.headers.referer) {
            return next("referer not set.. can't send confirmation");
        }
        await common.send_email_confirmation(req.headers.referer, user);
        res.json({message: 'Sent confirmation email with subject: ' + config.local.email_confirmation.subject});
    } catch (err) {
        next(err);
    }
});

//refactoring with async-await - authored by: Apurva
router.post('/confirm_email', async (req, res, next) => {
    try {
        let user = await db.mongo.User.findOne({ email_confirmation_token: req.body.token });
        if (!user) {
            return next("Couldn't find any user with token:" + req.body.token);
        }
        if (user.email_confirmed) {
            return next("Email already confirmed.");
        }
        await user.updateOne({ $set: { email_confirmed: true, 'times.confirm_email': new Date() } });
        res.json({ message: "Email address confirmed! Please re-login." });
    } catch (err) {
        next(err);
    }
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
//refactoring with async-await - authored by: Apurva
router.get('/me', jwt({
    secret: config.auth.public_key,
    algorithms: [config.auth.sign_opt.algorithm],
}), async function(req, res, next) {
    try {
        const user = await db.mongo.User.findOne({sub: req.user.sub});
        if (!user) {
            return res.status(404).end();
        }
        if (user.password_hash) {
            user.password_hash = true;
        }
        res.json(user);
    } catch (err) {
        next(err);
    }
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
//refactoring with async-await - authored by: Apurva
router.get('/users', jwt({
    secret: config.auth.public_key,
    algorithms: [config.auth.sign_opt.algorithm],
}), common.scope("admin"), async (req, res, next) => {
    try {
        let where = {};
        if(req.query.find || req.query.where) where = JSON.parse(req.query.find || req.query.where);
        const limit = req.query.limit || 50;
        const skip = req.query.skip || 0;
        const select = req.query.select || 'sub profile username email_confirmed fullname email ext times scopes active';
        const users = await db.mongo.User.find(where)
            .select(select)
            .skip(+skip)
            .limit(+limit)
            .lean();
        const count = await db.mongo.User.countDocuments(where);
        res.json({ users, count });
    } catch (err) {
        next(err);
    }
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
router.get('/user/groups/:id', jwt({
    secret: config.auth.public_key,
    algorithms: [config.auth.sign_opt.algorithm],
}), common.scope("admin"), function(req, res, next) {
    db.mongo.User.findOne({sub: req.params.id}).then(async user=>{
        if(!user) return res.status(404).end();
        try {
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
router.get('/user/:id', jwt({
    secret: config.auth.public_key,
    algorithms: [config.auth.sign_opt.algorithm],
}), common.scope("admin"), (req, res, next)=>{
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
router.get('/jwt/:id', jwt({
    secret: config.auth.public_key,
    algorithms: [config.auth.sign_opt.algorithm],
}), common.scope("admin"), function(req, res, next) {
    db.mongo.User.findOne({sub: req.params.id}).then(user=>{
        if(!user) return next("Couldn't find any user with sub:"+req.params.id);
        const error = common.checkUser(user, req);
        if(error) return next(error);
        common.createClaim(user, function(err, claim) {
            if(err) return next(err);
            if(req.query.claim) {
                let override = JSON.parse(req.query.claim);
                Object.assign(claim, override);
            }
            res.json({jwt: common.signJwt(claim)});
        });
    });
});

//update user info (admin only)
router.put('/user/:id', jwt({
    secret: config.auth.public_key,
    algorithms: [config.auth.sign_opt.algorithm],
}), common.scope("admin"), function(req, res, next) {
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
 * @api {get} /jwt/:id      query all groups
 * @apiDescription          Query all groups with basic info (available to all authenticated users) including inactive ones
 * @apiGroup User
 *
 * @apiParam {Object} find  query - defaults to {}
 * @apiHeader {String}      authorization A valid JWT token "Bearer: xxxxx"
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     [ 1,2,3 ] 
 */
router.get('/groups', jwt({
    secret: config.auth.public_key,
    algorithms: [config.auth.sign_opt.algorithm],
}), async (req, res, next)=>{
    const user = await db.mongo.User.findOne({sub: req.user.sub});
    if(!user) return next("can't find user sub:"+req.user.sub);
    let find = {};
    if(req.query.find) find = JSON.parse(req.query.find);
    if(common.has_scope(req, "admin")) {
        const limit = req.query.limit || 50;
        const skip = req.query.skip || 0;
        //return all groups for admin matching the query and their count
        db.mongo.Group.find(find)
        .skip(+skip)
        .limit(+limit)
        .lean()
        .populate('admins members', 'email fullname username sub')
        .exec((err, groups)=>{
            if(err) return next(err);
            db.mongo.Group.countDocuments(find).exec((err,count)=>{
                if(err) return next(err);
                groups.forEach(group=>{
                    group.canedit = true;
                });
                res.json({groups,count});
            });
        });
    } else {
        /*
        const adminFind = {$and: [find, {admins: user._id}]};;
        const memberFind = {$and: [find, {admins: {$ne: user._id}, members: user._id}]}; //TODO Why $ne admin?
        let admin_groups = await db.mongo.Group.find(adminFind).lean()
            .populate('admins members', 'email fullname username sub');
        admin_groups.forEach(group=>{
            group.canedit = true;
        });

        let member_only_groups = await db.mongo.Group.find(memberFind).lean()
            .populate('admins members', 'email fullname username sub');

        res.json([...admin_groups, ...member_only_groups]);
        */

        const groups = await db.mongo.Group.find({
            $and: [
                //user provided query
                find,

                //normal user only gets to see groups that they are admin/members
                {
                    $or: [
                        {admins: user._id},
                        {members: user._id},
                    ]
                }
            ],
        }).lean().populate('admins members', 'email fullname username sub');

        //if user is listed as admin, they can edit it
        groups.forEach(group=>{
            if(group.admins.includes(req.user.sub)) group.canedit = true;
        });
        res.json(groups);
    }
});

//update group (super admin, or admin of the group can update)
//admin/members should be a list of user subs (not _id)
router.put('/group/:id', jwt({
    secret: config.auth.public_key,
    algorithms: [config.auth.sign_opt.algorithm],
}), function(req, res, next) {
    db.mongo.Group.findOne({id: req.params.id}).populate('admins').then(async group=>{
        if (!group) return next("can't find group id:"+req.params.id);
        
        //make sure the user is listed as admin
        let isadmin = group.admins.find(contact=>contact.sub == req.user.sub);
        if(!isadmin && !common.has_scope(req, "admin")) return res.status(401).send("you can't update this group");

        //convert list of subs to list of users
        req.body.admins = await db.mongo.User.find({sub: {$in: req.body.admins}});
        req.body.members = await db.mongo.User.find({sub: {$in: req.body.members}});

        group.updateOne({$set: req.body}).then(()=>{
            common.publish("group.update."+group.id, req.body);
            console.debug("all done");
            res.json({message: "Group updated successfully"});
        });
    }).catch(next);
});

let g_next_gid = 1;
db.mongo.Group.findOne({}).sort({_id:-1}).then(last_record=>{
    //TODO - if I run more than 1 auth instance, I will need to start/increment equal to the number of all instances
    if(last_record) g_next_gid = last_record.id + 1;
    console.log("next_gid", g_next_gid);
});

//create new group (any user can create group?)
//admin/members should be a list of user subs (not _id)
router.post('/group', jwt({
    secret: config.auth.public_key,
    algorithms: [config.auth.sign_opt.algorithm],
}), async (req, res, next)=>{

    //TODO - there is concurrency issue with finding max gid v.s. using it for next one
    //another user could interupt between above and below code..
    //so let's use global value
    req.body.id = g_next_gid++;
    
    //convert list of subs to list of users
    req.body.admins = await db.mongo.User.find({sub: {$in: req.body.admins}});
    req.body.members = await db.mongo.User.find({sub: {$in: req.body.members}});
    
    //create new group
    var group = new db.mongo.Group(req.body);
    group.save().then(newgroup=>{
        common.publish("group.create."+group.id, newgroup);
        res.json({message: "Group created", group});

    }).catch(function(err) {
        next(err);
    });
});

//return detail from just one group (open to all users)
//DEPRECATED by with /groups.
router.get('/group/:id', jwt({
    secret: config.auth.public_key,
    algorithms: [config.auth.sign_opt.algorithm],
}), function(req, res) {
    db.mongo.Group.findOne({id: req.params.id}).lean().populate('admins members', 'email fullname username sub')
    .then(function(group) {
        res.json(group);
    });
});

module.exports = router;



