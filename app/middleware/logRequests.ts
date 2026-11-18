import type { TylixRequest, TylixResponse } from '@tylix/core'

// Logs every request with its status and duration:
//   GET /api/posts 200 4ms
// Register it in app/routes/web.ts, inside publicRoutes():
//   router.use(logRequests)
export async function logRequests(req: TylixRequest, res: TylixResponse, next: () => Promise<void>) {
  const started = performance.now()
  await next()
  const ms = Math.round(performance.now() - started)
  console.log(`${req.method} ${String(req.url).split('?')[0]} ${res.statusCode} ${ms}ms`)
}
