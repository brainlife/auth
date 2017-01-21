docker rm -f sca-auth1
docker run \
    --restart=always \
    --net mca \
    --name sca-auth1 \
    -v `pwd`/config:/app/api/config \
    -v `pwd`/db:/db \
    -p 20080:80 \
    -p 28080:8080 \
    -d soichih/sca-auth

