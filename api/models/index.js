//node

//contrib

//mine
let config    = require('../config');

///////////////////////////////////////////////////////////////////////////////////////////////////
// 
// deprecated
//
var Sequelize = require('sequelize');
let fs        = require('fs');
let path      = require('path');
var basename  = path.basename(module.filename);
if(typeof config.db === 'string') {
    var sequelize = new Sequelize(config.db, { logging: false });
} else {
    //assume object
    var sequelize = new Sequelize(config.db.database, config.db.username, config.db.password, config.db);
}
var db = {};

fs.readdirSync(__dirname)
  .filter(function(file) {
    return (file.indexOf('.') !== 0) && (file !== basename);
  })
  .forEach(function(file) {
    if (file.slice(-3) !== '.js') return;
    var model = sequelize['import'](path.join(__dirname, file));
    db[model.name] = model;
  });

//I am not sure what this is for, but it's from the sequelize doc
Object.keys(db).forEach(function(modelName) {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

//relationships
db.User.belongsToMany(db.Group, {as: 'AdminGroups', through: 'GroupAdmins'});
db.Group.belongsToMany(db.User, {as: 'Admins', through: 'GroupAdmins'});
db.User.belongsToMany(db.Group, {as: 'MemberGroups', through: 'GroupMembers'});
db.Group.belongsToMany(db.User, {as: 'Members', through: 'GroupMembers'});

module.exports = db;


///////////////////////////////////////////////////////////////////////////////////////////////////
//
// mongoose
//
let models = {};

const mongoose = require('mongoose');
if(config.mongoose_debug) mongoose.set("debug", true);

models.connection = mongoose.connect(config.mongodb, {useNewUrlParser: true});

models.User = mongoose.model('User', { 
    sub: {type: Number, index: true }, //old "id"

    username: { type: String, unique: true },

    //auth profile
    fullname: String,
    email: { type: String, unique: true },
    email_confirmed: { type: Boolean, default: false},
    email_confirmation_token: String,

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
    id: {type: Number, index: true }, 

    name: String,
    desc: String,

    admins: [ {type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true} ],
    members: [ {type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true} ],

    active: { type: Boolean, default: true },

    create_date: {type: Date, default: new Date() },
});

module.exports.mongo = models;

//const kitty = new Cat({ name: 'Zildjian' });
//kitty.save().then(() => console.log('meow'));

