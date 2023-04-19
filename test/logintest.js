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
      // Clear test database
      dbConnection = db.init(config.mongodb_test, done);
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

  afterEach((done)=>{
    //  Clear test database after test case
    db.mongo.User.deleteMany({}, (err) => {
      if (err) return done(err);
    });
    done();
  })

  it('should return error when username already exists', (done) => {
    // Create a test user with a username test username
    let testUser = {
      username: 'testuser',
      email: 'testuser@example.com',
      password: 'password!@123',
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
        assert.equal(res.body.message,errorMessage)
        done();
      });
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

  console.log(response.body.jwt);

  let user = {
    sub: response.body.sub
  }
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

  console.log(response.body.jwt);

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
