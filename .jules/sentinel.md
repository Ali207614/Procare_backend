## 2024-05-08 - Secure Randomness for Sensitive Data
**Vulnerability:** Weak pseudo-random number generator (`Math.random()`) used for generating OTP codes and message IDs.
**Learning:** `Math.random()` generates predictable values, allowing potential attackers to guess OTPs and SMS validation IDs. This is a common pattern in TypeScript/Node.js codebases relying on frontend-equivalent APIs.
**Prevention:** Always use Node.js `crypto` module (`crypto.randomInt` or `crypto.randomBytes`) for cryptographically secure random number generation when dealing with authentication, session tokens, or OTP codes.
## 2026-05-12 - [Missing Authentication Rate Limiting]
**Vulnerability:** Public authentication endpoints (e.g. login, send-code, reset-password) lacked specific strict rate-limiting, making them susceptible to rapid brute-force or credential stuffing attacks. The standard public routes limiter only blocked at a very high general threshold.
**Learning:** Even if overall rate limiting exists, sensitive authentication flows require their own stricter isolated threshold to deter enumeration and brute-forcing while balancing UX (e.g. allowing NAT IPs).
**Prevention:** Apply a dedicated strict RateLimit middleware (e.g., `AuthRateLimiterMiddleware`) to all authentication-related endpoints explicitly via `consumer.apply().forRoutes(...)` in `AppModule`.
