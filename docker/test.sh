docker run \
    --name sca-auth1 \
    -v `pwd`/config:/app/api/config \
    -v `pwd`/db:/db \
    --rm -it soichih/sca-auth

