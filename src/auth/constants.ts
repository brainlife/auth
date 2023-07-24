import * as fs from 'fs';

export const public_key =  fs.readFileSync('/home/ubuntu/auth-ts/src/auth/auth.pub');
export const private_key =  fs.readFileSync('/home/ubuntu/auth-ts/src/auth/auth.key');