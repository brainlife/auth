'use strict';

//contrib
var express = require('express');
var router = express.Router();
var jwt = require('express-jwt');

//mine
var config = require('../config');

router.use('/', require('./root'));

if(config.auth.allow_signup !== false) {
    router.use('/signup', require('./signup'));
}
if(config.local) {
    router.use('/local', require('./local'));
}
if(config.ldap) {
    router.use('/ldap', require('./ldap'));
}
if(config.iucas) {
    router.use('/iucas', require('./iucas'));
}
if(config.x509) {
    router.use('/x509', require('./x509'));
}
if(config.git) {
    router.use('/git', require('./git'));
}

module.exports = router;
