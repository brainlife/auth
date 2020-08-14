[![Build Status](https://travis-ci.org/soichih/sca-auth.svg?branch=master)](https://travis-ci.org/soichih/sca-auth)
[![Coverage Status](https://coveralls.io/repos/github/soichih/sca-auth/badge.svg?branch=master)](https://coveralls.io/github/soichih/sca-auth?branch=master)

Generic authentication service that allows user to authenticate against variety of identity providers and issue JWT token. This service also provides role administration that can be used for authorization and group administrations.

Any services that then use authentication service's public key to validate the JWT token and do stateless authentication (and basic authorization through roles / groups)

For DB backend, it can use PostgreSQL, MySQL, MariaDB, or SQLite.

## Installation (pm2)

```
git clone git@github.com:brainlife/auth.git auth
cd auth && npm install
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
mkdir /etc/auth
cd /etc/auth
wget https://raw.githubusercontent.com/brainlife/auth/master/api/config/index.js.sample
cp index.js.sample index.js
```
And edit index.js. You need to point various paths to the right place. Just contact me if you aren't sure.

You also need to create public / prviate keys (see above for `openssl genrsa`)

Then, create auth container..

```
docker run \
    --restart=always \
    --name auth \
    -v /etc/auth:/app/api/config \
    -v /usr/local/data/auth:/db \
    -d soichih/auth
```

You need to expose your container's port 80 (for UI) and 8080 (for API) directly, or via web proxy like nginx. Please feel free to contact me if you aren't sure how to do that.

# APIDOC

Once you have your UI up, you can view the API doc at `/apidoc` sub directory. Or you can see our hosted version at `https://sca.iu.edu/auth/apidoc/`

