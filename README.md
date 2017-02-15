[![Build Status](https://travis-ci.org/soichih/sca-auth.svg?branch=master)](https://travis-ci.org/soichih/sca-auth)
[![Coverage Status](https://coveralls.io/repos/github/soichih/sca-auth/badge.svg?branch=master)](https://coveralls.io/github/soichih/sca-auth?branch=master)

Generic authentication service that allow user to authenticate against variety of identity provider and issue JWT token. This service also provides role administration that can be used for authorization and group administrations.

Any services that then use authentication service's public key to validate the JWT token and do stateless authentication (and basic authorization through roles / groups)

For DB backend, it can use PostgreSQL, MySQL, MariaDB, or SQLite.

## Installation (pm2)

```
git clone git@github.com:soichih/sca-auth.git sca-auth
cd sca-auth && npm install
cd ui && npm install
```

You will need to create your configuration by copying `./api/config/index.js.sample` to `./api/config/index.js` (and edit the content)

You also need to create your public and private keys.

```
openssl genrsa -out auth.key 2048
chmod 600 auth.key
openssl rsa -in auth.key -pubout > auth.pub
```

## Installation (docker)

Create configuration file first

```
mkdir /etc/sca-auth
cd /etc/sca-auth
wget https://raw.githubusercontent.com/soichih/sca-auth/master/api/config/index.js.sample
cp index.js.sample index.js
```
And edit index.js. You need to point various paths to the right place. Just contact me if you aren't sure.

You also need to create public / prviate keys (see above for `openssl genrsa`)

Then, create sca-auth container..

```
docker run \
    --restart=always \
    --name sca-auth \
    -v /etc/sca-auth:/app/api/config \
    -v /usr/local/data/auth:/db \
    -d soichih/sca-auth
```

You need to expose your container's port 80 (for UI) and 8080 (for API) directly, or via web proxy like nginx. Please feel free to contact me if you aren't sure how to do that.

# APIDOC

Once you have your UI up, you can view the API doc at `/apidoc` sub directory. Or you can see our hosted version at `https://sca.iu.edu/auth/apidoc/`

# TODO

If a user has multiple account, trying to associate with same IUCAS account ends up with basically logging in as the user account that's already associated with the IU CAS account.

iucas/register_newuser. If the uid is already registered, instead of veto-ing, forward user to a special login page and once logged in successfully, associate the IUCAS IU to the user account

Make sure only root (or allowed group of users) can issue token via CLI

Allow admin to reset password via administration/users pagee
Allow user to reset his/her own password
Allow admin to remove account (what should happend to profile and cached profile on other services?)
Add event table logging all authentication related events (change password, etc..)

Don't let user disconnect account if there is only 1 account left that's associated with it

Implement password locking mechanism after repeated failed attempt (not necessary because we delay failed password re-try?)
