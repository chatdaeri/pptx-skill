# pptx-skill

최적화된 PowerPoint 생성 스킬. HTML을 편집 가능한 네이티브 PPTX로 변환하거나, 텍스트 요청 + 참고자료로부터 HTML을 생성한 뒤 PPTX로 만든다. **차트와 테이블은 항상 PptxGenJS 네이티브(`addChart`/`addTable`)로 변환**되어 PowerPoint에서 바로 편집할 수 있다.

Claude Code CLI와 Claude Desktop 양쪽에서 동작하며, 스킬 디렉토리 경로는 자동 감지된다.

---

## 주요 특징

- **두 가지 입력 경로**
  - **Path A**: HTML이 이미 있음 → 린트 → 네이티브 변환 → PPTX
  - **Path B**: 텍스트 요청 + 참고자료(가이드라인/PDF) → HTML 생성 → PPTX
- **네이티브 차트/테이블 강제** — HTML `<table>`이나 수동 `<div>` 막대 차트를 자동 감지해 `addChart`/`addTable`로 교체. PPT에서 데이터·색상 수정 가능.
- **사전 린트(`lint-html.cjs`)** — Chromium을 1회만 기동해 모든 슬라이드 규칙 위반을 한 번에 리포트. 변환 재시도 루프 제거.
- **공유 Chromium 브라우저** — `convert.cjs`에서 브라우저를 1회만 기동하고 모든 `html2pptx()` 호출에 재사용 (10장 기준 10~15초 절감).
- **LibreOffice pre-warm + 백그라운드 썸네일** — 변환과 썸네일 생성을 병렬 처리.
- **Builder Agent 병렬화** — 콘텐츠 양에 따라 1~4개의 Builder Agent를 병렬 실행.
- **양쪽 환경 경로 자동 감지** — `$HOME/.claude/skills/pptx-skill`(Claude Code CLI)과 `/mnt/skills/user/pptx-skill`(Claude Desktop)을 자동 해결.

---

## 설치

### 1. 스킬 배치

**Claude Code CLI**:
```bash
git clone https://github.com/chatdaeri/pptx-skill.git ~/.claude/skills/pptx-skill
```

**Claude Desktop**: 스킬 패키지를 업로드하면 `/mnt/skills/user/pptx-skill`에 자동 배치된다.

### 2. 의존성 설치

#### Node.js (글로벌)
```bash
npm install -g pptxgenjs playwright sharp
npx playwright install chromium
```

#### Python
```bash
pip install pillow
```

#### 시스템 패키지
- **LibreOffice** (`soffice`) — PPTX → PDF 변환
- **Poppler** (`pdftoppm`) — PDF → 이미지

macOS:
```bash
brew install --cask libreoffice
brew install poppler
```

Linux (Debian/Ubuntu):
```bash
sudo apt install libreoffice poppler-utils
```

### 3. 의존성 확인

```bash
bash ~/.claude/skills/pptx-skill/scripts/check-deps.sh
```
24시간 이내 성공 이력이 있으면 자동으로 skip. 강제 재확인은 `FORCE=1 bash ...`.

---

## 사용법

이 스킬은 Claude가 자동으로 호출하는 워크플로 스킬이다. 사용자는 아래와 같은 요청을 하면 Claude가 Path A 또는 Path B로 분기해 실행한다.

### Path A — HTML → PPTX

```
slides/ 폴더에 HTML이 있어. PPTX로 변환해줘.
```

Claude가 자동으로:
1. 수동 차트/테이블 스캔 및 네이티브 교체
2. `lint-html.cjs`로 전체 린트
3. `convert.cjs` 생성 및 실행
4. 썸네일 생성 및 결과 보고

### Path B — 텍스트 + 참고자료 → HTML → PPTX

```
브랜드 가이드라인 pdf 붙임. 다음 내용으로 12장 PPT 만들어줘.
1. 표지: ...
2. 목차
3. 시장 개요 + 막대 차트(매출 데이터)
...
```

Claude가 자동으로:
1. 슬라이드를 정형/콘텐츠로 분류, 차트·표·이미지 플래그 설정
2. 정형 슬라이드는 Orchestrator가 직접 생성
3. 콘텐츠 슬라이드는 Builder Agent를 병렬 호출해 생성
4. 린트 → 변환 → 썸네일
5. 피드백 루프

---

## 디렉토리 구조

```
pptx-skill/
├── SKILL.md                 메인 워크플로 (Claude가 읽음)
├── reference.md             HTML 공통 규격, px→pt, 에러 가이드, 불릿
├── html2pptx.md             PptxGenJS API 예제 (addChart/addTable/addImage)
├── prompts/
│   └── builder.md           Builder Agent 지침 (Agent가 Read)
└── scripts/
    ├── bootstrap.cjs        환경별 NODE_PATH 자동 해결
    ├── html2pptx.cjs        핵심 변환 라이브러리
    ├── lint-html.cjs        사전 린트 (Chromium 1회 기동)
    ├── thumbnail.py         PPTX → 썸네일 그리드
    ├── check-deps.sh        의존성 확인 (24h 캐시)
    └── validate-html.sh     HTML 기본 검증 (레거시)
```

---

## HTML 규격 요약

Claude가 생성하는 HTML은 다음 규칙을 따른다 (상세: [reference.md](reference.md)):

- `body { width:720pt; height:405pt; display:flex; margin:0; padding:0; }`
- 래퍼: `<div class="w" style="width:720pt; height:405pt; position:relative;">`
- 텍스트는 반드시 `<p>` / `<h*>` / `<ul>` / `<ol>` 안에
- `<p>` 등에 배경/보더 금지 → `<div>`로 감싸기
- 수동 불릿(`•`, `·`) 금지 → `<ul>` / `<ol>`
- 하단 여백 36pt 이상
- **HTML `<table>` 금지** → placeholder + `addTable()`
- **수동 `<div>` 막대 차트 금지** → placeholder + `addChart()`

---

## 네이티브 차트/테이블 워크플로

HTML 안에 placeholder `<div>`를 배치하고, `convert.cjs`에서 `html2pptx()` 반환값으로 좌표를 받아 `slide.addChart()` / `slide.addTable()`을 호출한다.

```html
<div id="chart-supply" class="placeholder"
     style="position:absolute; top:120pt; left:60pt; width:600pt; height:240pt;"></div>
```

```javascript
const { slide, placeholders } = await html2pptx('slides/slide-03.html', pptx, { browser });
const area = placeholders.find(p => p.id === 'chart-supply');
if (area) {
  slide.addChart(pptx.charts.BAR, [{
    name: '입주 예정 물량',
    labels: ["'22","'23","'24","'25","'26"],
    values: [2800, 3200, 3500, 1200, 800]
  }], { ...area, barDir: 'col', chartColors: ['2196F3'], showValue: true });
}
```

추가 예제는 [html2pptx.md](html2pptx.md) 참고.

---

## 자주 쓰는 명령

```bash
# 스킬 디렉토리 감지
[ -d /mnt/skills/user/pptx-skill ] && SKILL_DIR=/mnt/skills/user/pptx-skill || SKILL_DIR="$HOME/.claude/skills/pptx-skill"

# 의존성 확인 (24h 캐시)
bash "$SKILL_DIR/scripts/check-deps.sh"

# 사전 린트 (convert 전 필수)
node "$SKILL_DIR/scripts/lint-html.cjs" slides/

# 변환 + 썸네일
node convert.cjs && python3 "$SKILL_DIR/scripts/thumbnail.py" output.pptx thumbnail --cols 5
```

---

## 환경 요구사항

- **Node.js** 18+
- **Python** 3.9+
- **LibreOffice** 7.0+ (썸네일 생성 시에만 필요)
- **Poppler** (썸네일 생성 시에만 필요)
- **운영체제**: macOS, Linux (Claude Desktop은 자체 컨테이너)

---

## 라이선스

MIT
