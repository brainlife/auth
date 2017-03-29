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
if(config.github) {
    router.use('/github', require('./github'));
}
if(config.google) {
    router.use('/google', require('./google'));
}
if(config.facebook) {
    router.use('/facebook', require('./facebook'));
}
if(config.oidc) {
    router.use('/oidc', require('./oidc'));
}

module.exports = router;
