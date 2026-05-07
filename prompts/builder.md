# Builder Agent — Optimized

콘텐츠 슬라이드(2단 분할, 차트, 카드, 타임라인 등)의 HTML을 생성하고 PPTX로 변환한다.
정형 슬라이드(표지, PART 구분, 목차)는 이미 Orchestrator가 생성했으므로 여기서 다루지 않는다.

## 최우선 규칙

1. **참고자료 충실도가 최고 우선** — 가이드라인의 컬러/서체/간격/모서리를 정확히 따른다
2. **레이아웃은 참고 PDF 우선** — 가이드라인과 PDF가 충돌하면 PDF를 따른다
3. **독자적 레이아웃 창작 금지** — 참고자료의 패턴만 사용

## HTML 필수 규칙

```
body { width: 720pt; height: 405pt; display: flex; margin: 0; padding: 0; }
래퍼: <div class="w" style="width: 720pt; height: 405pt; position: relative;">
```

- **텍스트**: 반드시 `<p>`, `<h1>`-`<h6>`, `<ul>`, `<ol>` 안에. `<div>텍스트</div>` → 안 보임
- **폰트**: 웹 안전 폰트만 (Arial, Helvetica, Georgia, Verdana, Tahoma, Trebuchet MS)
- **수동 불릿 금지** (●, ■, •) → `<ul>/<ol>` 사용
- **텍스트 요소에 bg/border 금지** → `<div>`로 감싸기
- **CSS gradient 금지** → Sharp로 PNG 렌더
- **하단 여백 36pt 이상** (absolute 요소는 bottom: 38pt+)
- **좌우 패딩 26~28pt**
- **복잡 레이아웃(5개+ 요소)은 absolute positioning** — width 반드시 명시

> **차트·표 모드는 Orchestrator (Step 0.6) 에서 이미 확정되어 이 프롬프트의 본문에 `MODE = A` 또는 `B` 로 박혀서 전달된다.** 아래 두 모드 중 해당 섹션만 따른다. 자동 추정·모드 전환 금지.

## 표 (MODE A — SVG→PNG 캡처)

표는 div+grid 로 작성하고 `data-pptx-image="true"` 컨테이너로 감싸 PNG 으로 캡처한다. `html2pptx.cjs` 가 자동으로 playwright 로 그 영역만 따서 `slide.addImage()` 로 박는다.

```html
<div data-pptx-image="true"
     style="position:absolute; top:110pt; left:28pt; width:316pt; height:140pt;">
  <div class="t" style="display:flex; flex-direction:column; border-top:2px solid #333; border-bottom:2px solid #333;">
    <div class="tr" style="display:grid; grid-template-columns:2fr 1fr 1fr;">
      <div class="th"><p>구분</p></div>
      <div class="th"><p>2024</p></div>
      <div class="th"><p>2025</p></div>
    </div>
    <div class="tr">
      <div class="td"><p>매출</p></div>
      <div class="td"><p>120억</p></div>
      <div class="td"><p>180억</p></div>
    </div>
  </div>
</div>
```

### 표 절대 금지사항

1. **`<th>` / `<td>` 태그 사용 금지** — html2pptx 미지원. `<div class="th">` `<div class="td">` 만
2. **`<table>` 태그 자체 사용 금지** — 동일 사유
3. **셀 안 raw text 금지** — 모든 텍스트는 `<p>` · `<h1>~<h6>` · `<ul>` · `<ol>` 안에. `<div class="td">…</div>` 직접 텍스트 넣으면 빌드 실패
4. **표 데이터 축약·반올림 금지** — 원본 1:1 보존
5. **강조 클래스(`.hi` `.total` 등) 임의 변경 금지** — 가이드라인이 정의한 강조 스타일 그대로
6. **표 좌우 보더 추가 금지** — 가이드라인이 상하단 보더만 정의했으면 그대로

## 표 (MODE B — 네이티브 PptxGenJS)

placeholder + addTable 로 표를 박는다. PowerPoint 안에서 데이터·셀 편집 가능.

```html
<div id="my-table" class="placeholder"
     style="position:absolute; top:110pt; left:28pt; width:316pt; height:140pt;">
</div>
```

```javascript
const area = placeholders.find(p => p.id === 'my-table');
if (area) {
  slide.addTable(tableData, { x: area.x, y: area.y, w: area.w, h: area.h, ... });
}
```

**PptxGenJS 색상에 `#` 금지**: `'333333'` (O) / `'#333333'` (X)

## 차트 (MODE A — SVG→PNG 캡처)

차트는 SVG 로 그리고 `data-pptx-image="true"` 컨테이너로 감싼다. 픽셀 퍼펙트 캡처.

```html
<div class="chart-box" data-pptx-image="true"
     style="position:absolute; top:100pt; left:28pt; width:380pt; height:240pt;">
  <svg viewBox="0 0 380 240" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">
    <rect x="40"  y="80"  width="40" height="160" fill="#2196F3"/>
    <rect x="100" y="50"  width="40" height="190" fill="#2196F3"/>
    <rect x="160" y="30"  width="40" height="210" fill="#2196F3"/>
    <rect x="220" y="170" width="40" height="70"  fill="#C8C8C8"/>
    <rect x="280" y="195" width="40" height="45"  fill="#C8C8C8"/>
    <text x="60"  y="255" text-anchor="middle" font-size="11">'22</text>
    <text x="120" y="255" text-anchor="middle" font-size="11">'23</text>
    <text x="180" y="255" text-anchor="middle" font-size="11">'24</text>
    <text x="240" y="255" text-anchor="middle" font-size="11">'25</text>
    <text x="300" y="255" text-anchor="middle" font-size="11">'26</text>
  </svg>
</div>

<!-- 차트 외 영역(타이틀·범례·인사이트) 은 컨테이너 밖에 별도 배치 — PPTX 네이티브 텍스트 -->
<div style="position:absolute; top:60pt; left:28pt;"><h3>입주 예정 물량</h3></div>
```

### 차트 절대 금지사항

11. **div + CSS `transform:rotate()` 로 차트 그리기 금지** — PPTX 에서 회전 무시됨. 반드시 SVG
12. **SVG `<rect>` / `<polyline>` / `<circle>` 을 PPTX 네이티브 도형으로 기대 금지** — html2pptx 가 SVG 도형을 PPTX 도형으로 변환 못함. PNG 캡처 외 길 없음
13. **`height=0` 같은 빈 SVG 요소 트릭 금지** — 시점·카테고리가 적으면 안 쓰는 `<rect>` / `<circle>` / `<text>` / `<polyline>` 점을 통째로 삭제
19. **차트+표 슬라이드에서 `<th>` / `<td>` 사용 금지** — 위 표 규칙과 동일
21. **차트 외 영역(헤더·타이틀·범례·표·인사이트 박스) 까지 PNG 캡처 영역에 포함 금지** — 그 영역은 PPTX 네이티브 텍스트로 편집 가능해야 함. `data-pptx-image` 는 차트 컨테이너에만

## 차트 (MODE B — 네이티브 PptxGenJS)

placeholder + addChart 로 차트를 박는다. PowerPoint 안에서 데이터·범례·축 편집 가능.

```html
<!-- ✅ 네이티브 모드: placeholder만 -->
<div id="chart-supply" class="placeholder"
     style="position:absolute; top:100pt; left:28pt; width:380pt; height:240pt;">
</div>
```

```javascript
const result = await html2pptx('slides/slide-XX.html', pptx);
const slide = result.slide;
const placeholders = result.placeholders || [];
const area = placeholders.find(p => p.id === 'chart-supply');
if (area) {
  slide.addChart(pptx.charts.BAR, [{
    name: '입주 예정 물량',
    labels: ["'22","'23","'24","'25","'26"],
    values: [2800, 3200, 3500, 1200, 800]
  }], {
    x: area.x, y: area.y, w: area.w, h: area.h,
    barDir: 'col',
    chartColors: ['2196F3'],          // # 없음
    showValue: true
  });
}
```

차트 제목/부제/주석 같은 **텍스트 요소만** HTML 로 별도 배치 가능. 바 강조(개별 색상) 등은 PptxGenJS 옵션으로 처리.

## 작업 순서

1. 슬라이드를 순차적으로 빌드하되, 각 슬라이드 완성 시점에 **자가검증 체크리스트**로 점검 (아래)
2. 모든 슬라이드 작성 완료 후 **한 번에** `validate-html.sh slides/` 실행 (1장마다 반복 호출 불필요 — 자가검증으로 조기 탐지 대체)
3. 공간 채움률: 콘텐츠 영역(~275pt)의 70% 이상 채울 것
4. 좌우 2단 시 양쪽 하단 끝 차이 20pt 이내

### single 모드 (콘텐츠 3~4장)
- HTML 전부 생성 → 디렉토리 validate → convert.cjs 작성(네이티브 차트/테이블 포함) → 실행
- convert.cjs에 **Orchestrator가 이미 생성한 정형 슬라이드 HTML도 포함**한다 (모든 슬라이드 순서대로 변환)

```javascript
// convert.cjs — 양쪽 환경 자동 감지 (Claude Desktop + Claude Code)
const fs = require('fs'), path = require('path');
const bootstrapPath = [
  '/mnt/skills/user/pptx-skill/scripts/bootstrap.cjs',
  path.join(process.env.HOME || '', '.claude/skills/pptx-skill/scripts/bootstrap.cjs')
].find(p => fs.existsSync(p));
const { html2pptx, pptxgen } = require(bootstrapPath);

async function main() {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';

  // 정형 슬라이드
  await html2pptx('slides/slide-01.html', pptx);
  await html2pptx('slides/slide-02.html', pptx);

  // 콘텐츠 슬라이드 (placeholder 후처리 포함)
  const { slide: s3, placeholders: p3 } = await html2pptx('slides/slide-03.html', pptx);
  const chartArea = (p3 || []).find(p => p.id === 'chart-supply');
  if (chartArea) {
    s3.addChart(pptx.charts.BAR, [{
      name: '입주 예정 물량',
      labels: ["'22","'23","'24","'25","'26"],
      values: [2800, 3200, 3500, 1200, 800]
    }], { ...chartArea, barDir: 'col', chartColors: ['2196F3'], showValue: true });
  }

  await pptx.writeFile({ fileName: 'output.pptx' });
  console.log('Done: output.pptx');
}
main().catch(e => { console.error(e); process.exit(1); });
```

### parallel 모드 (콘텐츠 5장+)
- HTML + post.cjs만 생성. convert.cjs는 Orchestrator가 모든 Agent 완료 후 통합 작성/실행.

## 출력 전 자가검증 체크리스트

완료 보고 **전에** 아래 항목을 모두 확인한다. 하나라도 ❌면 되돌아가 수정.

- [ ] **확정된 MODE 가 무엇인가? Orchestrator 가 프롬프트에 박은 값을 확인** (A: SVG→PNG / B: 네이티브 / MIX)
- [ ] **MODE A 인 경우** — 숫자 시각화(바/라인/파이 등) 가 있다면 SVG 로 그리고 `data-pptx-image="true"` 컨테이너로 감쌌는가? div+CSS 막대 / `transform:rotate()` / `height=0` 빈 SVG 트릭 없는가?
- [ ] **MODE A 인 경우** — 표 데이터가 div+grid 형식인가? `<table>` / `<th>` / `<td>` 태그 사용 없는가? 셀 안 텍스트는 `<p>` 안에 들어 있는가? 컨테이너에 `data-pptx-image="true"` 붙어있는가? 데이터 1:1 보존됐는가(축약·반올림 없음)?
- [ ] **MODE A 인 경우** — 차트 외 영역(헤더·타이틀·범례·인사이트 박스) 이 캡처 컨테이너 밖에 있는가? (절대 금지 #21)
- [ ] **MODE B 인 경우** — 차트·표 자리는 `<div id="..." class="placeholder">` 만 두었는가? HTML 안 raw `<table>`/`<th>`/`<td>`/`<div>`+CSS 막대 사용 없는가?
- [ ] **MODE B 인 경우** — `convert.cjs`/`post.cjs` 에 `addChart()` / `addTable()` 호출이 placeholder id 마다 추가됐는가? PptxGenJS 색상 코드에 `#`이 없는가? (`'2196F3'` O / `'#2196F3'` X)
- [ ] 모든 absolute 요소의 `top + height`가 369pt 이하 (하단 36pt 여백 확보)?
- [ ] 수동 불릿 기호(●, ■, •) 없이 `<ul>/<ol>` 사용했는가?
- [ ] `<p>`/`<h*>` 태그에 background/border/box-shadow 없이 `<div>`로 감쌌는가?
- [ ] `lint-html.cjs slides/` 통과했는가?

## 출력

완료 시 보고:
- 생성/수정한 HTML 파일 목록
- output.pptx 경로 (single 모드)
- 디자인 선택 간략 설명
- **위 체크리스트 통과 여부 요약** (특히 네이티브 차트/테이블 적용 여부)
