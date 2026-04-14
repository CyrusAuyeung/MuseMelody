const uploadStore = globalThis.__MUSE_SCORE_UPLOADS__ || new Map();
globalThis.__MUSE_SCORE_UPLOADS__ = uploadStore;

function createToken() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function onRequestPost(context) {
  const formData = await context.request.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return Response.json({ detail: "missing file" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const token = createToken();
  uploadStore.set(token, {
    bytes: new Uint8Array(buffer),
    type: file.type || "image/png",
    name: file.name || "uploaded-image",
    createdAt: Date.now(),
  });

  const baseUrl = new URL(context.request.url).origin;
  return Response.json({
    token,
    url: `${baseUrl}/api/score/temp/${token}`,
  });
}
