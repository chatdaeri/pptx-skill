#!/bin/bash
# pptx-skill 의존성 체크 스크립트
# Claude Code CLI / Claude Desktop 양쪽에서 동작

set -e

# ── 캐시: 24시간 이내 성공이면 즉시 skip (FORCE=1 이면 무시) ──
CACHE_DIR="$HOME/.cache/pptx-skill"
CACHE_FILE="$CACHE_DIR/deps-ok"
CACHE_TTL=86400  # 24h in seconds

if [ "$FORCE" != "1" ] && [ -f "$CACHE_FILE" ]; then
  # mtime of cache file
  if [ "$(uname)" = "Darwin" ]; then
    CACHE_MTIME=$(stat -f %m "$CACHE_FILE" 2>/dev/null || echo 0)
  else
    CACHE_MTIME=$(stat -c %Y "$CACHE_FILE" 2>/dev/null || echo 0)
  fi
  NOW=$(date +%s)
  AGE=$((NOW - CACHE_MTIME))
  if [ "$AGE" -lt "$CACHE_TTL" ]; then
    echo "=== pptx-skill 의존성 확인 ==="
    echo "캐시됨 (마지막 확인 ${AGE}초 전, <24h) — skip."
    echo "강제 재확인: FORCE=1 bash $0"
    exit 0
  fi
fi

# NODE_PATH 자동 감지 (환경별 대응)
if [ -z "$NODE_PATH" ]; then
  if [ -d "/opt/homebrew/lib/node_modules" ]; then
    export NODE_PATH="/opt/homebrew/lib/node_modules"
  elif [ -d "/usr/local/lib/node_modules" ]; then
    export NODE_PATH="/usr/local/lib/node_modules"
  else
    NPM_ROOT=$(npm root -g 2>/dev/null || echo "")
    if [ -n "$NPM_ROOT" ] && [ -d "$NPM_ROOT" ]; then
      export NODE_PATH="$NPM_ROOT"
    fi
  fi
fi

ERRORS=0

echo "=== pptx-skill 의존성 확인 ==="
echo ""

# --- Node.js ---
echo "[Node.js 패키지]"
for pkg in pptxgenjs playwright sharp; do
  if NODE_PATH="$NODE_PATH" node -e "require('$pkg')" 2>/dev/null; then
    echo "  $pkg: OK"
  else
    echo "  $pkg: MISSING → npm install -g $pkg"
    ERRORS=$((ERRORS + 1))
  fi
done

# --- Playwright 브라우저 ---
echo ""
echo "[Playwright 브라우저]"
CHROMIUM_DIR="$HOME/Library/Caches/ms-playwright"
if [ ! -d "$CHROMIUM_DIR" ]; then
  CHROMIUM_DIR="$HOME/.cache/ms-playwright"
fi
if ls "$CHROMIUM_DIR"/chromium-* 1>/dev/null 2>&1; then
  echo "  chromium: OK"
else
  echo "  chromium: MISSING → npx playwright install chromium"
  ERRORS=$((ERRORS + 1))
fi

# --- Python ---
echo ""
echo "[Python 패키지]"
if python3 -c "from PIL import Image" 2>/dev/null; then
  echo "  pillow: OK"
else
  echo "  pillow: MISSING → pip3 install pillow"
  ERRORS=$((ERRORS + 1))
fi

# --- 시스템 도구 ---
echo ""
echo "[시스템 도구]"

# soffice (LibreOffice) - 여러 경로 확인
SOFFICE=""
if command -v soffice &>/dev/null; then
  SOFFICE="soffice"
elif [ -x "/Applications/LibreOffice.app/Contents/MacOS/soffice" ]; then
  SOFFICE="/Applications/LibreOffice.app/Contents/MacOS/soffice"
fi
if [ -n "$SOFFICE" ]; then
  echo "  soffice (LibreOffice): OK ($SOFFICE)"
else
  echo "  soffice: MISSING → brew install --cask libreoffice"
  ERRORS=$((ERRORS + 1))
fi

# pdftoppm (Poppler)
if command -v pdftoppm &>/dev/null; then
  echo "  pdftoppm (Poppler): OK"
else
  echo "  pdftoppm: MISSING → brew install poppler"
  ERRORS=$((ERRORS + 1))
fi

# --- 결과 ---
echo ""
if [ $ERRORS -eq 0 ]; then
  echo "모든 의존성 OK. NODE_PATH=$NODE_PATH"
  # 캐시 업데이트
  mkdir -p "$CACHE_DIR" 2>/dev/null && touch "$CACHE_FILE" 2>/dev/null || true
  exit 0
else
  echo "누락된 의존성 ${ERRORS}개. 위 설치 명령을 실행하세요."
  # 캐시 제거 (에러 상태이므로)
  rm -f "$CACHE_FILE" 2>/dev/null || true
  exit 1
fi
