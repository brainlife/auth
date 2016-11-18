#script used by travis to setup testing environment
#invoked via .travis.yml

mkdir -p api/config

if [ ! -f api/config/auth.key ]; then
    echo "creating auth.key / auth.pub"
    (
    cd api/config
    ./genkey.sh
    )
fi

echo "point 1"
if [ ! -f api/config/test.jwt ]; then
    echo "creating test.jwt"
    ./bin/auth.js issue --scopes '{ "sca": ["user"] }' --sub 'test_service' --out test.jwt
fi

if [ ! -f api/config/index.js ]; then
    echo "installing test config/index.js"
    cp api/config/index.js.sample api/config/index.js 
fi

if [ ! -f api/config/ldap.password ]; then
    echo "testpass" > api/config/ldap.password
fi


