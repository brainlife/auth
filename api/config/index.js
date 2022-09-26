const fs = require('fs');

exports.auth = {

    default: {
        scopes: {
            brainlife: ["user"],
        },

        profile: {
            public: {},
            private: {
                notification: {
                    newsletter_general: true,
                },
            },
        },
        ext: {},
    },

    //isser to use for generated jwt token
    iss: "http://localhost/auth",
    ttl: 24*3600*1000*7, //time to live

    public_key: fs.readFileSync(__dirname+'/auth.pub'),
    private_key: fs.readFileSync(__dirname+'/auth.key'),

    //option for jwt.sign
    sign_opt: {algorithm: 'RS256'},

    //allow_signup: false, //prevent user from signing in (set false if not using local auth)

    //URL to redirect in case there is no other place to direct to
    settingsCallback: "http://localhost:8080/settings/account",

    //auth service periodically geocode new users's institutions name
    //so we can place them on the map
    /*
    geocode: {
        cacheFile: "/tmp/geocode.cache.json",

        //sent to NodeGeocoder
        options: {
            provider: 'google',
            apiKey: fs.readFileSync(__dirname+'/geocode.apikey'),
        }
    },
    */
};

exports.redis = { url: "redis://brainlife_redis_1" }

//used by profile/poscount api to group variuos positions entered by users into
//distinct position groups using regex..
//first match is used for the group (it's stored in dict.. so no guratenee of ordering)
exports.positionGroups = {
    "PhD Student": /\s(phd|doctoral|grad|graduate)+( candidate| student)/,
    "Faculty": /prof|senior|pi|teacher|scholar|lec|advisor|inst|chair|scient|direc|invest/,
    "Postdoctoral Researcher": /^(research)|^(post)|(phd)/,
    "Research Assistant": /(research)[^\s]*( assistant| associate | coordinator) |(intern)|\bra/,
    "High School Student": /school/,
    "Clinician": /(logist)|(clin)|(neuro)|(chief)|(cal)|\b(md)|(physic)/,
    "Undergraduate Student": /undergrad|\bteaching assistant/,
    "Masters Student": /masters|phil|mtech|msc/,
    "Industry": /software|product|manager|owner|developer|des|engineer/,
    "Student (unspecified)": /student/,
}

exports.event = {
    amqp: {
        url: "amqp://guest:guest@brainlife_rabbitmq_1:5672/brainlife"
    },
}

//for user/pass login (you  should use either local, or ldap - but not both)
exports.local = {
    //url base for callbacks only used if req.header.referer is not set (like via cli)
    url: 'http://localhost:/auth', 
    
    //comment this out if you don't want to confirm email
    /*
    email_confirmation: {
        subject: 'Account Confirmation for dev1',
        from: 'brainlife.io <brlife@iu.edu>',  //iu mail server will reject if this is non-repliable address/
    },
    email_passreset: {
        subject: 'Password reset instruction for dev1',
        from: 'brainlife.io <brlife@iu.edu>',  //iu mail server will reject if this is non-repliable address/
    },

    //nodemailer config
    mailer: {
        host: 'mail-relay.iu.edu',
        secure: true,
        auth: {
            user: 'hayashis',
            pass: fs.readFileSync(__dirname+'/smtp.password', {encoding: 'ascii'}).trim(),
        }
    }
    */
};

exports.mongodb = "mongodb://brainlife_mongodb_1/auth";
exports.mongoose_debug = true;

exports.express = {
    host: "0.0.0.0",
    port: 8080,
};



