// Super-admin email — hardcoded constant. Only this email (when
// authenticated with role=ADMIN) can use the AI Dev Agent.
//
// WHY A SEPARATE FILE:
//   admin-view.tsx is a Client Component → anything it imports gets
//   bundled for the browser. ai-agent.ts imports `child_process`,
//   `fs`, `db` (server-only Node APIs) → if admin-view imported
//   SUPER_ADMIN_EMAIL from ai-agent.ts, Next.js would try to bundle
//   those Node APIs into the client → "Module not found: child_process".
//
//   So SUPER_ADMIN_EMAIL lives here in a tiny constant-only file with
//   zero server-side imports. Both client (admin-view) and server
//   (ai-agent, api/admin/ai-agent/route) import from here — safe.
export const SUPER_ADMIN_EMAIL = 'buikhanh57@gmail.com'
