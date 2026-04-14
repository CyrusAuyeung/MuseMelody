export async function onRequestPost(context) {
  const formData = await context.request.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return Response.json({ detail: "missing file" }, { status: 400 });
  }

  return Response.json({
    filename: file.name || "uploaded-file",
    detected: [
      { midi: 60, duration: 1, beat: 0 },
      { midi: 62, duration: 1, beat: 1 },
      { midi: 64, duration: 1, beat: 2 },
      { midi: 67, duration: 1, beat: 3 },
      { midi: 69, duration: 2, beat: 4 }
    ],
    message: "当前为可运行占位 OMR 流程，请在此接入真实乐谱识别模型。"
  });
}
