# Inspiration Muse / 灵感缪斯

一个“乐谱识别 -> 旋律分析 -> 即兴生成 -> MIDI 导出”的端到端项目雏形。

## 当前已完成

- 前端：`inspiration-muse.jsx`
  - 预设旋律、手动输入、键盘输入、图片上传入口
  - 调用后端生成即兴旋律
  - 可播放原旋律 / 即兴旋律 / 合奏
  - 导出合奏 MIDI
- 后端：`backend/app/main.py`
  - `POST /api/score/parse`：乐谱图片识别（可运行占位流程）
  - `POST /api/improv/generate`：旋律分析 + 风格化即兴生成
  - `POST /api/midi/export`：导出 MIDI 文件
  - `GET /health`：健康检查

## 运行后端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## 下一步（把占位能力升级为深度学习能力）

1. OMR 升级（CNN/CRNN/Transformer）
   - 在 `parse_staff_image_stub()` 接入真实模型推理，输出音高/时值/节拍。
2. 生成模型升级（LSTM/Transformer）
   - 将 `generate_improvisation()` 的规则模型替换为训练好的神经网络推理。
3. 合成升级
   - 在后端增加 MIDI->WAV（如 `fluidsynth`）接口，返回音频片段。
4. API 模型接入
   - 可扩展 `/api/improv/generate`，增加对外部音乐生成 API 的调用分支。
