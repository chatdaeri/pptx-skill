#!/bin/bash
# HTML 슬라이드 변환 전 검증 스크립트
# <div>나 <td> 안에 직접 텍스트가 있으면 PPTX 변환 시 누락되므로 경고

if [ $# -eq 0 ]; then
  echo "Usage: validate-html.sh <html-file-or-directory>"
  exit 1
fi

ERRORS=0
WARNINGS=0

validate_file() {
  local file="$1"
  local fname=$(basename "$file")

  # 1. body 크기 확인 (720pt x 405pt)
  if ! grep -q "720pt" "$file" 2>/dev/null; then
    echo "  WARNING [$fname]: body width가 720pt가 아닐 수 있음"
    WARNINGS=$((WARNINGS + 1))
  fi
  if ! grep -q "405pt" "$file" 2>/dev/null; then
    echo "  WARNING [$fname]: body height가 405pt가 아닐 수 있음"
    WARNINGS=$((WARNINGS + 1))
  fi

  # 2. <td> 또는 <th> 안에 <p> 없이 직접 텍스트가 있는 패턴 감지
  # 패턴: <td...>텍스트</td> (중간에 <p>가 없는 경우)
  bare_td=$(grep -cE '<t[dh][^>]*>[^<]+</t[dh]>' "$file" 2>/dev/null || true)
  bare_td=${bare_td:-0}
  bare_td=$(echo "$bare_td" | tr -d '[:space:]')
  if [ "$bare_td" -gt 0 ] 2>/dev/null; then
    echo "  ERROR [$fname]: <td>/<th> 안에 <p> 태그 없이 직접 텍스트 ${bare_td}건 → PPTX에서 누락됨"
    ERRORS=$((ERRORS + bare_td))
  fi

  # 3. CSS gradient 사용 감지 (background에서만 문제, clip-path용은 제외)
  real_gradient=$(grep -cE 'background[^:]*:.*gradient' "$file" 2>/dev/null || true)
  real_gradient=${real_gradient:-0}
  real_gradient=$(echo "$real_gradient" | tr -d '[:space:]')
  if [ "$real_gradient" -gt 0 ] 2>/dev/null; then
    echo "  ERROR [$fname]: CSS gradient ${real_gradient}건 → PPTX에서 변환 안됨. PNG로 대체 필요"
    ERRORS=$((ERRORS + real_gradient))
  fi

  # 4. # 포함된 색상이 PptxGenJS 코드에 있는지 (변환 스크립트용)
  # HTML CSS에서는 #이 정상이므로 이건 참고만

  if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "  OK [$fname]"
  fi
}

echo "=== HTML 슬라이드 검증 ==="

if [ -d "$1" ]; then
  for f in "$1"/*.html; do
    [ -f "$f" ] && validate_file "$f"
  done
else
  validate_file "$1"
fi

echo ""
if [ $ERRORS -gt 0 ]; then
  echo "ERROR ${ERRORS}건 발견. 수정 후 변환하세요."
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo "WARNING ${WARNINGS}건. 확인 권장."
  exit 0
else
  echo "모든 검증 통과."
  exit 0
fi
