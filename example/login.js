'use strict';

var request = require('request');

var sca = "https://test.sca.iu.edu/api";

//register new user
//using SCA local username and password
request.post({
    url: sca+"/auth/local/auth", json: true, 
    body: {
        username: "user5",
        password: "password123"
    }
}, function(err, res, body) {
    if(err) throw err;
    console.dir(body);
});
