import {
  fetchProcessSnapshots,
  type ProcessSnapshot,
} from "./process-snapshot";

const CACHE_TTL_MS = 5_000;

type ProcessCache = {
  data: ProcessSnapshot[] | null;
  timestamp: number;
  inflight: Promise<ProcessSnapshot[]> | null;
};

const globalState = globalThis as typeof globalThis & {
  __bgrProcessCache?: ProcessCache;
};

const cache =
  globalState.__bgrProcessCache ??
  (globalState.__bgrProcessCache = {
    data: null,
    timestamp: 0,
    inflight: null,
  });

function refreshSnapshots(): Promise<ProcessSnapshot[]> {
  if (cache.inflight) return cache.inflight;

  cache.inflight = fetchProcessSnapshots()
    .then((data) => {
      cache.data = data;
      cache.timestamp = Date.now();
      return data;
    })
    .finally(() => {
      cache.inflight = null;
    });

  return cache.inflight;
}

export async function getProcessSnapshots(options?: {
  fresh?: boolean;
}): Promise<ProcessSnapshot[]> {
  const fresh = options?.fresh === true;
  if (!fresh && cache.data && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return cache.data;
  }

  try {
    return await refreshSnapshots();
  } catch (error) {
    if (cache.data) return cache.data;
    throw error;
  }
}
