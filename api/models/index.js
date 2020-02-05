let config    = require('../config');

///////////////////////////////////////////////////////////////////////////////////////////////////
//
// mongoose
//
let models = {};

const mongoose = require('mongoose');
if(config.mongoose_debug) mongoose.set("debug", true);

models.connection = mongoose.connect(config.mongodb, {useNewUrlParser: true});

models.User = mongoose.model('User', { 
    sub: {type: Number, unique: true }, //numeric user id

    username: { type: String, unique: true },

    //auth profile
    fullname: String,
    email: { type: String, unique: true },
    email_confirmed: { type: Boolean, default: false},
    email_confirmation_token: String,

    profile: {
        //any other private profile info that user can set
        public: {type: mongoose.Schema.Types.Mixed, default: {}},
    
        //any other private profile info that user can set
        private: {type: mongoose.Schema.Types.Mixed, default: {}},
    
        //administrative profile for this user that only admin can set
        admin: {type: mongoose.Schema.Types.Mixed, default: {}},
    },

    password_hash: String, //used by local auth

    //used to reset password (via email?)
    password_reset_token: String, 
    password_reset_cookie: String, //cookie token allowed to do reset
    
    //for 3rd party login
    ext: {
        iucas: { type: String, unique: true, sparse: true },
        ldap: { type: String, unique: true, sparse: true },
        googleid: { type: String, unique: true, sparse: true },
        github: { type: String, unique: true, sparse: true },
        facebook: { type: String, unique: true, sparse: true },
        orcid: { type: String, unique: true, sparse: true },

        x509dns: [ { type: String, unique: true, sparse: true } ], //["CN=Soichi Hayashi A35421,O=Indiana University,C=US,DC=cilogon,DC=org"]
        openids: [ { type: String, unique: true, sparse: true } ], //openid connect cert_subject_dn ["/DC=org/DC=cilogon/C=US/O=Google/CN=Soichi Hayashi B30632"]
        //x509dns: [ { type: String, } ], //["CN=Soichi Hayashi A35421,O=Indiana University,C=US,DC=cilogon,DC=org"]
        //openids: [ { type: String, } ], //openid connect cert_subject_dn ["/DC=org/DC=cilogon/C=US/O=Google/CN=Soichi Hayashi B30632"]
    },

    //last login time 
    times: mongoose.Schema.Types.Mixed,
    /*
    times: {
        github_login: Date,
        local_login: Date,
        iucas_login: Date,
        google_login: Date,
        password_reset: Date,
        orcid_login: Date,

        x509_login: [Date], //should be in the same order as x509s
        oidc_login: [Date], //should be in the same order as the openids
    },
    */

    scopes: mongoose.Schema.Types.Mixed,
    
    //prevent user from loggin in (usually temporarily)
    active: { type: Boolean, default: true },

    //create_date: {type: Date, default: new Date() }, //same as "times.register"
});

models.Group = mongoose.model('Group', { 
    id: {type: Number, unique: true }, 

    name: String,
    desc: String,

    admins: [ {type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true} ],
    members: [ {type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true} ],

    active: { type: Boolean, default: true },

    create_date: {type: Date, default: new Date() },
});

module.exports.mongo = models;

//const kitty = new Cat({ name: 'Zildjian' });
//kitty.save().then(() => console.log('meow'));

