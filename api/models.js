
const mongoose = require('mongoose');
const config = require('./config');

if(config.mongoose_debug) mongoose.set("debug", true);

///////////////////////////////////////////////////////////////////////////////////////////////////
//
// mongoose
//
const models = {};

models.connection = mongoose.connect(config.mongodb, {
    /*
    readPreference: 'nearest',
    readConcern: {
        level: 'majority',//prevents read to grab stale data from secondary
    },
    writeConcern: {
        w: 'majority', //isn't this the default?
    },
    */
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

models.User = mongoose.model('User', { 

    //string is more generic.. we should eventually convert to use string sub
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
        //admin: {type: mongoose.Schema.Types.Mixed, default: {}},
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
        globus: { type: String, unique: true, sparse: true },
        logingov: { type: String, unique: true, sparse: true }, //TODO

        x509dns: [ String ], //unique index breaks signup?
        openids: [ String ],  //unique index breaks signup?
    },

    //last login time 
    times: mongoose.Schema.Types.Mixed,

    //req.headers from last successful login (for auditing purpose)
    reqHeaders: mongoose.Schema.Types.Mixed,

    scopes: mongoose.Schema.Types.Mixed,
    
    //prevent user from issuing jwt (usually temporarily)
    active: { type: Boolean, default: true },

    //create_date: {type: Date, default: new Date() }, //same as "times.register"
});

models.Group = mongoose.model('Group', { 
    id: {type: Number, unique: true }, 

    name: String,
    desc: String,

    admins: [ {type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: false} ],
    members: [ {type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: false} ],

    active: { type: Boolean, default: true },

    create_date: {type: Date, default: new Date() },
});

//record recent login activity.. (TODO will be used to prevent password guessing attack)
models.FailedLogin = mongoose.model('FailedLogin', { 
    username: String, //username or email used to attempt login (might not set if username is not used)

    user_id: {type: mongoose.Schema.Types.ObjectId, ref: 'User'}, //might not set

    headers: mongoose.Schema.Types.Mixed, //express req object containing ip/headers, etc.
    
    //reason for the failurer 
    //* bad_username 
    //* bad_password
    //* no_password (password_has is not set for this user - 3d party only?)
    //* un_confirmed (email is not yset confirmed)
    //* inactive (user account is deactivated)
    code: String, 

    create_date: {type: Date, default: new Date() },
});

module.exports.mongo = models;

//const kitty = new Cat({ name: 'Zildjian' });
//kitty.save().then(() => console.log('meow'));

