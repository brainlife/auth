tag=1.5.3

set -e
set -x

docker build -t soichih/auth ..
docker tag soichih/auth soichih/auth:$tag
docker push soichih/auth:$tag
