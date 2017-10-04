'use strict';

//node
var fs        = require('fs');
var path      = require('path');

//contrib
var Sequelize = require('sequelize');

//mine
var config    = require('../config');

var basename  = path.basename(module.filename);

if(typeof config.db === 'string') {
    var sequelize = new Sequelize(config.db, {
        /*
        logging: function(str) {
            //ignore for now..
        }
        */
        logging: false
    });
} else {
    //assume object
    var sequelize = new Sequelize(config.db.database, config.db.username, config.db.password, config.db);
}
var db = {};

fs
  .readdirSync(__dirname)
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
