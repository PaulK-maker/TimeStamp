import api from "./api";

let cacheKey = null;
let loaded = false;
let user = null;
let error = null;
let inFlight = null;

export function resetMeCache() {
  cacheKey = null;
  loaded = false;
  user = null;
  error = null;
  inFlight = null;
}

export async function getMe({ cacheKey: nextCacheKey, forceRefresh = false } = {}) {
  if (nextCacheKey && cacheKey && nextCacheKey !== cacheKey) {
    resetMeCache();
  }

  if (nextCacheKey) cacheKey = nextCacheKey;

  if (!forceRefresh && loaded) {
    if (error) throw error;
    return user;
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await api.get("/auth/me");
      user = res.data?.user ?? null;
      error = null;
      loaded = true;
      return user;
    } catch (err) {
      user = null;
      error = err;
      loaded = true;
      throw err;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
