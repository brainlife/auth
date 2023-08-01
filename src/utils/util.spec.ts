import {
  signJWT,
  hashPassword,
  checkPassword,
  createmailTransport,
} from './common.utils';
import { public_key } from '../auth/constants';
import * as jwt from 'jsonwebtoken';

describe('UtilTests', () => {
  describe('signJWT', () => {
    it('should return a signed JWT', () => {
      const payload = {
        username: 'test',
        sub: 12,
        role: 'test',
      };
      const token = signJWT(payload);
      const decoded = jwt.verify(token, public_key);
      expect(decoded).toEqual(expect.objectContaining(payload)); // check if the decoded token is equal to the payload
    });
  });

  describe('hashPassword', () => {
    it('should return an error for common password', () => {
      const password = 'test';
      const hashedPassword = hashPassword(password);
      // Error: This is a top-10 common password - Add another word or two. Uncommon words are better.. Please choose a stronger password and try again.
      expect(hashedPassword).toEqual({
        message:
          'This is a top-100 common password - Add another word or two. Uncommon words are better.',
      }); // check if the hashed password is not equal to the password
      expect(hashedPassword).not.toEqual(password); // check if the hashed password is not equal to the password
    });

    it('should return a hashed password', () => {
      const password = 'test@123TryAgain';
      const hashedPassword = hashPassword(password);
      expect(hashedPassword).not.toEqual(password); // check if the hashed password is not equal to the password
    });
  });

  describe('checkPassword', () => {
    it('should return true for a valid password', () => {
      const password = 'test@123TryAgain';
      const hashedPassword: string = hashPassword(password);
      const isValid = checkPassword(password, hashedPassword);
      expect(isValid).toEqual(true); // check if the password is valid
    });

    it('should return false for an invalid password', () => {
      const password = 'test@123TryAgain';
      const hashedPassword: string = hashPassword(password);
      const isValid = checkPassword(password + 'incorrect', hashedPassword);
      expect(isValid).toEqual(false);
    });
  });

  describe('createmailTransport', () => {
    it('should return a mail transport object', () => {
      const mailTransport = createmailTransport();
      expect(mailTransport).not.toBeNull(); // check if the mail transport object is not null
    });
  });

  //Tested the below function manually with a valid email address and MailHog

  // describe('sendEmail', () => {
  //     it('should return a mail transport object', async () => {
  //         const to = "dheerajbhatia2010@gmail.com"
  //         const from = "dheerajb@buffalo.edy"
  //         const subject = "test";
  //         const text = "test";
  //         const mailTransport = createmailTransport();
  //         const info = await sendEmail(to, from, subject, text);
  //         expect(info).not.toBeNull(); // check if the mail transport object is not null
  //     });
  // });

  // Todo RabbitMq and Redis tests as a reciever and sender
});
