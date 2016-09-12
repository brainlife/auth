'use strict';

//contrib
var Sequelize = require('sequelize');
//var JsonField = require('sequelize-json');
var bcrypt = require('bcrypt');
var winston = require('winston');

//mine
var config = require('../config');
var logger = new winston.Logger(config.logger.winston);

module.exports = function(sequelize, DataTypes) {
    return sequelize.define('Group', {
        name: Sequelize.STRING,
        desc: Sequelize.TEXT,
        active: { type: Sequelize.BOOLEAN, defaultValue: true }
    }, {
        classMethods: {
        },
        instanceMethods: {
        }
    });
}
