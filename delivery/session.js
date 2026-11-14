// Keeps a signed-in session working when the browser refuses cookies for an embedded page (hosted previews).
// The server only offers the token outside production; when it does not, this file does nothing.
const KEY = 'nb-session-fallback';
let memory = '';
const load = () => { try { return sessionStorage.getItem(KEY) || memory; } catch { return memory; } };
const save = (v) => { memory = v; try { if (v) sessionStorage.setItem(KEY, v); else sessionStorage.removeItem(KEY); } catch { /* storage blocked: kept in memory for this page */ } };
const sameOriginApi = (input) => { try { const u = new URL(typeof input === 'string' ? input : input.url || String(input), location.href); return u.origin === location.origin && u.pathname.startsWith('/api/'); } catch { return false; } };
function absorb(header) {
  const jar = new Map(load().split(';').map((x) => x.trim()).filter(Boolean).map((x) => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1)]; }));
  for (const part of header.split(';').map((x) => x.trim()).filter(Boolean)) { const i = part.indexOf('='); const name = part.slice(0, i); const value = part.slice(i + 1); if (value) jar.set(name, value); else jar.delete(name); }
  save([...jar].map(([k, v]) => `${k}=${v}`).join('; '));
}
/** Adds the session to a URL the browser requests by itself (images, live streams). */
export function withSession(url) {
  const token = load();
  return token ? `${url}${url.includes('?') ? '&' : '?'}_sid=${encodeURIComponent(token)}` : url;
}
if (!window.__nbSessionBridge) {
  window.__nbSessionBridge = true;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    if (!sameOriginApi(input)) return nativeFetch(input, init);
    const token = load();
    const given = init.headers || {};
    const headers = given instanceof Headers ? Object.fromEntries(given.entries()) : { ...given };
    if (token) headers['X-NearBuy-Session'] = token;
    const res = await nativeFetch(input, { ...init, headers });
    const got = res.headers.get('X-NearBuy-Session');
    if (got !== null && got !== '') absorb(got);
    return res;
  };
  const NativeES = window.EventSource;
  if (NativeES) window.EventSource = function EventSourceWithSession(url, opts) { return new NativeES(sameOriginApi(url) ? withSession(String(url)) : url, opts); };
}
