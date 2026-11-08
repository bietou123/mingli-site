#!/usr/bin/env bash
# ============================================
# 玄机阁 · 启动脚本（Linux / NAS）
# 访问 http://<ip>:8090
# ============================================
set -e
cd "$(dirname "$0")/backend"

if ! python3 -c "import fastapi, uvicorn" 2>/dev/null; then
  echo "[首次运行] 安装依赖 ..."
  python3 -m pip install -r requirements.txt
fi

echo "玄机阁启动中 -> http://0.0.0.0:8090 （Ctrl+C 停止）"
exec python3 -m uvicorn main:app --host 0.0.0.0 --port 8090
