## 2024-05-08 - Secure Randomness for Sensitive Data
**Vulnerability:** Weak pseudo-random number generator (`Math.random()`) used for generating OTP codes and message IDs.
**Learning:** `Math.random()` generates predictable values, allowing potential attackers to guess OTPs and SMS validation IDs. This is a common pattern in TypeScript/Node.js codebases relying on frontend-equivalent APIs.
**Prevention:** Always use Node.js `crypto` module (`crypto.randomInt` or `crypto.randomBytes`) for cryptographically secure random number generation when dealing with authentication, session tokens, or OTP codes.
