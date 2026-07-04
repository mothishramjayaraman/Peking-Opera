import crypto from "crypto"; // crypto utilities
import { promisify } from "util"; // 

// scrypt hashing algorithm.

const scrypt = promisify(crypto.scrypt);

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex"); // random salt
  const derivedKey = await scrypt(password, salt, 64); // hash password
  return salt + ":" + derivedKey.toString("hex"); // store salt + hash
}


export async function comparePasswords(provided, stored) {
  const [salt, key] = stored.split(":"); // extract salt & hash
  const derivedKey = await scrypt(provided, salt, 64); // hash input
  
  const keyBuffer = Buffer.from(key, "hex");
  
  if (keyBuffer.length !== derivedKey.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(keyBuffer, derivedKey); // compare securely
}
