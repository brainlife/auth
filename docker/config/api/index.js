const fs = require('fs');
const winston = require('winston');

const {
    SERVICE_AUTHORITY,
    AUTH_API_URL,
    REDIS_URL,
    RABBITMQ_URL,
    MONGO_URL,

    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_MAPS_API_KEY,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    ORCID_CLIENT_ID,
    ORCID_CLIENT_SECRET,
    GLOBUS_CLIENT_ID,
    GLOBUS_CLIENT_SECRET,
    OIDC_CLIENT_ID,
    OIDC_CLIENT_SECRET,
} = process.env;
const [API_HOST, API_PORT] = SERVICE_AUTHORITY.split(':');

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
    },
    iss: AUTH_API_URL,
    ttl: 24 * 3600 * 1000,
    public_key: fs.readFileSync(__dirname + '/auth.pub'),
    private_key: fs.readFileSync(__dirname + '/auth.key'),
    sign_opt: { algorithm: 'RS256' },
    settingsCallback: '/settings/account',
};

exports.redis = {
    url: REDIS_URL,
};

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
        url: RABBITMQ_URL,
    },
}

exports.mongodb = MONGO_URL;
exports.mongoose_debug = true;

exports.local = {
    email_confirmation: {
        subject: 'Brainlife.io Account Confirmation',
        from: 'brainlife <brlife@iu.edu>',  //iu mail server will reject if this is non-repliable address/
    },
    email_passreset: {
        subject: 'Brainlife.io Password Reset Instruction',
        from: 'brainlife <brlife@iu.edu>',  //iu mail server will reject if this is non-repliable address/
    },
    mailer: {
        host: 'localhost',
        port: 1025,
        // secure: true,
        // auth: {
        //     user: 'brlife',
        //     pass: 'This is our new password123',
        // },
    },
};

exports.geocode = {
    apiKey: GOOGLE_MAPS_API_KEY
}

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    exports.google = {
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        callback_url: `${AUTH_API_URL}/google/callback`,
    };
}

if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
    exports.github = {
    auto_register: true,
    client_id: GITHUB_CLIENT_ID,
    client_secret: GITHUB_CLIENT_SECRET,
    callback_url: `${AUTH_API_URL}/github/callback`,
    };
}

if (ORCID_CLIENT_ID && ORCID_CLIENT_SECRET) {
    exports.orcid = {
        auto_register: true,
        authorization_url: "https://orcid.org/oauth/authorize",
        token_url: "https://orcid.org/oauth/token",
        client_id: ORCID_CLIENT_ID,
        client_secret: ORCID_CLIENT_SECRET,
        callback_url: `${AUTH_API_URL}/orcid/callback`,
    };
}

//https://auth.globus.org/v2/web/developers
if (GLOBUS_CLIENT_ID && GLOBUS_CLIENT_SECRET) {
    exports.globus = {
        auto_register: true,
        client_id: GLOBUS_CLIENT_ID,
        client_secret: GLOBUS_CLIENT_SECRET,
        callback_url: `${AUTH_API_URL}/globus/callback`,
    };
}

if (OIDC_CLIENT_ID && OIDC_CLIENT_SECRET) {
    exports.oidc = {
        auto_register: true,
        issuer: "https://cilogon.org",
        authorization_url: "https://cilogon.org/authorize",
        token_url: "https://cilogon.org/oauth2/token",
        userinfo_url: "https://cilogon.org/oauth2/userinfo",
        callback_url: `${AUTH_API_URL}/oidc/callback`,
        //scope: "openid profile email org.cilogon.userinfo",
        client_id: OIDC_CLIENT_ID,
        client_secret: OIDC_CLIENT_SECRET,
        idplist: "https://cilogon.org/include/idplist.xml",
    };
}

exports.db = {
    dialect: "sqlite",
    storage: "/db/auth.sqlite",
    logging: false
}

exports.express = { host: API_HOST, port: API_PORT };

exports.logger = {
    winston: {
        requestWhitelist: [
            'url', /*'headers',*/ 'method',
            'httpVersion', 'originalUrl', 'query'
        ],
        transports: [
            new winston.transports.Console({
                timestamp: function () {
                    return new Date().toString();
                },
                level: 'debug',
                colorize: true,
                stderrLevels: ["error"],
            }),
        ]
    }
}