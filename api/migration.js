
//contrib
var winston = require('winston');
var async = require('async');
var Promise = require('promise');
var Sequelize = require('sequelize');

//mine
var config = require('./config');
var logger = new winston.Logger(config.logger.winston);
var db = require('./models');

var migrations = [
    /*
    function(qi, next) {
        //skipped
    },
    */
    /*
    function(qi, next) {
        logger.info("adding x509dn field for user table");
        qi.addColumn('Users', 'x509dn', Sequelize.STRING).then(function() {
            next();
        });
    },
    */
    /*
    function(qi, next) {
        next();
    },
    function(qi, next) {
        logger.info("removing column");
        qi.removeColumn('Users', 'x509dns').then(function() {
            next();
        });
    },
    */
    function(qi, next) {
        logger.info("adding x509dn field for user table");
        qi.addColumn('Users', 'x509dns', {type: Sequelize.TEXT, defaultValue: '[]'}).then(function() {
            next();
        });
    },
    function(qi, next) {
        logger.info("adding email_confirmed");
        qi.addColumn('Users', 'email_confirmed', {type: Sequelize.BOOLEAN, defaultValue: false}).then(function() {
            next();
        });
    },
    function(qi, next) {
        logger.info("adding email_confirmation_token");
        qi.addColumn('Users', 'email_confirmation_token', {type: Sequelize.STRING, /*defaultValue: uuid.v4()*/}).then(function() {
            next();
        });
    },
    function(qi, next) {
        logger.info("adding fullname");
        qi.addColumn('Users', 'fullname', {type: Sequelize.STRING}).then(function() {
            next();
        });
    },
    function(qi, next) {
        logger.info("adding ldap");
        qi.addColumn('Users', 'ldap', {type: Sequelize.STRING}).then(function() {
            next();
        });
    },
    function(qi, next) {
        logger.info("adding github ID");
        qi.addColumn('Users', 'github', {type: Sequelize.STRING}).then(function() {
            next();
        });
    },
    function(qi, next) {
        logger.info("adding facebook ID");
        qi.addColumn('Users', 'facebook', {type: Sequelize.STRING}).then(function() {
            next();
        });
    },
    function(qi, next) {
        next();
    },
    function(qi, next) {
        logger.info("adding password_reset_cookie");
        qi.addColumn('Users', 'password_reset_cookie', {type: Sequelize.STRING}).then(function() {
            next();
        });
    },
    function(qi, next) {
        next();
    },
    function(qi, next) {
        logger.info("adding oidc_subs field for user table");
        qi.addColumn('Users', 'oidc_subs', {type: Sequelize.TEXT, defaultValue: '[]'}).then(function() {
            next();
        });
    },
    function(qi, next) {
        logger.info("adding orcid");
        qi.addColumn('Users', 'orcid', {type: Sequelize.STRING}).then(function() {
            next();
        });
    },
];

exports.run = function() {
    logger.debug("running migration");
    return new Promise(function(resolve, reject) {
        db.Migration.findOne({}).then(function(info) {
            //logger.debug(JSON.stringify(info, null, 4));
            if(!info) {
                //assume brand new - skip everything
                return db.Migration.create({version: migrations.length}).then(resolve);
            } else {
                //var count = migrations.length;
                var ms = migrations.splice(info.version);
                qi = db.sequelize.getQueryInterface();
                async.eachSeries(ms, function(m, next) {
                    m(qi, function(err) {
                        if(err) return next(err);
                        info.increment('version');
                        next();
                    }); 
                }, function(err) {
                    if(err) reject(err);
                    else resolve("migration complete");
                    /*
                    info.save().then(function() {
                        if(err) reject(err);
                        else resolve("migration complete");
                    });
                    */
                });
            }
        });
    });
}
