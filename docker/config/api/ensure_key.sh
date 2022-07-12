#!/bin/bash

if [ ! -f config/auth.key ]; then
    openssl genrsa -out config/auth.key 2048
    chmod 600 config/auth.key
fi
if [ ! -f config/auth.pub ]; then
    openssl rsa -in config/auth.key -pubout > config/auth.pub
fi
