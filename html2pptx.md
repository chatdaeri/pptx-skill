# html2pptx + PptxGenJS API Reference

PptxGenJS 코드 예제집. HTML 작성 규칙·변환 스펙·에러 해결은 [reference.md](reference.md) 참조.

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

## Charts

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

## Tables

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
