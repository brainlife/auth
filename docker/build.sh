tag=1.3.4

docker build -t soichih/sca-auth ..
if [ ! $? -eq 0 ]; then
    echo "failed to build"
    exit
fi
docker tag soichih/sca-auth soichih/sca-auth:$tag
docker push soichih/sca-auth:$tag
