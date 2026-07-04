import crypto from "crypto";

const SESSION_SECRET = process.env.SESSION_SECRET || "default_insecure_secret_for_development_only";

/**
 * Signs a user ID with an HMAC signature.
 * @param {string|number} userId 
 * @returns {string} The signed session string
 */
export function signSession(userId) {
  const idStr = String(userId);
  const hmac = crypto.createHmac("sha256", SESSION_SECRET);
  hmac.update(idStr);
  const signature = hmac.digest("hex");
  return `${idStr}.${signature}`;
}

/**
 * Verifies a signed session string and extracts the user ID.
 * @param {string} cookieValue 
 * @returns {string|null} The verified user ID, or null if invalid
 */
export function verifySession(cookieValue) {
  if (!cookieValue || typeof cookieValue !== "string") return null;
  
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;
  
  const [userId, signature] = parts;
  
  const hmac = crypto.createHmac("sha256", SESSION_SECRET);
  hmac.update(userId);
  const expectedSignature = hmac.digest("hex");
  
  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  
  if (sigBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;
  
  return userId;
}
