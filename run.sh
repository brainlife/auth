#!/bin/bash

(
	#start the api
	cd /app
	pm2 start ./api/auth.js --attach --watch --ignore-watch ui
)
