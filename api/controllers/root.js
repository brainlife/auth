'use strict';

const express = require('express');
const router = express.Router();
const passport = require('passport');
const winston = require('winston');
const jwt = require('express-jwt');
const async = require('async');

//mine
const config = require('../config');
const logger = new winston.Logger(config.logger.winston);
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
    db.User.findOne({where: {id: req.user.sub}}).then(function(user) {
        if(!user) return next("Couldn't find any user with sub:"+req.user.sub);
        //intersect requested scopes
        if(req.body.scopes) user.scopes = common.intersect_scopes(user.scoppes, req.body.scopes);
        common.createClaim(user, function(err, claim) {
            if(err) return next(err);
            var jwt = common.signJwt(claim);
            return res.json({jwt: jwt});
        });
    });
});

//TODO this API send any user email with URL provided by an user - which is a major security risk
//I should use configured URL for referer
router.post('/send_email_confirmation', function(req, res, next) { 
    db.User.findOne({where: {id: req.body.sub}}).then(function(user) {
        if(!user) return next("Couldn't find any user with sub:"+req.body.sub);
        if(user.email_confirmed) return next("Email already confirmed.");
        if(!req.headers.referer) return next("referer not set.. can't send confirmation");
        common.send_email_confirmation(req.headers.referer, user, function(err) {
            if(err) return next(err);
            res.json({message: 'Sent confirmation email with subject: '+config.local.email_confirmation.subject});
        });
    });
});

router.post('/confirm_email', function(req, res, next) {
    db.User.findOne({where: {email_confirmation_token: req.body.token}}).then(function(user) {
        if(!user) return next("Couldn't find any user with token:"+req.body.token);
        if(user.email_confirmed) return next("Email already confirmed.");
        user.email_confirmed = true;
        user.save().then(function() {
            res.json({message: "Email address confirmed! Please re-login."});
        });
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
 * @apiName SendEmailNotification
 * @apiDescription Rreturns things that user might want to know about himself.
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
    db.User.findOne({
        where: {id: req.user.sub},
    }).then(function(user) {
        if(!user) return res.status(404).end();
        if(user.password_hash) user.password_hash = true;
        res.json(user);
    });
});

//return list of all users (minus password)
router.get('/users', jwt({secret: config.auth.public_key}), scope("admin"), function(req, res, next) {
    var where = {};
    if(req.query.where) where = JSON.parse(req.query.where);
    //logger.debug(req.query.where);
    db.User.findAll({
        where: where, 
        //raw: true, //so that I can add _gids
        
        //password_hash is replaced by true/false right below
        attributes: [
            'id', 'username', 'fullname', 'password_hash', 
            'email', 'email_confirmed', 'iucas', 'googleid', 'github', 'x509dns', 
            'times', 'scopes', 'active'],
    }).then(function(users) {

        //mask password!
        users.forEach(function(user) {
            if(user.password_hash) user.password_hash = true;
        });
        
        res.json(users);
    });
});

/**
 * @api {get} /user/groups/:id Get list of group IDS that user is member of
 * @apiName UserGroups
 * @apiDescription Only for admin
 *
 * @apiGroup User
 * 
 * @apiHeader {String} authorization A valid JWT token "Bearer: xxxxx"
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     [ 1,2,3 ] 
 */
router.get('/user/groups/:id', jwt({secret: config.auth.public_key}), function(req, res, next) {
    db.User.findOne({
        where: {id: req.params.id},
    }).then(function(user) {
        if(!user) return res.status(404).end();
        user.getMemberGroups({attributes: ['id']}).then(function(groups) {
            var gids = [];
            groups.forEach(function(group) {
                gids.push(group.id);  
            });
            res.json(gids);
        });
    });
});
 
//DEPRECATED - use /users
//return detail from just one user - admin only (used by event service to query for user's email)
router.get('/user/:id', jwt({secret: config.auth.public_key}), scope("admin"), function(req, res) {
    db.User.findOne({
        where: {id: req.params.id},
        attributes: [
            'id', 'username', 'fullname',
            'email', 'email_confirmed', 'iucas', 'googleid', 'github', 'x509dns', 
            'times', 'scopes', 'active'],
    }).then(function(user) {
        res.json(user);
    });
});

//issue user jwt (admin only)
router.get('/jwt/:id', jwt({secret: config.auth.public_key}), scope("admin"), function(req, res, next) {
    db.User.findOne({
        where: {id: req.params.id},
    }).then(function(user) {
        if(!user) return next("Couldn't find any user with sub:"+req.params.id);
		common.createClaim(user, function(err, claim) {
			if(err) return next(err);
			res.json({jwt: common.signJwt(claim)});
		});
    }).catch(next);
});

//update user info (admin only)
router.put('/user/:id', jwt({secret: config.auth.public_key}), scope("admin") ,function(req, res, next) {
    db.User.findOne({where: {id: req.params.id}}).then(function(user) {
        if (!user) return next("can't find user id:"+req.params.id);
        user.update(req.body).then(function(err) {
            res.json({message: "User updated successfully"});
        });
    }).catch(next);
});

//return list of all groups (open to all users)
//TODO - maybe I should hide members of groups if user is not member of it?
router.get('/groups', jwt({secret: config.auth.public_key}), function(req, res) {
    db.Group.findAll({
        include: [
            {model: db.User, as: 'Admins', attributes: ['id', 'email', 'fullname']},
            {model: db.User, as: 'Members', attributes: ['id', 'email', 'fullname']},
        ],
    }).then(function(_groups) {
        var groups = JSON.parse(JSON.stringify(_groups));
        groups.forEach(function(group) {
            group.canedit = false;
            if(has_scope(req, "admin")) group.canedit = true;
            group.Admins.forEach(function(admin) {
                if(admin.id == req.user.sub) {
                    group.canedit = true;
                }
            }); 
        });
        res.json(groups);
    });
});

//update group (super admin, or admin of the group can update)
router.put('/group/:id', jwt({secret: config.auth.public_key}), function(req, res, next) {
    logger.debug("updadting group", req.params.id);
    db.Group.findOne({where: {id: req.params.id}}).then(function(group) {
        if (!group) return next("can't find group id:"+req.params.id);
        logger.debug("loading current admin");
        group.getAdmins().then(function(admins) {
            var admin_ids = [];
            admins.forEach(function(admin) {
                admin_ids.push(admin.id); //toString so that I can compare with indexOf
            });

            //logger.debug("requested by", JSON.stringify(req.user, null, 4));
            //logger.debug("admin ids", admin_ids);

            if(!~admin_ids.indexOf(req.user.sub) && !has_scope(req, "admin")) return res.status(401).send("you can't update this group");

            logger.debug("user can update this group.. updating");
            group.update(req.body).then(function(err) {
                logger.debug("updating admins");
                group.setAdmins(req.body.admins).then(function() {
                    logger.debug("setting members");
                    group.setMembers(req.body.members).then(function() {
                        logger.debug("all done");
                        res.json({message: "Group updated successfully"});
                    });
                });
            }).catch(function(err) {
                next(err);
            });
        });
    });
});

//create new group (any user can create group?)
router.post('/group', jwt({secret: config.auth.public_key}), function(req, res, next) {
    var group = db.Group.build(req.body);
    group.save().then(function() {
        group.setAdmins(req.body.admins).then(function() {
            group.setMembers(req.body.members).then(function() {
                res.json({message: "Group created", group: group});
            });
        });
    }).catch(function(err) {
        next(err);
    });
});

//return detail from just one group (open to all users)
//redundant with /groups. I should probabaly depcreate this and implement query capability for /groups
router.get('/group/:id', jwt({secret: config.auth.public_key}), function(req, res) {
    db.Group.findOne({
        where: {id: req.params.id},
        include: [
            {model: db.User, as: 'Admins', attributes: ['id', 'email', 'fullname']},
            {model: db.User, as: 'Members', attributes: ['id', 'email', 'fullname']},
        ]
    }).then(function(group) {
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
    db.User.findOne({where: {id: req.user.sub}}).then(function(user) {
        user.fullname = req.body.fullname;
        user.save().then(function() {
            //res.json({status: "ok", message: "Account profile updated successfully."});
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
router.get('/profile', jwt({secret: config.auth.public_key}), function(req, res, next) {
    var where = {};
    if(req.query.where) where = JSON.parse(req.query.where);
    var order = [['fullname', 'DESC']];
    if(req.query.order) order = JSON.parse(req.query.order);

    logger.debug("profile....................", req.query.limit);

    db.User.findAndCountAll({
        where: where,
        order: order,
        limit: req.query.limit||100,
        offset: req.query.offset||0,
        attributes: [ 'id', 'fullname', 'email', 'active' ]
    }).then(function(profiles) {
        res.json({profiles: profiles.rows, count: profiles.count});
    });
});

module.exports = router;
