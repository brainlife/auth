#!/bin/bash

if [ ! -f auth.key ]; then
    openssl genrsa -out auth.key 2048
    chmod 600 auth.key
fi
if [ ! -f auth.pub ]; then
    openssl rsa -in auth.key -pubout > auth.pub
fi
