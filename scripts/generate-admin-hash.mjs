import { createHash, pbkdf2Sync, randomBytes } from "node:crypto";

function fail(message) {
  console.error(message);
  process.exit(1);
}

const password = process.argv[2];

if (!password) {
  fail("Usage: npm run hash:admin -- <password>");
}

const salt = randomBytes(16).toString("base64url");
const hash = pbkdf2Sync(password, salt, 210000, 32, "sha256").toString("base64url");
const ipHash = createHash("sha256").update("example").digest("base64url");

console.log(JSON.stringify({
  ADMIN_PASSWORD_SALT: salt,
  ADMIN_PASSWORD_HASH: hash,
  JWT_SECRET_EXAMPLE: randomBytes(32).toString("base64url"),
  IP_HASH_EXAMPLE: ipHash
}, null, 2));

