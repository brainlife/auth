const request = require('supertest');
const app = require('../api/server').app;
const assert = require('assert');
const db = require('../api/models');
const config = require('../api/config');
const clone = require('clone');
const fs = require('fs');

const errorMessage = "Error: This is a top-10 common password - Add another word or two. Uncommon words are better.. Please choose a stronger password and try again.";
describe('Signup API', () => {
  before((done) => {
    // Connect to test database
    db.init(() => {
      // use config.mongodb as test database and change it if env is not test
      const dbString = process.env.NODE_ENV == "test" ? config.mongodb_test : config.mongodb;
      dbConnection = db.init(dbString, done);
      db.mongo.User.deleteMany({}, (err) => {
        if (err) return done(err);
        done();
      });
    });
  });

  after((done) => {
    // Disconnect from test database
    db.disconnect(done());
  });

  afterEach((done) => {
    //  Clear test database after test case
    db.mongo.User.deleteMany({}, (err) => {
      if (err) return done(err);
    });
    done();
  })

  it('should return error when username already exists', async () => {
    // Create a test user with a username test username
    const testUser = {
      username: 'testuser',
      email: 'testuser@example.com',
      password: 'password!@123',
    };
    // Save the test user to database
    const user = await db.mongo.User.create(testUser);
    // Make a POST request to signup API with the same username
    const response = await request(app)
      .post('/signup')
      .send({
        username: testUser.username,
        email: testUser.email,
        password: testUser.password,
      });
    assert.strictEqual(response.status, 500);
    assert.strictEqual(response.body.message,
      'The username you chose is already registered. If it is yours, please try signing in, or register with a different username.');
  });

  it('should return error for common password', async () => {
    // Make a POST request to signup API with a new username and email
    const response = await request(app)
      .post('/signup')
      .send({
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password',
      });
    assert.strictEqual(response.status, 500);
    assert.strictEqual(response.body.message, errorMessage);
  });

  it('Testing /setpass - should return error for top 10 common password', async () => {
    const response = await request(app)
      .post('/signup')
      .send({
        username: 'testuser',
        password: 'securepassword',
        email: 'testuser@example.com',
      });

    assert.strictEqual(response.status, 200);
    assert.ok(response.body.jwt);
    assert.ok(response.body.sub);

    const setpassResponse = await request(app)
      .put('/local/setpass')
      .set('Authorization', `Bearer ${response.body.jwt}`)
      .send({
        password_old: 'securepassword', // current password
        password: 'passwordLatest', // new password
      })
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .set('user.sub', response.body.sub);

    assert.strictEqual(setpassResponse.status, 200);
    assert.strictEqual(setpassResponse.body.status, 'ok');
    assert.strictEqual(setpassResponse.body.message, 'Password reset successfully.');
  });

  it('Testing /setpass ', async () => {
    const response = await request(app)
      .post('/signup')
      .send({
        username: 'testuser',
        password: 'securepassword',
        email: 'testuser@example.com',
      });

    assert.strictEqual(response.status, 200);
    assert.ok(response.body.jwt);
    assert.ok(response.body.sub);

    let user = {
      sub: response.body.sub
    }
    const setpassResponse = await request(app)
      .put('/local/setpass')
      .set('Authorization', `Bearer ${response.body.jwt}`)
      .send({
        password_old: 'securepassword', // current password
        password: 'password', // new password
      })
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .set('user.sub', response.body.sub);

    assert.strictEqual(setpassResponse.status, 500);
    assert.strictEqual(setpassResponse.body.message, errorMessage);
  });

});
