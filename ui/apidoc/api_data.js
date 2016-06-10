define({ "api": [
  {
    "type": "post",
    "url": "/local/auth",
    "title": "Perform authentication",
    "name": "LocalAuth",
    "description": "<p>Perform authentication using username(or email) and SCA password get JWT token.</p>",
    "group": "Local",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<p>Username or email address</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "password",
            "description": "<p>SCA local Password</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "Object",
            "optional": false,
            "field": "jwt",
            "description": "<p>JWT token</p>"
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "api/controllers/local.js",
    "groupTitle": "Local"
  },
  {
    "type": "post",
    "url": "/signup",
    "title": "Register new user",
    "name": "Signup",
    "description": "<p>Register new user with username and email</p>",
    "group": "Local",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<p>Username</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "password",
            "description": "<p>Password</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "email",
            "description": "<p>Email</p>"
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "api/controllers/signup.js",
    "groupTitle": "Local"
  },
  {
    "type": "get",
    "url": "/health",
    "title": "Get API status",
    "description": "<p>Get current API status</p>",
    "name": "GetHealth",
    "group": "System",
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "status",
            "description": "<p>'ok' or 'failed'</p>"
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "api/controllers/root.js",
    "groupTitle": "System"
  },
  {
    "type": "post",
    "url": "/refresh",
    "title": "Refresh JWT Token.",
    "description": "<p>JWT Token normally lasts for a few hours. Application should call this API periodically to get it refreshed before it expires.</p>",
    "name": "Refresh",
    "group": "User",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "authorization",
            "description": "<p>A valid JWT token (Bearer:)</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "Object",
            "optional": false,
            "field": "jwt",
            "description": "<p>New JWT token</p>"
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "api/controllers/root.js",
    "groupTitle": "User"
  },
  {
    "type": "get",
    "url": "/me",
    "title": "Get user details",
    "name": "SendEmailNotification",
    "description": "<p>Rreturns things that user might want to know about himself. password_hash will be set to true if the password is set, otherwise null</p>",
    "group": "User",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "authorization",
            "description": "<p>A valid JWT token &quot;Bearer: xxxxx&quot;</p>"
          }
        ]
      }
    },
    "success": {
      "examples": [
        {
          "title": "Success-Response:",
          "content": "HTTP/1.1 200 OK\n{\n    \"username\": \"hayashis\",\n    \"fullname\": \"Soichi Hayashi\",\n    \"email\": \"hayashis@iu.edu\",\n    \"email_confirmed\": true,\n    \"iucas\": \"hayashis\"\n}",
          "type": "json"
        }
      ]
    },
    "version": "0.0.0",
    "filename": "api/controllers/root.js",
    "groupTitle": "User"
  }
] });
