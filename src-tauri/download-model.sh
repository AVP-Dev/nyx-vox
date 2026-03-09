#!/bin/bash
# Download Whisper medium model for offline transcription (~1.5 GB)
# Run once from the src-tauri directory: bash download-model.sh

set -e
MODEL_DIR="$(dirname "$0")/models"
MODEL_PATH="$MODEL_DIR/ggml-medium.bin"

mkdir -p "$MODEL_DIR"

if [ -f "$MODEL_PATH" ]; then
    echo "✅ Model already exists: $MODEL_PATH"
    exit 0
fi

echo "⬇️  Downloading ggml-medium.bin (~1.5 GB)..."
curl -L \
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin" \
  -o "$MODEL_PATH" \
  --progress-bar

echo "✅ Done! Model saved to: $MODEL_PATH"
