#DEBUG=auth:* env=dev PORT=12000 nodemon -i node_modules ./index.js

pm2 delete auth
pm2 start auth.js --name sca-auth --watch --ignore-watch="\.log$ test .sh$ pub"
pm2 save
 
#pm2 logs auth
