#!/bin/bash

docker exec -i -w /app/api brainlife_auth-api node <<EOF

const fs = require('fs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const uuid = require('node-uuid');
const amqp = require('amqp');
const os = require('os');
const bcrypt = require('bcryptjs');
const zxcvbn = require('zxcvbn');
const redis = require('redis');

const common = require('../api/common');

///////////////////////////////////////////////////////////////////////////////////////////////////
//
// user to reset
//
const username = "soichih";
//
//
///////////////////////////////////////////////////////////////////////////////////////////////////

async function reset() {
    await common.connectRedis();
    console.log("connected to redis");

    console.log("removing failed auth requests for", username)
    const fails = await common.redisClient.keys('auth.fail.'+username+'.*');
    console.dir(fails);
    for(const fail of fails) {
        console.log("removing", fail);
        await common.redisClient.del(fail);
    }

    console.log("done");
    await common.redisClient.quit();
}
reset();

EOF
