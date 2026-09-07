import { Algorithm, hash } from "@node-rs/argon2";

const password = process.argv[2];

if (!password) {
  console.error("Usage: npm run hash-password -- <password>");
  process.exit(1);
}

const passwordHash = await hash(password, {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
});

console.log(passwordHash);
