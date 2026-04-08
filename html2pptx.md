# HTML to PowerPoint Guide

Convert HTML slides to PowerPoint presentations with accurate positioning using the `html2pptx.cjs` library.

## Table of Contents

1. [Creating HTML Slides](#creating-html-slides)
2. [px → pt Conversion Reference](#px--pt-conversion-reference)
3. [Bullet (List) Styling](#bullet-list-styling)
4. [Layout Strategy](#layout-strategy-flex-vs-absolute-positioning)
5. [Using the html2pptx Library](#using-the-html2pptx-library)
6. [Using PptxGenJS](#using-pptxgenjs)

---

## Creating HTML Slides

Every HTML slide must include proper body dimensions:

### Layout Dimensions

- **16:9** (default): `width: 720pt; height: 405pt`
- **4:3**: `width: 720pt; height: 540pt`
- **16:10**: `width: 720pt; height: 450pt`

### Supported Elements

- `<p>`, `<h1>`-`<h6>` - Text with styling
- `<ul>`, `<ol>` - Lists (never use manual bullets)
- `<b>`, `<strong>` - Bold text (inline formatting)
- `<i>`, `<em>` - Italic text (inline formatting)
- `<u>` - Underlined text (inline formatting)
- `<span>` - Inline formatting with CSS styles (bold, italic, underline, color)
- `<br>` - Line breaks
- `<div>` with bg/border - Becomes shape
- `<img>` - Images
- `class="placeholder"` - Reserved space for charts (returns `{ id, x, y, w, h }`)

### Critical Text Rules

**ALL text MUST be inside `<p>`, `<h1>`-`<h6>`, `<ul>`, or `<ol>` tags:**
- ✅ Correct: `<div><p>Text here</p></div>`
- ❌ Wrong: `<div>Text here</div>` - **Text will NOT appear in PowerPoint**
- ❌ Wrong: `<span>Text</span>` - **Text will NOT appear in PowerPoint**

**ONLY use web-safe fonts:**
- ✅ `Arial`, `Helvetica`, `Times New Roman`, `Georgia`, `Courier New`, `Verdana`, `Tahoma`, `Trebuchet MS`
- ❌ `'Segoe UI'`, `'SF Pro'`, `'Roboto'`, custom fonts

### Styling

- Use `display: flex` on body to prevent margin collapse from breaking overflow validation
- Use `margin` for spacing (padding included in size)
- Inline formatting: Use `<b>`, `<i>`, `<u>` tags OR `<span>` with CSS styles
  - `<span>` supports: `font-weight: bold`, `font-style: italic`, `text-decoration: underline`, `color: #rrggbb`
  - `<span>` does NOT support: `margin`, `padding`
- Use hex colors with `#` prefix in CSS
- **Text alignment**: Use CSS `text-align` (`center`, `right`, etc.)

### Shape Styling (DIV elements only)

**IMPORTANT: Backgrounds, borders, and shadows only work on `<div>` elements, NOT on text elements (`<p>`, `<h1>`-`<h6>`, `<ul>`, `<ol>`)**

- **Backgrounds**: `<div style="background: #f0f0f0;">` — Creates a shape
- **Borders**: `border: 2px solid #333333` or partial (`border-left`, etc.)
- **Border radius**: `border-radius: 50%` for circle, px/pt units for rounded corners
- **Box shadows**: `box-shadow: 2px 2px 8px rgba(0,0,0,0.3)` — outer only, inset ignored

### Icons & Gradients

- **CRITICAL: Never use CSS gradients** (`linear-gradient`, `radial-gradient`) — They don't convert
- **ALWAYS create gradient/icon PNGs FIRST using Sharp, then reference in HTML**

```javascript
// Rasterize icon to PNG
const sharp = require('sharp');
const svgString = '<svg>...</svg>';
await sharp(Buffer.from(svgString)).png().toFile('icon.png');
// Then in HTML: <img src="icon.png" style="width: 40pt; height: 40pt;">

// Rasterize gradient to PNG
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="562">
  <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" style="stop-color:#COLOR1"/>
    <stop offset="100%" style="stop-color:#COLOR2"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`;
await sharp(Buffer.from(svg)).png().toFile('gradient-bg.png');
```

---

## px → pt Conversion Reference

PPTX 슬라이드 규격은 720pt × 405pt (16:9). 웹용 HTML (1280×720px)을 PPTX용으로 변환할 때:

| Conversion | Ratio |
|-----------|-------|
| Width: 1280px → 720pt | ×0.5625 |
| Height: 720px → 405pt | ×0.5625 |
| Font: 36px → ~15-18pt | ×0.45~0.50 |
| Spacing: 24px → ~10-12pt | ×0.45~0.50 |

폰트 크기, 간격/여백의 구체적 변환 매핑은 [SKILL.md](SKILL.md)를 참조한다.

### 색상 코드 변환

CSS에서는 `#` 접두사를 사용하고, PptxGenJS에서는 `#`을 제거해야 한다. 예: `#2196F3` (HTML) → `2196F3` (PptxGenJS)

---

## Bullet (List) Styling

**NEVER use manual bullet symbols (`•`, `▪`, `-`, `*`) in text.** Use `<ul>` / `<ol>` tags.

```html
<!-- Default disc bullets -->
<ul style="list-style: disc;"><li>Item</li></ul>

<!-- Square bullets -->
<ul style="list-style: square;"><li>Item</li></ul>

<!-- No bullets (clean text list) -->
<ul style="list-style: none;"><li>Item</li></ul>
```

> For most PPTX slides, `disc` or `none` covers all practical needs.

---

## Layout Strategy: flex vs absolute positioning

**Start with flex, switch to absolute if overflow errors persist.**

**When flex is sufficient:**
- Simple layouts with 3-4 elements or fewer
- Single-column content
- Uniform-height rows

**When to switch to absolute positioning:**
- Complex multi-column layouts (info box + chart side by side)
- Slides with 5+ positioned elements
- Bar charts or diagrams requiring precise height control

**Absolute positioning best practices:**
- Always set explicit `width` to prevent unexpected text wrapping
- Keep all elements' bottom edges above 369pt (= 405pt - 36pt bottom margin)
- Fixed bottom elements should use `bottom: 38pt` or higher

```html
<div class="w" style="width: 720pt; height: 405pt; position: relative;">
  <div style="position: absolute; top: 80pt; left: 26pt; width: 330pt;">
    <p>Left content</p>
  </div>
  <div style="position: absolute; top: 80pt; left: 370pt; width: 324pt;">
    <p>Right content</p>
  </div>
  <div style="position: absolute; bottom: 38pt; left: 26pt; right: 26pt;">
    <p>Bottom message</p>
  </div>
</div>
```

### Debugging Overflow Errors

When you get `HTML content overflows body by Xpt vertically`:

1. **Identify the culprit**: Usable height = 405pt - 36pt margin = 369pt
2. **Common causes**: Nested flex gaps accumulate; `<ul>`/`<li>` default margins; font line-height differences
3. **Quick fix**: Switch to absolute positioning; reduce font by 0.5~1pt; reduce gap/margin/padding by 2~4pt
4. **Prevention**: For complex slides, start with absolute positioning

---

## Using the html2pptx Library

### API Reference

```javascript
const result = await html2pptx(htmlFile, pres, options);
```

**Parameters:**
- `htmlFile` (string): Path to HTML file
- `pres` (pptxgen): PptxGenJS presentation instance
- `options` (object, optional): `{ tmpDir, slide }`

**Returns: `{ slide, placeholders }`**
```javascript
{
    slide: pptxgenSlide,           // The created/updated slide
    placeholders: [                 // Array of placeholder positions (inches)
        { id: string, x: number, y: number, w: number, h: number }
    ]
}
```

### Basic Usage

```javascript
const pptxgen = require('pptxgenjs');
const html2pptx = require('./html2pptx.cjs');

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_16x9';

const { slide, placeholders } = await html2pptx('slide.html', pptx);

// Add chart to placeholder area
const chartArea = placeholders.find(p => p.id === 'myChart');
if (chartArea) {
    slide.addChart(pptx.charts.LINE, chartData, chartArea);
}

await pptx.writeFile({ fileName: 'output.pptx' });
```

### Validation

The library automatically validates and collects all errors before throwing:
1. HTML dimensions must match presentation layout
2. Content must not overflow body
3. CSS gradients detected
4. Text element styling (backgrounds/borders/shadows on text elements)

All errors are reported together in a single message.

### HTML Example

```html
<!DOCTYPE html>
<html>
<head>
<style>
html { background: #ffffff; }
body {
  width: 720pt; height: 405pt; margin: 0; padding: 0;
  background: #f5f5f5; font-family: Arial, sans-serif;
  display: flex;
}
.content { margin: 30pt; padding: 40pt; background: #ffffff; border-radius: 8pt; }
</style>
</head>
<body>
<div class="content">
  <h1>Title</h1>
  <ul><li><b>Item:</b> Description</li></ul>
  <p>Text with <b>bold</b>, <i>italic</i>, <u>underline</u>.</p>
  <div id="chart" class="placeholder" style="width: 350pt; height: 200pt;"></div>
  <div class="box" style="background: #70ad47; padding: 20pt;">
    <p>5</p>
  </div>
</div>
</body>
</html>
```

---

## Using PptxGenJS

### ⚠️ Critical Rules

- **NEVER use `#` prefix** with hex colors — causes file corruption
- ✅ `color: "FF0000"`, `fill: { color: "0066CC" }`
- ❌ `color: "#FF0000"`

### Adding Images

```javascript
const imgWidth = 1860, imgHeight = 1519;
const aspectRatio = imgWidth / imgHeight;
const h = 3;
const w = h * aspectRatio;
const x = (10 - w) / 2;
slide.addImage({ path: "chart.png", x, y: 1.5, w, h });
```

### Adding Text

```javascript
slide.addText([
    { text: "Bold ", options: { bold: true } },
    { text: "Normal" }
], { x: 1, y: 2, w: 8, h: 1 });
```

### Adding Shapes

```javascript
slide.addShape(pptx.shapes.RECTANGLE, { x: 1, y: 1, w: 3, h: 2, fill: { color: "4472C4" } });
slide.addShape(pptx.shapes.OVAL, { x: 5, y: 1, w: 2, h: 2, fill: { color: "ED7D31" } });
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 1, y: 4, w: 3, h: 1.5, fill: { color: "70AD47" }, rectRadius: 0.2 });
```

### Adding Charts

**Required for most charts:** Axis labels using `catAxisTitle` and `valAxisTitle`.

**Time Series Data — Choose Correct Granularity:**
- < 30 days → daily; 30-365 days → monthly; > 365 days → yearly

#### Bar Chart

```javascript
slide.addChart(pptx.charts.BAR, [{
    name: "Sales 2024",
    labels: ["Q1", "Q2", "Q3", "Q4"],
    values: [4500, 5500, 6200, 7100]
}], {
    ...placeholders[0],
    barDir: 'col',
    showTitle: true,
    title: 'Quarterly Sales',
    showLegend: false,
    showCatAxisTitle: true,
    catAxisTitle: 'Quarter',
    showValAxisTitle: true,
    valAxisTitle: 'Sales ($000s)',
    valAxisMaxVal: 8000,
    valAxisMinVal: 0,
    valAxisMajorUnit: 2000,
    dataLabelPosition: 'outEnd',
    dataLabelColor: '000000',
    chartColors: ["4472C4"]
});
```

#### Scatter Chart

**IMPORTANT**: First series = X-axis values, subsequent = Y-values:

```javascript
slide.addChart(pptx.charts.SCATTER, [
    { name: 'X-Axis', values: allXValues },
    { name: 'Series 1', values: data1.map(d => d.y) }
], {
    x: 1, y: 1, w: 8, h: 4,
    lineSize: 0,
    lineDataSymbol: 'circle',
    chartColors: ["4472C4", "ED7D31"]
});
```

#### Line Chart

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
    valAxisMinVal: 0,
    valAxisMaxVal: 60,
    valAxisMajorUnit: 20,
    chartColors: ["4472C4", "ED7D31", "A5A5A5"]
});
```

#### Pie Chart

**CRITICAL**: Single data series with all categories.

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

### Chart Colors

**CRITICAL**: Use hex colors **without** `#` prefix.

```javascript
// Single-series: one color for all bars
chartColors: ["16A085"]

// Multi-series: one color per series
chartColors: ["16A085", "FF6B9D", "2C3E50"]
```

### Adding Tables

#### Basic Table

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

#### Table with Custom Formatting

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
    align: "center",
    valign: "middle",
    fontSize: 14
});
```

#### Table with Merged Cells

```javascript
const mergedTableData = [
    [{ text: "Q1 Results", options: { colspan: 3, fill: { color: "4472C4" }, color: "FFFFFF", bold: true } }],
    ["Product", "Sales", "Market Share"],
    ["Product A", "$25M", "35%"]
];

slide.addTable(mergedTableData, { x: 1, y: 1, w: 8, h: 2.5, colW: [3, 2.5, 2.5], border: { pt: 1, color: "DDDDDD" } });
```

### Table Options

- `x, y, w, h` — Position and size
- `colW` — Array of column widths (inches)
- `rowH` — Array of row heights (inches)
- `border` — `{ pt: 1, color: "999999" }`
- `fill` — Background color (no `#`)
- `align` — `"left"`, `"center"`, `"right"`
- `valign` — `"top"`, `"middle"`, `"bottom"`
- `fontSize` — Text size
- `autoPage` — Auto-create new slides if overflow
