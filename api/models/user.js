'use strict';

//contrib
const Sequelize = require('sequelize');
const JsonField = require('sequelize-json');
const bcrypt = require('bcryptjs');
const winston = require('winston');
const async = require('async');
const zxcvbn = require('zxcvbn');

//mine
const config = require('../config');
const logger = new winston.Logger(config.logger.winston);

module.exports = function(sequelize, DataTypes) {
    const User = sequelize.define('User', {
        
        ///////////////////////////////////////////////////////////////////////////////////////////
        //always filled (really?)
        username: {type: Sequelize.STRING, unique: 'true'},

        ///////////////////////////////////////////////////////////////////////////////////////////
        //auth profile
        fullname: Sequelize.STRING,
        email: {type: Sequelize.STRING, unique: 'true'},
        email_confirmed: { type: Sequelize.BOOLEAN, defaultValue: false }, 
        email_confirmation_token: Sequelize.STRING,

        ///////////////////////////////////////////////////////////////////////////////////////////
        //only used by local auth
        password_hash: Sequelize.STRING,
        password_reset_token: Sequelize.STRING, //used to reset password (via email?)
        password_reset_cookie: Sequelize.STRING, //cookie token allowed to do reset
        //password_reset_exp: Sequelize.DATE,
        
        ///////////////////////////////////////////////////////////////////////////////////////////
        //for 3rd party login (TODO - should I store all this in JSON fields?)
        iucas: Sequelize.STRING,
        ldap: Sequelize.STRING,
        googleid: Sequelize.STRING,
        github: Sequelize.STRING,
        facebook: Sequelize.STRING,
        x509dns: JsonField(sequelize, 'User', 'x509dns'),
        orcid: Sequelize.STRING,

        //oauth2: Sequelize.STRING,
        oidc_subs: JsonField(sequelize, 'User', 'oidc_subs'), //openid connect subs

        ///////////////////////////////////////////////////////////////////////////////////////////
        //
        times: JsonField(sequelize, 'User', 'times'),
        scopes: JsonField(sequelize, 'User', 'scopes'),
        
        //prevent user from loggin in (usually temporarily)
        active: { type: Sequelize.BOOLEAN, defaultValue: true } 
    });

    User.prototype.addMemberGroups = function(gids, cb) {
        var rec = this;
        async.forEach(gids, function(gid, next) {
            sequelize.models.Group.findById(gid).then(function(group) {
                if(!group) {
                    //need to register group first
                    var group = sequelize.models.Group.build({
                        name: "tbd",
                        desc: "",
                        active: true,
                    });
                    group.save().then(function() {
                        logger.info("adding new user to group "+gid);
                        group.addMember(rec.id).then(next);
                    });
                } else {
                    logger.info("adding new user to group "+gid);
                    group.addMember(rec.id).then(next);
                }
            });
        }, cb);
    }

    User.prototype.setPassword = function(password, cb) {
        var rec = this;

        //check for password strength.. 
        //intentionally left minimalistic (UI should impose stronger restriction)
        var strength = zxcvbn(password);
        //0 # too guessable: risky password. (guesses < 10^3)
        //1 # very guessable: protection from throttled online attacks. (guesses < 10^6)
        //2 # somewhat guessable: protection from unthrottled online attacks. (guesses < 10^8)
        //3 # safely unguessable: moderate protection from offline slow-hash scenario. (guesses < 10^10)
        //4 # very unguessable: strong protection from offline slow-hash scenario. (guesses >= 10^10)
        if(strength.score == 0) {
            return cb({message: strength.feedback.warning+" - "+strength.feedback.suggestions.toString()});
        }

        /* cost of computation https://www.npmjs.com/package/bcrypt
        * rounds=10: ~10 hashes/sec
        * rounds=13: ~1 sec/hash
        * rounds=25: ~1 hour/hash
        * rounds=31: 2-3 days/hash
        */
        bcrypt.genSalt(10, function(err, salt) {
            bcrypt.hash(password, salt, function(err, hash) {
                if(err) return cb(err);
                rec.password_hash = hash;
                cb(null);
            });
        });
    }

    User.prototype.isPassword = function(password) {
        if(!this.password_hash) return false; //no password, no go
        return bcrypt.compareSync(password, this.password_hash);
    }
    User.prototype.updateTime = function(key) {
        var times = this.get('times');
        if(!times) times = {};
        times[key] = new Date();
        this.set('times', times); //not 100% if this is needed or not
    }
    User.prototype.check = function() {
        if(!this.active) return {message: "Account is disabled. Please contact the administrator.", code: "inactive"};
        if(config.local && config.local.email_confirmation && this.email_confirmed !== true) {
            return {message: "Email is not confirmed yet", path: "/confirm_email/"+this.id};
        }
        return null;
    }

    return User;
}
