const request = require('supertest');
const app = require('../api/server').app;
const assert = require('assert');
var db = require('../api/models');
var config = require('../api/config');
var clone = require('clone');

describe('Signup API', () => {
  before((done) => {
    // Connect to test database
    db.init(() => {
      // Clear test database
      dbConnection = db.init(config.mongodb_test, done);
      db.mongo.User.deleteMany({}, (err) => {
        if (err) return done(err);
        done();
      });
    });
  });

  after((done) => {
     // Clear test database after test case
     db.mongo.User.deleteMany({}, (err) => {
      if (err) return done(err);
    });
    // Disconnect from test database
    db.disconnect(done());
  });

  it('should return error when username already exists', (done) => {
    // Create a test user with a username test username
    var testUser = {
      username: 'testuser',
      email: 'testuser@example.com',
      password: 'password',
    };
    db.mongo.User.create(testUser, (err, user) => {
      if (err) return done(err);
      // Make a POST request to signup API with the same username
      request(app)
        .post('/signup')
        .send({
          username: 'testuser',
          email: 'newuser@example.com',
          password: 'Testpassword',
        })
        .expect(500)
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.body.message, 
            'The username you chose is already registered. If it is yours, please try signing in, or register with a different username.');
          done();
        });
    });
  });

  it('should return error for common password', (done) => {
    // Make a POST request to signup API with a new username and email
    request(app)
      .post('/signup')
      .send({
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password',
      })
      .expect(500)
      .end((err, res) => {
        if (err) return done(err);
        assert.equal(res.body.message,"Error: This is a top-10 common password - Add another word or two. Uncommon words are better.. Please choose a stronger password and try again.")
        done();
      });
  });

  
});
