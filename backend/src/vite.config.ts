// STUB: real backend/vite.config.ts was missing from this checkout. This
// project actually runs frontend and backend as two independent dev servers
// (frontend on 5173 proxies /api to backend on 5001), so the Express+Vite
// middleware-mode integration in src/server/vite.ts is not exercised in that
// workflow — this empty config just satisfies the import so the server boots.
export default {};
