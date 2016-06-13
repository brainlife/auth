#script used by travis to setup testing environment
#invoked via .travis.yml

mkdir -p api/config

if [ ! -f api/config/auth.key ];
then
    echo "creating auth.key / auth.pub"
    (
    cd api/config
    ./genkey.sh
    )
fi

if [ ! -f api/config/index.js ];
then
    echo "installing test config/index.js"
    cp api/config/index.js.sample api/config/index.js 
fi
