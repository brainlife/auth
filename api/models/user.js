'use strict';

//contrib
var Sequelize = require('sequelize');
var JsonField = require('sequelize-json');
var bcrypt = require('bcrypt');
var winston = require('winston');

//mine
var config = require('../config');
var logger = new winston.Logger(config.logger.winston);

module.exports = function(sequelize, DataTypes) {
    return sequelize.define('User', {
        
        ///////////////////////////////////////////////////////////////////////////////////////////
        //always filled
        username: Sequelize.STRING,

        ///////////////////////////////////////////////////////////////////////////////////////////
        //auth profile
        fullname: Sequelize.STRING,
        email: Sequelize.STRING,  //profile email is stored in profile service db
        email_confirmed: { type: Sequelize.BOOLEAN, defaultValue: false }, //TODO
        email_confirmation_token: Sequelize.STRING,

        ///////////////////////////////////////////////////////////////////////////////////////////
        //only used by local auth
        password_hash: Sequelize.STRING,
        password_reset_token: Sequelize.STRING, //used to reset password (via email?)
        
        ///////////////////////////////////////////////////////////////////////////////////////////
        //for 3rd party login
        iucas: Sequelize.STRING,
        ldap: Sequelize.STRING,
        googleid: Sequelize.STRING,
        gitid: Sequelize.STRING,
        x509dns: JsonField(sequelize, 'User', 'x509dns'),
        /*
        x509dns: { //array of DNs
            type: Sequelize.TEXT,
            defaultValue: '[]',
            get: function () { 
                var v = this.getDataValue('x509dns');
                if(!v) return null;
                return JSON.parse(v);
            },
            set: function (admins) {
                return this.setDataValue('x509dns', JSON.stringify(admins));
            }
        },
        */

        ///////////////////////////////////////////////////////////////////////////////////////////
        //
        times: JsonField(sequelize, 'User', 'times'),
        scopes: JsonField(sequelize, 'User', 'scopes'),
        
        active: { type: Sequelize.BOOLEAN, defaultValue: true } //TODO prevent user from loggin in (usually temporarily)

    }, {
        classMethods: {
            /*
            //why is this here?
            createToken: function(user) {
                var today = Math.round(Date.now()/1000);
                var expiration = today+3600*24*7; //7days

                //http://self-issued.info/docs/draft-ietf-oauth-json-web-token.html#RegisteredClaimName
                var token = {
                    iss: "http://trident.iu.edu", //issuer
                    exp: expiration,
                    scopes: []
                };
                if(user) {
                    token.sub = user._id;
                    //token.name = user.fullname;
                    token.scopes = user.scopes;
                }
                return token;
            },
            */
        },
        instanceMethods: {
            setPassword: function (password, cb) {
                var rec = this;
                /* cost of computation https://www.npmjs.com/package/bcrypt
                * rounds=10: ~10 hashes/sec
                * rounds=13: ~1 sec/hash
                * rounds=25: ~1 hour/hash
                * rounds=31: 2-3 days/hash
                */
                //logger.debug("generating sald");
                bcrypt.genSalt(10, function(err, salt) {
                    //logger.debug("encrypting pass");
                    bcrypt.hash(password, salt, function(err, hash) {
                        //logger.debug("done "+err);
                        if(err) return cb(err);
                        //console.log("hash: "+hash);
                        rec.password_hash = hash;
                        cb(null);
                    });
                });
            },
            isPassword: function(password) {
                //logger.debug("checking password now"); 
                if(!this.password_hash) return false; //no password, no go
                return bcrypt.compareSync(password, this.password_hash);
            },
            updateTime: function(key) {
                var times = this.get('times');
                if(!times) times = {};
                times[key] = new Date();
                this.set('times', times); //not 100% if this is needed or not
            },
            check: function() {
                if(!this.active) return {message: "Account is disabled.", code: "inactive"};
                if(config.email_confirmation && this.email_confirmed !== true) {
                    return {message: "Email is not confirmed yet.", code: "confirm_email", sub: this.id};
                }
                return null;
            }
        }
    });


    /*.then(function() {
      return User.create({
        username: 'janedoe',
        birthday: new Date(1980, 6, 20)
      });
    }).then(function(jane) {
      console.log(jane.get({
        plain: true
      }))
    });
    */

    /*

    var mongoose = require('mongoose');
    var bcrypt = require('bcrypt');

    var userSchema = mongoose.Schema({
        //_id is used as jwt's sub

        //for local authentication
        local: {
            username: { type: String, index: {unique: true} }, 
            password_hash: String, //bcrypt-ed password

            email: { type: String, index: {unique: true} },  //email needs to be unique 
            email_confirmed: { type: Boolean, default: false }
        },

        //for iucas authentication
        iucas: {
            id: { type: String, index: {unique: true} } //IU ID
        },

        //user profile
        profile: {
            fullname: String,
            nickname: String //usually user's first name.. just to show in various places
        },

        login_date: Date, //date when the user last logged in
        signup_date: { type: Date, default: Date.now }, //date when the user signed up

        //user account can be deactivated (temporarily?) by administrator
        active: { type: Boolean, default: true },

        //access granted to this user
        scopes: mongoose.Schema.Types.Mixed 
    });
    */

    /////////////////////////////////////////////////////////////////////////
    // 
    // methods for record instance
    //

    //set bcrypted password on the record cb(err)

    /////////////////////////////////////////////////////////////////////////
    //
    //guest can request for an invite
    //

    /*
    userSchema.statics.requestInvite = function(email, cb) {
        this.find({email: email}, function(err, users) {
            if(users.length != 0) {
                cb(new Error("requested email address already exists")); 
            } else {
                var user = new User({email: [email]});
                user.save(cb);
            }
        });
    }
    */

    //exports.sequelize = sequelize;

}
