/* 配置来自 config.js。留空即纯本地模式：所有刷题功能照常，只是不跨设备同步。 */
window.SYNC_CONFIG = window.SYNC_CONFIG || { url: "", publishableKey: "" };

window.CloudSync = (() => {
  const config = Object.assign({ url: "", publishableKey: "" }, window.SYNC_CONFIG);
  const enabled = Boolean(String(config.url).trim() && String(config.publishableKey).trim());
  const authKey = "ai-trainer-supabase-auth-v1";
  let session = loadSession();

  function captureRedirectSession() {
    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (!accessToken || !refreshToken) return false;
    saveSession({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: Number(hash.get("expires_in") || 3600),
      token_type: hash.get("token_type") || "bearer"
    });
    history.replaceState(null, "", location.pathname + location.search);
    return true;
  }

  function loadSession() {
    try { return JSON.parse(localStorage.getItem(authKey) || "null"); }
    catch { return null; }
  }

  function saveSession(value) {
    session = value;
    if (value) localStorage.setItem(authKey, JSON.stringify(value));
    else localStorage.removeItem(authKey);
  }

  async function request(path, options = {}, retry = true) {
    const headers = Object.assign({ apikey: config.publishableKey, "Content-Type": "application/json" }, options.headers || {});
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    let response;
    try {
      response = await fetch(`${config.url}${path}`, Object.assign({}, options, { headers }));
    } catch {
      throw new Error("CLOUD_UNREACHABLE");
    }
    if (response.status === 401 && retry && session?.refresh_token) {
      const refreshed = await refresh();
      if (refreshed) return request(path, options, false);
    }
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || `请求失败 (${response.status})`);
    return data;
  }

  async function sendLoginLink(email) {
    if (!enabled) throw new Error("当前是纯本地模式，未配置云同步");
    const redirect = `${location.origin}${location.pathname}`;
    return request(`/auth/v1/otp?redirect_to=${encodeURIComponent(redirect)}`, {
      method: "POST",
      body: JSON.stringify({ email, create_user: true })
    });
  }

  async function signInWithPassword(email, password) {
    if (!enabled) throw new Error("当前是纯本地模式，未配置云同步");
    const data = await request("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }, false);
    saveSession(data);
    return data.user || null;
  }

  async function setPassword(password) {
    if (!enabled) throw new Error("当前是纯本地模式，未配置云同步");
    if (!session?.access_token) throw new Error("请先通过邮件登录");
    return request("/auth/v1/user", {
      method: "PUT",
      body: JSON.stringify({ password })
    });
  }

  async function refresh() {
    if (!enabled) return false;
    if (!session?.refresh_token) return false;
    try {
      const data = await request("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: session.refresh_token }) }, false);
      saveSession(data); return true;
    } catch { saveSession(null); return false; }
  }

  async function getUser() {
    if (!enabled) return null;
    if (!session?.access_token) return null;
    try { return await request("/auth/v1/user"); }
    catch { return null; }
  }

  async function pull() {
    if (!enabled) return null;
    const user = await getUser();
    if (!user) return null;
    const rows = await request(`/rest/v1/user_progress?user_id=eq.${encodeURIComponent(user.id)}&select=progress,updated_at`);
    return rows?.[0]?.progress || null;
  }

  async function push(progress) {
    if (!enabled) return false;
    const user = await getUser();
    if (!user) throw new Error("尚未登录");
    await request("/rest/v1/user_progress?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: user.id, progress, updated_at: new Date().toISOString() })
    });
    return true;
  }

  async function ping() {
    if (!enabled) return { ok: false, host: "未配置云同步" };
    try {
      const response = await fetch(`${config.url}/auth/v1/health`, { method: "GET", headers: { apikey: config.publishableKey } });
      if (!response.ok) throw new Error(String(response.status));
      return { ok: true };
    } catch {
      return { ok: false, host: (() => { try { return new URL(config.url).host; } catch { return config.url; } })() };
    }
  }

  function signOut() { saveSession(null); }
  function isSignedIn() { return enabled && Boolean(session?.access_token); }
  if (enabled) captureRedirectSession();
  return { enabled, sendLoginLink, signInWithPassword, setPassword, getUser, pull, push, ping, signOut, isSignedIn };
})();
