---
name: pptx-skill
description: 최적화된 PowerPoint 생성. HTML 입력 → PPTX 변환, 또는 텍스트+참고자료 → HTML 생성 → PPTX 변환. 차트/테이블은 무조건 네이티브.
---

# PPTX Skill — Optimized

HTML을 PowerPoint로 변환한다. 두 입력 형태를 모두 지원:

- **Path A**: HTML이 이미 있음 → 검증 + 네이티브 변환 + PPTX
- **Path B**: 텍스트 요청 + 참고자료(가이드라인/PDF) → HTML 생성 → PPTX

정형 슬라이드는 Orchestrator가 직접 생성, 콘텐츠 슬라이드는 규모에 따라 Orchestrator 또는 Builder Agent가 처리. **차트/테이블은 항상 편집 가능한 네이티브(addChart/addTable)로 변환** — 사용자 확인 없이 자동 적용.

**상세 문서 (필요 시 Read)**:
- [reference.md](reference.md) — HTML 작성 공통 규칙, px→pt 변환, 에러/해결법, 불릿
- [html2pptx.md](html2pptx.md) — PptxGenJS API 코드 예제 (addChart/addTable/addImage)
- [prompts/builder.md](prompts/builder.md) — Builder Agent 지침 (Agent 프롬프트에서 Read)

---

## 경로 감지 (환경별 필수)

이 스킬은 두 환경 모두에서 동작:
- **Claude Code CLI**: `~/.claude/skills/pptx-skill` (= `$HOME/.claude/skills/pptx-skill`)
- **Claude Desktop**: `/mnt/skills/user/pptx-skill`

문서 내 `{SKILL_DIR}`은 환경에 따라 치환한다. **첫 bash 호출 시 반드시 감지**:

```bash
[ -d /mnt/skills/user/pptx-skill ] && SKILL_DIR=/mnt/skills/user/pptx-skill || SKILL_DIR="$HOME/.claude/skills/pptx-skill"
```

Node.js(`convert.cjs`)에서는 `bootstrap.cjs`를 경로 자동 탐지 후 require — 양쪽 환경에 한 블록으로 대응 (아래 Step 4 예제 참조).

---

## Step 0: 의존성 확인

```bash
[ -d /mnt/skills/user/pptx-skill ] && SKILL_DIR=/mnt/skills/user/pptx-skill || SKILL_DIR="$HOME/.claude/skills/pptx-skill"
bash "$SKILL_DIR/scripts/check-deps.sh"
```
24시간 이내 성공 이력이 있으면 즉시 skip. 강제 재확인: `FORCE=1 bash ...`.

## Step 0.5: 입력 형태 판별 (라우팅)

사용자 입력을 보고 아래 경로 중 하나로 분기:

| 입력 상태 | 경로 | 다음 단계 |
|---|---|---|
| 작업 디렉토리에 `slides/*.html`이 이미 존재 | **Path A** | Step A1 |
| 사용자가 HTML 문자열을 인라인으로 제공 | **Path A** (저장 후) | Step A1 |
| 사용자가 텍스트 요청 + 참고자료(가이드/PDF) | **Path B** | Step 1 |
| 혼합 (일부 HTML 있고 일부 텍스트로 요청) | **Path A + B** | 텍스트 부분만 Path B로 처리 후 합본 |

---

# 🅰 Path A: HTML → PPTX 변환 전용

HTML이 이미 작성된 경우. 검증 + 네이티브 변환 후 PPTX로.

## Step A1: HTML 파일 수집

- `slides/*.html`이 이미 있으면 그대로 사용
- 사용자가 HTML 문자열을 제공했으면 `slides/slide-01.html`, `slide-02.html` … 순서대로 Write

## Step A2: 네이티브 변환 스캔 (CRITICAL — 사용자 확인 불필요)

각 HTML 파일에서 **편집 불가 도형이 될 패턴**을 찾아 **무조건 네이티브로 교체**한다. 사용자 동의를 구하지 않는다.

### 수동 차트 감지 패턴
다음 중 하나라도 매칭되면 수동 차트로 판정:
- 동일 슬라이드 내 `position:absolute` + `height:NNpt` + `background:#HEX`를 가진 `<div>`가 **3개 이상** 나란히 반복
- 주변에 Y축 숫자 라벨(`4,500`, `3,000`, `1,500`, `0` 등)
- 각 바 위/근처에 수치 라벨

### HTML `<table>` 감지
- `<table>` 태그가 존재하면 **무조건** placeholder + `addTable()` 대상

### 교체 절차

1. **데이터 추출** — HTML에서 수치와 라벨을 읽어낸다 (바 높이는 style의 `height:XXpt`에서, 값은 인접 `<p>`에서)
2. **HTML 재작성** — 차트/테이블 관련 요소를 삭제하고 단일 placeholder로 교체:
   ```html
   <div id="chart-XX" class="placeholder"
        style="position:absolute; top:YYpt; left:YYpt; width:YYpt; height:YYpt;"></div>
   ```
3. **`convert.cjs`에 호출 추가** — `slide.addChart(pptx.charts.BAR, [...data...], {...options...})` 또는 `slide.addTable(...)`
4. **차트 제목/부제/축 레이블 같은 텍스트**는 HTML에 그대로 둔다 (바/셀 같은 "도형 요소"만 이전)

## Step A3: 린트 (CRITICAL — 모든 에러 한 번에)

convert.cjs를 돌리기 **전에** 반드시 린트로 HTML 규칙 위반을 전부 취합한다. `lint-html.cjs`는 Chromium을 **1회만** 기동하여 `html2pptx.cjs`와 동일한 규칙을 검사하고, 모든 파일/모든 에러를 한 번에 출력한다. 린트 통과 전에는 convert.cjs를 실행하지 않는다.

```bash
node "$SKILL_DIR/scripts/lint-html.cjs" slides/
```

**에러 발생 시**: 리포트의 모든 항목을 한 번에 수정 → 다시 린트 → 통과되면 다음 단계. 에러 하나씩 고치고 convert 돌리는 패턴 금지 (재시도 누적으로 시간 낭비).

이후 **Step 4**로 이동 (공통 merge 포인트).

---

# 🅱 Path B: 텍스트 + 참고자료 → HTML → PPTX

## Step 1: 슬라이드 분류 + 차트/표 감지

사용자 요청의 슬라이드를 두 유형으로 분류:

- **정형 슬라이드**: 표지, PART 구분, 목차, 마무리 — 구조가 고정적
- **콘텐츠 슬라이드**: 2단 분할형, 차트 중심형, 지도+캡션형, 카드형, 타임라인형 등

**차트/표 감지 (필수)**: 분류 직후 각 콘텐츠 슬라이드마다 아래 플래그를 세우고, Builder 프롬프트에 **강제 지시문을 삽입**한다. 누락 시 Agent가 수동 `<div>` 차트를 그려 편집 불가 도형이 된다.

- `has_chart` — 숫자 데이터 시각화 → "placeholder + `addChart()` 강제. `<div>` 수동 차트 절대 금지"
- `has_table` — 3열+ 데이터 표 → "placeholder + `addTable()` 강제. HTML `<table>` 금지"
- `has_image` — 외부 이미지/지도/아이콘 → 경로 또는 생성 방법 명시

## Step 2: 사전 준비

1. 작업 디렉토리에 `slides/` 폴더 생성
2. 참고자료(디자인 가이드라인, 레이아웃 규칙, PDF)를 Read로 읽어둔다

## Step 3-A: 정형 슬라이드 직접 생성

Orchestrator가 디자인 가이드라인을 참조하여 HTML을 직접 Write. 여러 정형 슬라이드는 **한 메시지에서 병렬 Write** 호출로 동시 생성. HTML 공통 규격은 **[reference.md](reference.md)** 참조.

**핵심 규칙 요약**:
- `body { width:720pt; height:405pt; display:flex; margin:0; padding:0; }`
- 래퍼: `<div class="w" style="width:720pt; height:405pt; position:relative;">`
- 텍스트는 `<p>`/`<h*>`/`<ul>`/`<ol>` 안에
- `<p>` 등에 bg/border 금지 → `<div>`로 감싸기
- 수동 불릿 금지 → `<ul>`/`<ol>`
- 하단 여백 36pt 이상

## Step 3-B: 콘텐츠 슬라이드 처리

### 처리 방식 선택

| 콘텐츠 수 | 처리 방식 |
|---|---|
| **1~2장** | **Orchestrator 직접 작성** (Agent spawn 30~120초 절감) |
| 3~4장 | 1 Builder Agent (single 모드) |
| 5~8장 | 2 Builder Agent (parallel 모드) |
| 9~12장 | 3 Builder Agent |
| 13장+ | 4 Builder Agent (최대) |

### Builder Agent 프롬프트 구성

```
먼저 {SKILL_DIR}/prompts/builder.md 를 Read로 읽어 전체 규칙을 숙지하라.
(HTML 공통 규격은 {SKILL_DIR}/reference.md 도 참조 가능)

[핵심 규칙 요약 — 인라인 강조]
- 숫자 시각화: placeholder + addChart() 강제. <div> 수동 차트 절대 금지.
- 표 데이터: placeholder + addTable() 강제. HTML <table> 금지.
- PptxGenJS 색상은 # 제거.

## 사용자 요청:
[콘텐츠 슬라이드 내용만]

## 담당 슬라이드: slide-XX ~ slide-YY
## 파일명: slides/slide-XX.html ...

## 차트/표 감지 결과:
[Step 1에서 세운 has_chart/has_table/has_image 플래그]

## 디자인 참고자료:
[가이드라인 + 레이아웃 규칙 전문]

## 작업 디렉토리: [경로]
## 빌드 모드: single | parallel
```

프롬프트에 builder.md **전체 내용을 인라인 삽입하지 않는다** — Agent가 Read하도록 지시만 한다 (토큰 절약 + 단일 진실 유지).

### 병렬 Builder 호출
parallel 모드는 **한 메시지에 여러 Agent 도구를 동시 호출**한다.

### Agent 호출 실패/지연 대응 (CRITICAL)

Builder Agent가 529/Overloaded/타임아웃 등 에러 시 **즉시 재호출/재작성 금지**:

1. **파일 존재 확인** — `slides/slide-XX.html`, `convert.cjs`, `output.pptx` 여부를 Read/ls로 확인
2. **부분 성공 가능성** — duration 1분+면 작업이 거의 완료된 상태일 가능성 높음
3. **파일이 존재하면** — Read로 검증 → 이어서 진행
4. **없거나 부적합하면** — Orchestrator 직접 작성 또는 Agent 재호출

---

# Step 4: 변환 (Path A/B 공통 merge 포인트)

모든 HTML 작성/수정 완료 후 **반드시** 린트부터 돌린다. 린트는 Chromium 1회 기동으로 모든 슬라이드의 모든 규칙 위반을 한 번에 리포팅하므로, convert.cjs를 여러 번 재시도하는 것보다 훨씬 빠르다.

```bash
node "$SKILL_DIR/scripts/lint-html.cjs" slides/
```

- **통과 시**: 아래 convert.cjs 작성/실행으로 진행
- **실패 시**: 리포트된 모든 에러를 **한 번에** 수정 → 린트 재실행 → 통과 확인
- **금지**: 린트 없이 convert.cjs부터 돌려서 에러 하나씩 고치는 패턴

## convert.cjs 작성 (양쪽 환경 대응, 공유 browser)

**공유 browser 패턴**: Chromium을 1회만 기동하고 모든 `html2pptx()` 호출에 `options.browser`로 전달한다. 슬라이드 장수가 많을수록 절감 효과가 크다 (10장 기준 10~15초 절감). 에러 동작은 동일 — 실패 시 파일명이 throw되고, 이전까지 성공한 슬라이드는 pptx 객체에 그대로 누적된다.

```javascript
// 경로 자동 감지 (Claude Desktop + Claude Code 양쪽 대응)
const fs = require('fs'), path = require('path');
const bootstrapPath = [
  '/mnt/skills/user/pptx-skill/scripts/bootstrap.cjs',
  path.join(process.env.HOME || '', '.claude/skills/pptx-skill/scripts/bootstrap.cjs')
].find(p => fs.existsSync(p));
if (!bootstrapPath) throw new Error('pptx-skill bootstrap.cjs not found');
const { html2pptx, pptxgen } = require(bootstrapPath);
const { chromium } = require('playwright');

async function main() {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';

  // Chromium 1회 기동 후 모든 슬라이드에서 재사용
  const launchOptions = process.platform === 'darwin' ? { channel: 'chrome' } : {};
  const browser = await chromium.launch(launchOptions);

  try {
    // 모든 슬라이드 (정형 + 콘텐츠) 순서대로 변환
    await html2pptx('slides/slide-01.html', pptx, { browser });
    await html2pptx('slides/slide-02.html', pptx, { browser });

    // placeholder 후처리 (네이티브 차트/테이블)
    const { slide: s3, placeholders: p3 } = await html2pptx('slides/slide-03.html', pptx, { browser });
    const area = (p3 || []).find(p => p.id === 'chart-supply');
    if (area) {
      s3.addChart(pptx.charts.BAR, [{
        name: '입주 예정 물량',
        labels: ["'22","'23","'24","'25","'26"],
        values: [2800, 3200, 3500, 1200, 800]
      }], { ...area, barDir: 'col', chartColors: ['2196F3'], showValue: true });
    }
  } finally {
    await browser.close();
  }

  await pptx.writeFile({ fileName: 'output.pptx' });
  console.log('Done: output.pptx');
}
main().catch(e => { console.error(e); process.exit(1); });
```

실행:
```bash
node convert.cjs
```
(bootstrap.cjs가 NODE_PATH를 자동 설정)

**호환성 노트**: `options.browser`는 **옵셔널**이다. 생략하면 `html2pptx()`가 기존처럼 자체 browser를 기동/종료한다 — 기존 convert.cjs는 수정 없이 그대로 동작한다. 신규 작성 시에만 공유 패턴을 적용한다.

## Path B single 모드 보정
Builder Agent가 이미 convert.cjs를 작성/실행한 경우:
1. convert.cjs에 **정형 슬라이드가 모두 포함**됐는지 확인
2. 누락 시 Edit으로 추가 → 재실행

PptxGenJS API 세부 예제는 [html2pptx.md](html2pptx.md) 참조.

## Step 5: 썸네일 생성 (백그라운드 + LibreOffice pre-warm)

**LibreOffice pre-warm**: soffice 콜드 스타트가 3~5초 걸리므로, convert.cjs가 돌아가는 동안 미리 LO 프로필을 warm-up 시킨다. convert 시작 **직전**에 아래 ① 블록을 비동기로 쏜 뒤 ② 블록을 실행하면, convert가 끝날 때 LO가 이미 워밍업된 상태라 썸네일 단계가 빨라진다.

```bash
# ① LibreOffice pre-warm (백그라운드, 즉시 반환)
( soffice -env:UserInstallation=file:///tmp/lo-pptx-skill-profile \
    --headless --norestore --nolockcheck --nologo --nodefault \
    --nofirststartwizard --terminate_after_init >/dev/null 2>&1 & )

# ② convert + 썸네일 (백그라운드 Bash 호출)
node convert.cjs && python3 "$SKILL_DIR/scripts/thumbnail.py" output.pptx thumbnail --cols 5
```

Bash 도구 호출 시 ②를 `run_in_background: true`로 실행. 그 사이 Orchestrator는 요약 메시지 작성 등을 병렬 수행.

**참고**: `thumbnail.py`는 내부적으로 `/tmp/lo-pptx-skill-profile` 전용 프로필을 사용하고 cold-start 경량화 플래그가 이미 적용되어 있다. pre-warm은 선택 사항 — 생략해도 정상 동작한다.

완료 알림 후:
1. 썸네일 이미지를 Read로 사용자에게 보여준다
2. PPTX 파일 경로 안내
3. 피드백 요청:
```
썸네일을 확인해주세요.
- 전체 OK → 완료
- 특정 슬라이드 수정 필요 → 알려주세요
```

## Step 6: 피드백 반영 (선택)

- **미세 조정** (폰트/여백/색상/좌표): Edit으로 HTML 직접 수정 → convert 재실행
- **구조 변경** (레이아웃/표/차트 재구성): 해당 슬라이드만 Builder Agent 재호출

수정 후 썸네일 재생성 → 다시 보여줌.

---

## 스크립트 / 파일 위치

```
{SKILL_DIR}/
├── SKILL.md                 이 파일 (워크플로)
├── reference.md             HTML 규격/에러/불릿/bootstrap
├── html2pptx.md             PptxGenJS API 예제
├── prompts/builder.md       Builder Agent 지침
└── scripts/
    ├── bootstrap.cjs        양쪽 환경 자동 해결
    ├── html2pptx.cjs        핵심 라이브러리 (건드리지 말 것)
    ├── lint-html.cjs        사전 린트 (html2pptx 규칙과 동기화, Chromium 1회 기동)
    ├── thumbnail.py         PPTX → 썸네일 그리드
    ├── check-deps.sh        의존성 확인 (24h 캐시)
    └── validate-html.sh     HTML 기본 검증 (레거시)
```

**자주 쓰는 명령** (SKILL_DIR 감지 먼저):
```bash
[ -d /mnt/skills/user/pptx-skill ] && SKILL_DIR=/mnt/skills/user/pptx-skill || SKILL_DIR="$HOME/.claude/skills/pptx-skill"
bash "$SKILL_DIR/scripts/check-deps.sh"                                     # 의존성
node "$SKILL_DIR/scripts/lint-html.cjs" slides/                             # 린트 (convert 전 필수)
python3 "$SKILL_DIR/scripts/thumbnail.py" output.pptx thumbnail --cols 5    # 썸네일
```

---

## 주의사항

1. **입력 라우팅 먼저** — Step 0.5에서 Path A/B 결정
2. **convert.cjs 전에 반드시 lint-html.cjs** — 에러 전체를 한 번에 수집하여 재시도 루프 제거. 린트 없이 convert 돌리는 패턴 금지.
3. **차트/테이블은 무조건 네이티브** — Path A에서 수동 차트/HTML `<table>` 감지 시 **사용자 확인 없이 자동 교체**
4. **양 환경 경로 감지** — 첫 bash 호출 시 `SKILL_DIR` 감지, Node.js는 `convert.cjs` 상단 3줄 블록으로 자동 해결
5. **정형 슬라이드 판별 정확히** — 애매하면 콘텐츠로 분류
6. **파일 번호 연속성** — 정형+콘텐츠 합쳐서 slide-01, 02, … 순서대로
7. **Builder에게 정형 슬라이드 존재 알림** — 파일명 범위 겹침 방지
8. **convert.cjs는 모든 슬라이드 포함** — 정형 + 콘텐츠 모두
9. **병렬 Builder 시 동일 가이드라인 인라인 전달**
10. **1~2장 콘텐츠는 Orchestrator 직접** — Agent spawn 비용 회피
11. **Agent 에러 시 파일 존재 먼저 확인** — 바로 재호출/재작성 금지
12. **builder.md는 Agent가 Read** — 프롬프트에 전체 인라인 복붙 금지

## 의존성

### Node.js (글로벌)
- **pptxgenjs**, **playwright**, **sharp**

### Python
- **pillow** (썸네일 그리드)

### 시스템
- **LibreOffice** (`soffice`) — PPTX → PDF
- **Poppler** (`pdftoppm`) — PDF → 이미지
