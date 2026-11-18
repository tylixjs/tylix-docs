# Middleware

Functions (req, res, next) that run around requests: logging, rate limits, headers, tenant lookup. Register one for every request with router.use(fn) in publicRoutes(), or pass it to a single route.

Command: `See logRequests.ts for an example.`
