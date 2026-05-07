# html2pptx + PptxGenJS API Reference

PptxGenJS 코드 예제집. HTML 작성 규칙·변환 스펙·에러 해결은 [reference.md](reference.md) 참조.

**차트·표 처리 모드는 SKILL.md Step 0.6 에서 명시 확정된다.** 본 문서는 모드별 코드 예제를 모두 담음. 빌드 시점에 확정된 모드(`MODE = A` / `B`) 에 해당하는 섹션만 사용.

---

## MODE A — SVG→PNG 캡처 (차트·표 모두)

`<div data-pptx-image="true">…</div>` 로 감싸기만 하면 `html2pptx.cjs` 가 playwright 로 그 영역만 PNG 캡처해서 자동으로 `slide.addImage()` 로 박는다. convert.cjs 에 후처리 코드 추가 불필요.

### 차트

```html
<div class="chart-box" data-pptx-image="true"
     style="position:absolute; top:100pt; left:28pt; width:380pt; height:240pt;">
  <svg viewBox="0 0 380 240" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">
    <!-- Y 축 라벨 -->
    <g font-size="10" fill="#999" font-family="ui-monospace,Menlo,monospace">
      <text x="32" y="32"  text-anchor="end">3000</text>
      <text x="32" y="120" text-anchor="end">1500</text>
      <text x="32" y="220" text-anchor="end">0</text>
    </g>
    <!-- 막대: height = (val/maxY)*200, y = 220 - height -->
    <rect x="50"  y="40"  width="40" height="180" fill="#2196F3"/>
    <rect x="110" y="60"  width="40" height="160" fill="#2196F3"/>
    <rect x="170" y="20"  width="40" height="200" fill="#2196F3"/>
    <rect x="230" y="160" width="40" height="60"  fill="#C8C8C8"/>
    <rect x="290" y="180" width="40" height="40"  fill="#C8C8C8"/>
    <!-- X 축 라벨 -->
    <g font-size="10" fill="#666" text-anchor="middle">
      <text x="70"  y="235">'22</text>
      <text x="130" y="235">'23</text>
      <text x="190" y="235">'24</text>
      <text x="250" y="235">'25</text>
      <text x="310" y="235">'26</text>
    </g>
  </svg>
</div>

<!-- 차트 외 영역(타이틀·범례) 은 컨테이너 밖에 -->
<div style="position:absolute; top:60pt; left:28pt;"><h3>입주 예정 물량</h3></div>
```

### 표

```html
<div data-pptx-image="true"
     style="position:absolute; top:110pt; left:28pt; width:316pt; height:140pt;">
  <div class="t" style="display:flex; flex-direction:column; border-top:2px solid #333; border-bottom:2px solid #333;">
    <div class="tr" style="display:grid; grid-template-columns:2fr 1fr 1fr;">
      <div class="th" style="padding:7px 10px; background:#F8F8F8;"><p style="margin:0; font-weight:700;">구분</p></div>
      <div class="th" style="padding:7px 10px; background:#F8F8F8;"><p style="margin:0; font-weight:700;">2024</p></div>
      <div class="th" style="padding:7px 10px; background:#F8F8F8;"><p style="margin:0; font-weight:700;">2025</p></div>
    </div>
    <div class="tr" style="display:grid; grid-template-columns:2fr 1fr 1fr;">
      <div class="td" style="padding:7px 10px;"><p style="margin:0;">매출</p></div>
      <div class="td" style="padding:7px 10px;"><p style="margin:0;">120억</p></div>
      <div class="td" style="padding:7px 10px;"><p style="margin:0;">180억</p></div>
    </div>
  </div>
</div>
```

### 절대 금지사항 (디폴트 SVG→PNG 모드)

**표 (1·2·3·4·5·6)**
1. `<th>` / `<td>` 태그 사용 금지 — `<div class="th">` `<div class="td">` 만
2. `<table>` 태그 자체 사용 금지
3. 셀 안 raw text 금지 — `<p>` · `<h1>~<h6>` · `<ul>` · `<ol>` 안에
4. 표 데이터 축약·반올림 금지 (원본 1:1 보존)
5. 강조 클래스(`.hi` `.total` 등) 임의 변경 금지
6. 가이드라인이 상하단 보더만 정의했으면 좌우 보더 추가 금지

**차트 (11·12·13·19·21)**
11. div+CSS `transform:rotate()` 로 차트 그리기 금지 — PPTX 에서 회전 무시됨
12. SVG `<rect>` / `<polyline>` / `<circle>` 을 PPTX 네이티브 도형으로 기대 금지 — PNG 캡처 외 길 없음
13. `height=0` 같은 빈 SVG 요소 트릭 금지 — 안 쓰면 통째 삭제
19. 차트+표 슬라이드에서도 `<th>` / `<td>` 사용 금지
21. 차트 외 영역(헤더·타이틀·범례·표·인사이트 박스) 까지 캡처 영역에 포함 금지 — `data-pptx-image` 는 차트 컨테이너에만

### convert.cjs

후처리 코드 불필요. html2pptx() 한 번 호출이면 캡처·임베드까지 자동:

```javascript
const { slide } = await html2pptx('slides/slide-XX.html', pptx);
// 끝. data-pptx-image 영역은 자동으로 PNG 캡처되어 박힘
```

---

## html2pptx() 함수

```javascript
const result = await html2pptx(htmlFile, pres, options);
```

**Parameters**
- `htmlFile` (string): HTML 파일 경로
- `pres` (pptxgen): PptxGenJS presentation 인스턴스
- `options` (object, optional): `{ tmpDir, slide }`

**Returns**: `{ slide, placeholders }`
```javascript
{
  slide: pptxgenSlide,              // 생성/업데이트된 슬라이드
  placeholders: [                   // placeholder 영역 (inches 단위)
    { id: string, x: number, y: number, w: number, h: number }
  ]
}
```

### 기본 사용

bootstrap.cjs 경로는 환경(Claude Desktop `/mnt/...` / Claude Code `~/.claude/...`)에 따라 다르므로 **3줄 블록으로 자동 감지**:

```javascript
const fs = require('fs'), path = require('path');
const bootstrapPath = [
  '/mnt/skills/user/pptx-skill/scripts/bootstrap.cjs',
  path.join(process.env.HOME || '', '.claude/skills/pptx-skill/scripts/bootstrap.cjs')
].find(p => fs.existsSync(p));
const { html2pptx, pptxgen } = require(bootstrapPath);

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_16x9';

const { slide, placeholders } = await html2pptx('slide.html', pptx);

const chartArea = placeholders.find(p => p.id === 'myChart');
if (chartArea) {
  slide.addChart(pptx.charts.LINE, chartData, chartArea);
}

await pptx.writeFile({ fileName: 'output.pptx' });
```

### Validation
html2pptx가 자동 검증하는 항목:
1. HTML 크기가 presentation layout과 일치
2. 콘텐츠가 body를 넘지 않음
3. CSS gradient 미사용
4. 텍스트 요소에 background/border/shadow 없음

모든 에러를 한 번에 수집 후 throw.

### HTML 예시

```html
<!DOCTYPE html>
<html>
<head><style>
html { background: #ffffff; }
body { width: 720pt; height: 405pt; margin: 0; padding: 0; display: flex; }
.content { margin: 30pt; padding: 40pt; background: #ffffff; border-radius: 8pt; }
</style></head>
<body>
<div class="content">
  <h1>Title</h1>
  <ul><li><b>Item:</b> Description</li></ul>
  <p>Text with <b>bold</b>, <i>italic</i>, <u>underline</u>.</p>
  <div id="chart" class="placeholder" style="width: 350pt; height: 200pt;"></div>
</div>
</body>
</html>
```

---

## PptxGenJS API

### ⚠️ Critical: 색상에 `#` 금지
```javascript
color: "FF0000"              // ✅
fill: { color: "0066CC" }    // ✅
color: "#FF0000"             // ❌ 파일 손상
```

### addText

```javascript
slide.addText([
  { text: "Bold ", options: { bold: true } },
  { text: "Normal" }
], { x: 1, y: 2, w: 8, h: 1 });
```

### addShape

```javascript
slide.addShape(pptx.shapes.RECTANGLE, { x: 1, y: 1, w: 3, h: 2, fill: { color: "4472C4" } });
slide.addShape(pptx.shapes.OVAL,      { x: 5, y: 1, w: 2, h: 2, fill: { color: "ED7D31" } });
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 1, y: 4, w: 3, h: 1.5, fill: { color: "70AD47" }, rectRadius: 0.2 });
```

### addImage

```javascript
const aspectRatio = imgWidth / imgHeight;
const h = 3;
const w = h * aspectRatio;
slide.addImage({ path: "chart.png", x: (10 - w) / 2, y: 1.5, w, h });
```

---

## MODE B — 네이티브 차트 (`addChart`)

> Step 0.6 에서 MODE B (네이티브) 가 확정된 경우 사용. PowerPoint 안에서 데이터·범례·축 편집 가능.

### Bar Chart

```javascript
slide.addChart(pptx.charts.BAR, [{
  name: "Sales 2024",
  labels: ["Q1", "Q2", "Q3", "Q4"],
  values: [4500, 5500, 6200, 7100]
}], {
  ...placeholders[0],
  barDir: 'col',              // 'col' 세로막대 / 'bar' 가로막대
  showTitle: true,
  title: 'Quarterly Sales',
  showLegend: false,
  showCatAxisTitle: true,
  catAxisTitle: 'Quarter',
  showValAxisTitle: true,
  valAxisTitle: 'Sales ($000s)',
  valAxisMinVal: 0,
  valAxisMaxVal: 8000,
  valAxisMajorUnit: 2000,
  dataLabelPosition: 'outEnd',
  dataLabelColor: '000000',
  chartColors: ["4472C4"]
});
```

### Line Chart

```javascript
slide.addChart(pptx.charts.LINE, [{
  name: "Temperature",
  labels: ["Jan", "Feb", "Mar", "Apr"],
  values: [32, 35, 42, 55]
}], {
  x: 1, y: 1, w: 8, h: 4,
  lineSize: 4,
  lineSmooth: true,
  showCatAxisTitle: true,
  catAxisTitle: 'Month',
  showValAxisTitle: true,
  valAxisTitle: 'Temperature',
  valAxisMinVal: 0, valAxisMaxVal: 60, valAxisMajorUnit: 20,
  chartColors: ["4472C4", "ED7D31", "A5A5A5"]
});
```

### Pie Chart

```javascript
slide.addChart(pptx.charts.PIE, [{
  name: "Market Share",
  labels: ["Product A", "Product B", "Other"],
  values: [35, 45, 20]
}], {
  x: 2, y: 1, w: 6, h: 4,
  showPercent: true,
  showLegend: true,
  legendPos: 'r',
  chartColors: ["4472C4", "ED7D31", "A5A5A5"]
});
```

### Scatter Chart
**IMPORTANT**: 첫 번째 시리즈 = X축 값, 이후 시리즈 = Y축 값

```javascript
slide.addChart(pptx.charts.SCATTER, [
  { name: 'X-Axis',   values: allXValues },
  { name: 'Series 1', values: data1.map(d => d.y) }
], {
  x: 1, y: 1, w: 8, h: 4,
  lineSize: 0,
  lineDataSymbol: 'circle',
  chartColors: ["4472C4", "ED7D31"]
});
```

### Chart Colors
```javascript
chartColors: ["16A085"]                           // 단일 시리즈
chartColors: ["16A085", "FF6B9D", "2C3E50"]       // 다중 시리즈
```

### 시계열 granularity 가이드
- 30일 미만 → daily
- 30~365일 → monthly
- 365일 초과 → yearly

---

## MODE B — 네이티브 표 (`addTable`)

> Step 0.6 에서 MODE B (네이티브) 가 확정된 경우 사용. PowerPoint 안에서 데이터·셀 편집 가능.

### Basic

```javascript
slide.addTable([
  ["Header 1", "Header 2", "Header 3"],
  ["Row 1", "Data", "Data"],
  ["Row 2", "Data", "Data"]
], {
  x: 0.5, y: 1, w: 9, h: 3,
  border: { pt: 1, color: "999999" },
  fill: { color: "F1F1F1" }
});
```

### Custom formatting

```javascript
const tableData = [
  [
    { text: "Product", options: { fill: { color: "4472C4" }, color: "FFFFFF", bold: true } },
    { text: "Revenue", options: { fill: { color: "4472C4" }, color: "FFFFFF", bold: true } }
  ],
  ["Product A", "$50M"],
  ["Product B", "$35M"]
];

slide.addTable(tableData, {
  x: 1, y: 1.5, w: 8, h: 3,
  colW: [4, 4],
  rowH: [0.5, 0.6, 0.6],
  border: { pt: 1, color: "CCCCCC" },
  align: "center", valign: "middle",
  fontSize: 14
});
```

### Merged cells (colspan / rowspan)

```javascript
const merged = [
  [{ text: "Q1 Results", options: { colspan: 3, fill: { color: "4472C4" }, color: "FFFFFF", bold: true } }],
  ["Product", "Sales", "Market Share"],
  ["Product A", "$25M", "35%"]
];
slide.addTable(merged, { x: 1, y: 1, w: 8, h: 2.5, colW: [3, 2.5, 2.5], border: { pt: 1, color: "DDDDDD" } });
```

### Table Options
- `x, y, w, h` — 위치/크기 (inches)
- `colW`, `rowH` — 컬럼/행 크기 배열
- `border` — `{ pt: 1, color: "999999" }`
- `fill` — 배경 (# 없음)
- `align` — `"left"` | `"center"` | `"right"`
- `valign` — `"top"` | `"middle"` | `"bottom"`
- `fontSize`
- `autoPage` — 오버플로우 시 자동 페이지 분할
