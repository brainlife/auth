#!/usr/bin/env node
'use strict';

const fs = require('fs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const uuid = require('node-uuid');
const amqp = require('amqp');
const os = require('os');
const bcrypt = require('bcryptjs');
const zxcvbn = require('zxcvbn');
const redis = require('redis');

const config = require('../api/config');

const con = redis.createClient(config.redis.port, config.redis.server);
con.on('error', console.error);
con.on('ready', ()=>{ 
    console.log("connected to redis");

    const username = "MariamOluyadi";
    console.log("removing failed auth requests for", username)
    con.keys('auth.fail.'+username+'.*', (err, fails)=>{
            for(const fail of fails) {
                console.log("removing", fail);
                con.del(fail);
            }
    });
});
