---
name: pptx-skill
description: 최적화된 PowerPoint 생성. HTML 입력 → PPTX 변환, 또는 텍스트+참고자료 → HTML 생성 → PPTX 변환. 차트·표 처리 모드(SVG→PNG 캡처 vs 네이티브)를 빌드 시작 전 사용자에게 명시 확인받는다.
---

# PPTX Skill — Optimized

HTML을 PowerPoint로 변환한다. 두 입력 형태를 모두 지원:

- **Path A**: HTML이 이미 있음 → 검증 + (선택 모드) + PPTX
- **Path B**: 텍스트 요청 + 참고자료(가이드라인/PDF) → HTML 생성 → PPTX

정형 슬라이드는 Orchestrator가 직접 생성, 콘텐츠 슬라이드는 규모에 따라 Orchestrator 또는 Builder Agent가 처리.

## 차트·표 처리 모드 — Step 0.6 에서 명시 확정

빌드 시작 전 사용자에게 두 모드 중 하나를 **반드시 명시 확인** 받는다 (Step 0.6 참조). 자동 추정 금지.

| 모드 | 동작 요약 | 트레이드오프 |
|---|---|---|
| **A: SVG→PNG 캡처** | 차트는 SVG 로 그리고 표는 div+grid 로 작성 → `<div data-pptx-image="true">` 컨테이너로 감싸 PNG 캡처 → `slide.addImage()` 로 박음 | + 픽셀 퍼펙트 디자인 보존 (그라디언트·커스텀 보더·복잡 표 OK) <br> − PowerPoint 안 데이터 편집 불가 (이미지 자산이 됨) |
| **B: 네이티브 PptxGenJS** | 차트는 `class="placeholder"` 자리만 두고 `addChart()` 후처리, 표는 `addTable()` | + PowerPoint 에서 데이터·셀·범례 편집 가능 <br> − 디자인 표현력 제한 (PptxGenJS 옵션 한도 내) |

같은 덱 안에서 **혼합 모드**도 가능 — 슬라이드별로 모드 다르게 받을 수 있음. 그 경우 슬라이드 단위 매핑 테이블을 받아둔다.

각 모드별 절대 금지사항·세부 규칙은 Step 0.6 확정 직후 해당 섹션 참조 (모드 A: §A 절대 금지사항, 모드 B: [html2pptx.md](html2pptx.md)).

### 모드 A 절대 금지사항 (SVG→PNG 캡처 선택 시)

1. **`<th>` / `<td>` 태그 사용 금지** — html2pptx 가 변환 못함. `<div class="th"><p>…</p></div>` / `<div class="td"><p>…</p></div>` / `<div class="tr">…</div>` 같은 div+grid 형식만 허용
2. **`<table>` 태그 자체 사용 금지** — 동일 사유 (div grid 만)
3. **셀 안 raw text 금지** — 모든 텍스트는 `<p>` · `<h1>~<h6>` · `<ul>` · `<ol>` 안에. `<div>` 안에 텍스트 직접 넣으면 빌드 실패
4. **표 데이터 축약·반올림 금지** — 원본 1:1 보존. 행·열 줄이거나 숫자 라운딩 금지
5. **강조 클래스(`.hi` `.total` 등) 임의 변경 금지** — 디자인 가이드라인이 정의한 강조 스타일이 있다면 그대로 사용. 새로 만들거나 색·굵기를 임의로 바꾸지 말 것
6. **표 좌우 보더 추가 금지** — 가이드라인이 상하단 보더만 정의한 경우 좌우 보더 임의 추가 금지

### 모드 A 차트 절대 금지사항 (SVG→PNG 캡처 선택 시)

11. **div + CSS `transform:rotate()` 로 차트 그리기 금지** — PPTX 에서 회전이 무시되므로 깨짐. 반드시 SVG 로 그릴 것
12. **SVG `<rect>` / `<polyline>` / `<circle>` 을 PPTX 네이티브 도형으로 기대 금지** — html2pptx 가 SVG 도형을 PPTX 도형으로 변환 못함. PNG 캡처 외 길 없음
13. **`height=0` 같은 빈 SVG 요소 트릭 금지** — 시점·카테고리·세그먼트가 적으면 안 쓰는 `<rect>` / `<circle>` / `<text>` / `<polyline>` 점을 통째로 삭제. 0 높이 막대 남기지 말 것
19. **차트+표 슬라이드에서 `<th>` / `<td>` 사용 금지** — 위 표 규칙과 동일
21. **차트 외 영역(헤더·타이틀·범례·표·인사이트 박스) 까지 PNG 캡처 영역에 포함 금지** — 그 영역은 PPTX 네이티브 텍스트로 처리되어야 PowerPoint 안에서 편집 가능. `data-pptx-image` 속성은 차트 컨테이너에만 둘 것

### 모드 B 절대 규칙 (네이티브 선택 시)

차트는 `<div id="chart-XX" class="placeholder">` 자리만 두고 `convert.cjs` 에서 `slide.addChart()` 후처리. 표는 `<div id="my-table" class="placeholder">` + `slide.addTable()`. HTML 안 `<table>`/`<th>`/`<td>` 직접 사용 금지 (placeholder 만 둘 것). 자세한 API 는 [html2pptx.md](html2pptx.md).

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
| 작업 디렉토리에 `slides/*.html`이 이미 존재 | **Path A** | Step 0.6 → A1 |
| 사용자가 HTML 문자열을 인라인으로 제공 | **Path A** (저장 후) | Step 0.6 → A1 |
| 사용자가 텍스트 요청 + 참고자료(가이드/PDF) | **Path B** | Step 0.6 → 1 |
| 혼합 (일부 HTML 있고 일부 텍스트로 요청) | **Path A + B** | Step 0.6 → 텍스트 부분만 Path B로 처리 후 합본 |

## Step 0.6: 차트·표 처리 모드 명시 확정 (CRITICAL — 빌드 시작 전 필수)

**Path A/B 어느 쪽이든 본격 빌드 들어가기 전에 사용자에게 모드를 명시 확인받는다.** 자동 추정 금지.

### 결정 절차

1. **사용자 메시지에서 이미 명시했는지 확인.** 다음 표현이 있으면 그 모드로 확정:
   - 모드 A 명시: "캡처로", "SVG→PNG 로", "이미지로 박아도 OK", "디자인 픽셀 퍼펙트로", "표·차트 디자인 깨지지 않게"
   - 모드 B 명시: "네이티브로", "addChart 로", "addTable 로", "PowerPoint 안에서 데이터 수정 가능하게", "편집 가능한 표·차트"
2. **모호하거나 명시 안 됨 → AskUserQuestion 으로 묻기.** 표준 질문:

```
질문: "차트와 표를 어떻게 처리할까요?"
헤더: "차트·표 모드"
옵션 A — 라벨: "디자인 그대로 캡처 (SVG→PNG)"
        설명: "표·차트의 디자인이 깨지지 않게 그대로 픽셀 퍼펙트로 박습니다. PowerPoint 안에서 데이터 편집은 불가하고 이미지 자산이 됩니다."
옵션 B — 라벨: "PowerPoint 네이티브 (편집 가능)"
        설명: "addChart() / addTable() 로 박습니다. PowerPoint 안에서 데이터·셀·범례를 직접 편집할 수 있지만 디자인 표현력은 PptxGenJS 옵션 한도 내로 제한됩니다."
```

추가 옵션 (사용자가 먼저 요청한 경우에만): "슬라이드별 혼합 — 어느 슬라이드를 어느 모드로 갈지 별도 매핑".

3. **확정된 모드를 변수로 보관**: `MODE = "A"` (SVG→PNG) 또는 `MODE = "B"` (Native) 또는 `MODE = "MIX:{slide-01:A, slide-02:B, ...}"`. 이후 모든 후속 단계 (Step A2 / Step 1 / Builder 프롬프트 / convert.cjs 작성) 가 이 변수를 참조해 분기.

### 기본 권장 — 사용자가 모를 때 어떤 걸 추천하나

사용자가 모드 차이를 모르고 "그냥 알아서" 라고 답하면:
- **참고자료에 정밀 디자인 (그라디언트·복잡 보더·사진 합성·커스텀 셀 강조) 이 있고 PPT 안에서 데이터 편집 안 할 거면** → **모드 A 권장**
- **숫자·항목이 자주 바뀌고 PPT 받은 사람이 직접 수정할 거면** → **모드 B 권장**
- 그 외에는 **모드 A 가 안전한 디폴트** (디자인 깨짐 가능성 < 수정 편의 가능성)

### 결정 직후 사용자에게 한 줄로 보고

확정된 모드를 한 줄로 사용자에게 알리고 빌드 진행. 예: "차트·표는 모드 A (SVG→PNG 캡처) 로 진행하겠습니다. 디자인 그대로 보존되고 PPT 안에서 이미지 자산으로 박힙니다."

---

# 🅰 Path A: HTML → PPTX 변환 전용

HTML이 이미 작성된 경우. 검증 + 네이티브 변환 후 PPTX로.

## Step A1: HTML 파일 수집

- `slides/*.html`이 이미 있으면 그대로 사용
- 사용자가 HTML 문자열을 제공했으면 `slides/slide-01.html`, `slide-02.html` … 순서대로 Write

## Step A2: 모드별 HTML 정합성 점검

Step 0.6 에서 확정된 `MODE` 에 따라 분기.

### MODE A 인 경우 (SVG→PNG 캡처)

각 HTML 파일에서 차트·표가 SVG/div+grid + `data-pptx-image` 로 작성됐는지 확인. 아니면 다음 패턴으로 재작성:

**차트**:
- SVG 로 그려져 있어야 함. div+CSS 막대 패턴(`position:absolute` + `height:NNpt` + `background:#HEX` 반복) 발견 시 SVG 로 다시 그리도록 수정
- 차트 외곽 div 에 `data-pptx-image="true"` 부여:
  ```html
  <div class="chart-box" data-pptx-image="true" style="position:absolute; top:YYpt; left:YYpt; width:YYpt; height:YYpt;">
    <svg viewBox="0 0 300 200">…</svg>
  </div>
  ```
- 차트 외 영역(헤더·타이틀·범례·인사이트 박스) 은 캡처 컨테이너 **밖에** 둘 것 (절대 금지 #21)
- 시점·세그먼트가 적으면 안 쓰는 SVG 요소 통째 삭제. `height=0` 빈 막대 트릭 금지 (#13)

**표**:
- `<table>`/`<th>`/`<td>` 태그 발견 시 div+grid 로 재작성 (#1·#2). 셀 텍스트는 `<p>` 안으로 (#3)
- 데이터 1:1 보존. 행·열 축약·숫자 라운딩 금지 (#4)
- 표 컨테이너에 `data-pptx-image="true"` 부여:
  ```html
  <div data-pptx-image="true" style="position:absolute; top:YYpt; left:YYpt; width:YYpt; height:YYpt;">
    <div class="t">
      <div class="tr"><div class="th"><p>…</p></div>…</div>
      <div class="tr hi"><div class="td"><p>…</p></div>…</div>
    </div>
  </div>
  ```

### MODE B 인 경우 (네이티브 PptxGenJS)

각 HTML 파일에서 차트·표 영역을 placeholder 로 교체하고 `convert.cjs` 에 후처리 호출 추가. 자세한 API 는 [html2pptx.md](html2pptx.md).

1. **데이터 추출** — HTML 에서 수치와 라벨을 읽어둔다
2. **HTML 재작성** — 차트/표 관련 요소를 삭제하고 단일 placeholder 로 교체:
   ```html
   <div id="chart-XX" class="placeholder"
        style="position:absolute; top:YYpt; left:YYpt; width:YYpt; height:YYpt;"></div>
   <div id="table-XX" class="placeholder"
        style="position:absolute; top:YYpt; left:YYpt; width:YYpt; height:YYpt;"></div>
   ```
3. **`convert.cjs` 후처리** — `slide.addChart(pptx.charts.BAR, [...], {...area})` 또는 `slide.addTable(rows, {...area})`
4. **차트 제목/부제/축 레이블 같은 텍스트**는 HTML 에 그대로 두면 PPTX 네이티브 텍스트로 박힘 (편집 가능)
5. HTML 에 raw `<table>`/`<th>`/`<td>` 직접 사용 금지 (lint-html.cjs 가 placeholder 외 사용 시 에러)

### MODE MIX 인 경우 (슬라이드별 혼합)

Step 0.6 에서 받아둔 매핑 테이블 따라 슬라이드마다 위 두 절차 중 하나 적용. 한 슬라이드 안에 차트는 모드 A, 표는 모드 B 같은 더 세분된 혼합도 가능 (요소별로 `data-pptx-image` 또는 `class="placeholder"` 분리해서 마킹).

## Step A3: 린트 (CRITICAL — 모든 에러 한 번에)

convert.cjs를 돌리기 **전에** 반드시 린트로 HTML 규칙 위반을 전부 취합한다. `lint-html.cjs`는 Chromium을 **1회만** 기동하여 `html2pptx.cjs`와 동일한 규칙을 검사하고, 모든 파일/모든 에러를 한 번에 출력한다. 린트 통과 전에는 convert.cjs를 실행하지 않는다.

```bash
node "$SKILL_DIR/scripts/lint-html.cjs" slides/
```

**에러 발생 시**: 리포트의 모든 항목을 한 번에 수정 → 다시 린트 → 통과되면 다음 단계. 에러 하나씩 고치고 convert 돌리는 패턴 금지 (재시도 누적으로 시간 낭비).

이후 **Step 4**로 이동 (공통 merge 포인트).

---

# 🅱 Path B: 텍스트 + 참고자료 → HTML → PPTX

## Step 1: 슬라이드 분류 + 차트/표 감지 (모드는 Step 0.6 에서 이미 확정)

사용자 요청의 슬라이드를 두 유형으로 분류:

- **정형 슬라이드**: 표지, PART 구분, 목차, 마무리 — 구조가 고정적
- **콘텐츠 슬라이드**: 2단 분할형, 차트 중심형, 지도+캡션형, 카드형, 타임라인형 등

**차트/표 감지 (필수)**: 분류 직후 각 콘텐츠 슬라이드마다 아래 플래그를 세운다. Step 0.6 에서 확정된 `MODE` 에 따라 Builder 프롬프트에 **모드별 강제 지시문**을 삽입.

| 플래그 | MODE A (SVG→PNG 캡처) | MODE B (네이티브) |
|---|---|---|
| `has_chart` 숫자 데이터 시각화 | "SVG 로 그리고 `data-pptx-image=\"true\"` 컨테이너로 감싸 PNG 캡처. div+CSS 막대 절대 금지" | "placeholder + `addChart()`. `<div>` 수동 차트 절대 금지" |
| `has_table` 3열+ 데이터 표 | "div+grid 로 작성하고 `data-pptx-image=\"true\"` 컨테이너로 감싸 PNG 캡처. `<table>` `<th>` `<td>` 절대 금지" | "placeholder + `addTable()`. HTML `<table>` 금지" |
| `has_image` 외부 이미지/지도/아이콘 | 경로 또는 생성 방법 명시 | 동일 |

각 모드의 절대 금지사항·세부 규칙은 본 SKILL.md 상단 "차트·표 처리 모드" 섹션 참고. Builder 프롬프트에 인라인 강조한다.

`MODE = MIX` 인 경우 `has_chart`·`has_table` 플래그에 슬라이드별로 어느 모드로 갈지 같이 표기 (예: `has_chart: A`, `has_table: B`).

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

[핵심 규칙 요약 — 인라인 강조 (Step 0.6 확정 모드 = {MODE} 기준)]

MODE A (SVG→PNG 캡처) 인 경우:
- 차트·표 컨테이너에 data-pptx-image="true" 부여 (PNG 캡처).
- 숫자 시각화: SVG 로 그릴 것. div+CSS 막대 / transform:rotate() / height=0 빈 SVG 트릭 금지.
- 표: div+grid (.tr/.th/.td) 로만. <table>/<th>/<td> 절대 금지. 셀 텍스트는 <p> 안에. 데이터 1:1 보존(축약·반올림 금지).
- 차트 외 영역(헤더·타이틀·범례·인사이트) 은 캡처 컨테이너 밖에 둘 것.

MODE B (네이티브) 인 경우:
- 차트·표 자리는 <div id="..." class="placeholder"> 만 두고 convert.cjs 에서 addChart()/addTable() 후처리.
- HTML 안 raw <table>/<th>/<td>/<div>+CSS 막대 절대 금지.
- 차트 제목·축 라벨은 HTML 텍스트로 두면 PPTX 네이티브 텍스트로 박힘 (편집 가능).

공통:
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

## Step 4.5: 누락 검증 + 자동 보완 (CRITICAL — 빌드 직후 필수)

`convert.cjs` 가 끝나고 `output.pptx` 가 생성되면, **씀네일/유저 보고 전에** 빌드된 PPTX 와 소스 슬라이드 HTML 의 텍스트 일치 여부를 검증한다. pptx-skill 의 `textTags` 화이트리스트(P, H1~6, UL, OL, LI) 밖에 있는 태그(`<blockquote>`, `<dt>`, `<dd>`, `<figcaption>`, `<details>`, `<summary>`, 사용자 정의 web component 등) 안 텍스트가 조용히 누락되는 케이스를 잡기 위함.

### 4.5.1 — 1차 audit

```bash
node "$SKILL_DIR/scripts/audit-content.cjs" <slidesDir> output.pptx --json=missing.json --threshold=20
```

- 종료 코드 0 → 누락 0건 → Step 5 (썸네일) 로 진행
- 종료 코드 1 → 20자+ 누락 청크 검출 → 4.5.2 로

`<slidesDir>` 는 mode A 면 `slides/`, mode B 면 동일하게 `slides/` (혹은 환경에 맞는 경로).

### 4.5.2 — Pass A 자동 보완 (태그 rename)

```bash
node "$SKILL_DIR/scripts/audit-fix.cjs" <slidesDir> missing.json --mode=A
```

누락 청크가 들어있는 element 의 태그를 `<p>` 로 rename 한다 (클래스·인라인 스타일·자식 보존). 인라인 태그(`<b>`/`<strong>`/`<span>` 등) 와 이미 textTag 안에 있는 element 는 안전하게 skip — 부모 textTag 의 inline run 추출에 의존.

이후 **재빌드** + **재audit**:
```bash
node convert.cjs
node "$SKILL_DIR/scripts/audit-content.cjs" <slidesDir> output.pptx --json=missing2.json --threshold=20
```

- 누락 0건 → Step 5 진행
- 여전히 누락 → 4.5.3 으로

### 4.5.3 — Pass B fallback (PNG 캡처 마킹)

```bash
node "$SKILL_DIR/scripts/audit-fix.cjs" <slidesDir> missing2.json --mode=B
```

Pass A 로 해결 안 된 청크의 부모 element 에 `data-pptx-image="true"` 를 부여 → 그 영역이 PNG 으로 캡처됨. 디자인은 보존되지만 그 영역 PowerPoint 안 편집은 불가.

이후 다시 재빌드 + 재audit. 여전히 누락이면 사용자에게 미해결 청크 리스트 보고.

### 4.5.4 — 최종 보고

| 결과 | 사용자 보고 |
|---|---|
| 1차 audit 통과 | "누락 없음" 한 줄 |
| Pass A 로 해결 | "N개 청크 자동 rename (`<blockquote>` → `<p>` 등) 후 재빌드. 누락 0." |
| Pass B 로 해결 | "N개 청크 PNG 캡처 마킹 (편집 불가). 그 외 누락 0. 보강 영역: slide-XX, ..." |
| 일부 미해결 | "M개 청크 미해결. 수동 확인 필요. missing-final.json 참조." |

### 정책 요약

- 임계치 20자 — 짧은 데코 문자·페이지 번호 같은 false positive 제거
- A → B 2단계, 각 단계마다 재빌드 1회 (총 최대 2회 재빌드)
- 자동 보완은 부수효과 발생 가능 (예: PNG 캡처 영역 늘어나면 그 영역 텍스트 편집 불가) — 항상 사용자 보고에 명시

---

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
    ├── audit-content.cjs    빌드 후 텍스트 누락 검증 (Step 4.5)
    ├── audit-fix.cjs        누락 청크 자동 보완 (A: 태그 rename, B: PNG 캡처 마킹)
    ├── thumbnail.py         PPTX → 썸네일 그리드
    ├── check-deps.sh        의존성 확인 (24h 캐시)
    └── validate-html.sh     HTML 기본 검증 (레거시)
```

**자주 쓰는 명령** (SKILL_DIR 감지 먼저):
```bash
[ -d /mnt/skills/user/pptx-skill ] && SKILL_DIR=/mnt/skills/user/pptx-skill || SKILL_DIR="$HOME/.claude/skills/pptx-skill"
bash "$SKILL_DIR/scripts/check-deps.sh"                                              # 의존성
node "$SKILL_DIR/scripts/lint-html.cjs" slides/                                      # 린트 (convert 전 필수)
node "$SKILL_DIR/scripts/audit-content.cjs" slides/ output.pptx --json=missing.json  # 누락 검증 (convert 후 필수)
node "$SKILL_DIR/scripts/audit-fix.cjs" slides/ missing.json --mode=A                # 자동 보완 (rename → P)
python3 "$SKILL_DIR/scripts/thumbnail.py" output.pptx thumbnail --cols 5             # 썸네일
```

---

## 주의사항

1. **입력 라우팅 먼저** — Step 0.5에서 Path A/B 결정
2. **convert.cjs 전에 반드시 lint-html.cjs** — 에러 전체를 한 번에 수집하여 재시도 루프 제거. 린트 없이 convert 돌리는 패턴 금지.
3. **차트/표 모드는 Step 0.6 에서 명시 확정** — 자동 추정 절대 금지. 사용자에게 모드 A(SVG→PNG 캡처) / B(네이티브) 명시 확인받고 후속 단계에 변수로 전파
4. **convert 후 Step 4.5 audit 필수** — `audit-content.cjs` 로 텍스트 누락 검증 → 검출 시 `audit-fix.cjs` 로 자동 보완 (Pass A: 태그 rename, Pass B: PNG 캡처 마킹) → 재빌드. textTags 화이트리스트 밖 태그(`<blockquote>` 등) 의 무성한 누락 방지
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
