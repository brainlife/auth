#!/bin/bash

(
	#make sure we have everything we need in config dir
	cd /app/api/config

	if [ ! -f auth.key ]; then
		echo "auth.key missing.. creating"
		openssl genrsa -out auth.key 2048
		chmod 600 auth.key
		openssl rsa -in auth.key -pubout > auth.pub	
	fi
)

(
	#start the api
	cd /app
	ls /app/api/config
	pm2 start ./api/auth.js --attach --watch
)
