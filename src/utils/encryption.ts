/**
 * @description uses crypto-js to decrypt sensitive data, such as passwords, using the encryption key
 *
 * @exports decryptData
 * @exports encryptData
 */
import CryptoJS, { AES } from "crypto-js";

/**
 * @description uses crypto-js to decrypt sensitive data, such as passwords
 * @param {string} data - the data to be encrypted
 * @returns {string} - the encrypted data
 *
 * @author Austin Howard
 * @version 1.0.0
 * @since 1.0.0
 * @lastmodified 2024-04-08 13:05:16
 *
 * @example
 * encryptData('sensitive data', 'key');
 * // returns 'encrypted data'
 * @see https://www.npmjs.com/package/crypto-js
 * @see https://www.npmjs.com/package/crypto-js#usage
 * @todo write tests
 */
const decryptData = (data: string): string => {
  return AES.decrypt(data, process.env.ENCRYPTION_KEY!).toString(CryptoJS.enc.Utf8);
};

/**
 * @description uses crypto-js to encrypt sensitive data, such as passwords
 * @param {string} data - the data to be encrypted
 * @returns {string} - the encrypted data
 *
 * @author Austin Howard
 * @version 1.0.0
 * @since 1.0.0
 * @lastmodified 2024-04-08 13:05:16
 *
 * @example
 * encryptData('sensitive data', 'key');
 * // returns 'encrypted data'
 * @see https://www.npmjs.com/package/crypto-js
 * @see https://www.npmjs.com/package/crypto-js#usage
 * @todo write tests
 */
const encryptData = (data: string): string => {
  const ciphertext = AES.encrypt(data, process.env.ENCRYPTION_KEY!).toString();
  return ciphertext;
};

export { decryptData, encryptData };
