const uploadStore = globalThis.__MUSE_SCORE_UPLOADS__ || new Map();
globalThis.__MUSE_SCORE_UPLOADS__ = uploadStore;

export async function onRequestGet(context) {
  const token = context.params.token;
  const item = uploadStore.get(token);

  if (!item) {
    return new Response("Not found", { status: 404 });
  }

  if (Date.now() - item.createdAt > 10 * 60 * 1000) {
    uploadStore.delete(token);
    return new Response("Expired", { status: 410 });
  }

  return new Response(item.bytes, {
    headers: {
      "content-type": item.type,
      "cache-control": "no-store"
    }
  });
}
