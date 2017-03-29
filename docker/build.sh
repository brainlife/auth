docker build -t soichih/sca-auth ..
if [ ! $? -eq 0 ]; then
    echo "failed to build"
    exit
fi
docker tag soichih/sca-auth soichih/sca-auth:1.0.1
docker push soichih/sca-auth
