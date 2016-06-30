openssl genrsa -out auth.key 2048
openssl rsa -in auth.key -pubout > auth.pub
