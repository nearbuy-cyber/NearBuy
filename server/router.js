'use strict';
// Minimal route registry: route(method, path, options, handler).
const routes = [];

/**
 * options.auth: 'public' | 'session' (signed in, email may be unverified) | 'seller' (default: verified member of a seller)
 * options.perm: permission string checked on the server for every request (see ROLE_PERMISSIONS in auth.js)
 * options.raw: handler receives the unparsed body as ctx.raw (uploads)
 */
function route(method, path, options, handler) {
  if (typeof options === 'function') { handler = options; options = {}; }
  const keys = [];
  const pattern = new RegExp(`^${path.replace(/:([a-zA-Z_]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}$`);
  routes.push({ method, path, pattern, keys, options: { auth: 'seller', ...options }, handler });
}
function match(method, pathname) {
  let pathMatched = false;
  for (const r of routes) {
    const m = r.pattern.exec(pathname);
    if (!m) continue;
    pathMatched = true;
    if (r.method !== method) continue;
    const params = {};
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    return { route: r, params };
  }
  return { route: null, pathMatched };
}
const reply = {
  csv: (filename, body) => ({ __file: true, type: 'text/csv; charset=utf-8', filename, body }),
  pdf: (filename, body) => ({ __file: true, type: 'application/pdf', filename, body }),
  bytes: (type, body, cache) => ({ __file: true, type, body, inline: true, cache }),
  created: (payload) => ({ __status: 201, ...payload }),
};
module.exports = { route, match, reply, routes };
