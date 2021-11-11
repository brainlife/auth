'use strict';

const express = require('express');
const router = express.Router();
const config = require('../config');

router.use('/', require('./root'));

if(config.auth.allow_signup !== false) router.use('/signup', require('./signup'));
if(config.local) router.use('/local', require('./local'));
if(config.ldap) router.use('/ldap', require('./ldap'));
if(config.iucas) router.use('/iucas', require('./iucas'));
if(config.x509) router.use('/x509', require('./x509'));
if(config.github) router.use('/github', require('./github'));
if(config.google) router.use('/google', require('./google'));
if(config.facebook) router.use('/facebook', require('./facebook'));
if(config.oidc) router.use('/oidc', require('./oidc'));
if(config.orcid) router.use('/orcid', require('./orcid'));
if(config.globus) router.use('/globus', require('./globus'));

module.exports = router;
