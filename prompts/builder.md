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

## 네이티브 테이블 (CRITICAL)

HTML `<table>`은 편집 불가 도형이 된다. **반드시 placeholder + addTable()** 사용:

```html
<div id="my-table" class="placeholder"
     style="position:absolute; top:110pt; left:28pt; width:316pt; height:140pt;">
</div>
```

convert.cjs / post.cjs에서:
```javascript
const area = placeholders.find(p => p.id === 'my-table');
if (area) {
  slide.addTable(tableData, { x: area.x, y: area.y, w: area.w, h: area.h, ... });
}
```

**PptxGenJS 색상에 `#` 금지**: `'333333'` (O) / `'#333333'` (X)

## 네이티브 차트 (CRITICAL)

HTML `<div>`로 막대/꺾은선/파이 차트를 수동으로 그리면 **편집 불가 도형**이 된다.
수치 기반 시각화(세대, %, 매출, 건수, 비율 등)는 **예외 없이 placeholder + `addChart()`** 사용.

**판별 기준**: 숫자를 시각화하는 모든 차트(bar, line, pie, scatter, area 등)
→ `<div>` 바 하나라도 손으로 그리는 순간 규칙 위반

```html
<!-- ❌ 금지: 수동 바 차트 -->
<div style="position:absolute; top:200pt; left:100pt; width:40pt; height:75pt; background:#2196F3;"></div>
<div style="position:absolute; top:195pt; left:100pt;"><p>2,800</p></div>
<!-- ... 반복 ... -->

<!-- ✅ 올바른 사용: placeholder만 -->
<div id="chart-supply" class="placeholder"
     style="position:absolute; top:100pt; left:28pt; width:380pt; height:240pt;">
</div>
```

convert.cjs / post.cjs에서:
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
    showValue: true,
    catAxisLabelColor: 'AAAAAA',
    valAxisLabelColor: 'AAAAAA',
    plotArea: { fill: { color: '1A1A1A' } }
  });
}
```

차트 제목/부제/주석 같은 **텍스트 요소만** HTML로 별도 배치 가능.
바 강조(개별 색상), 차트 내부 장식 등은 PptxGenJS 옵션(`chartColorsOpacity`, `dataLabelFormatCode` 등)으로 처리.

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

- [ ] 숫자 시각화(바/라인/파이 등)가 있다면 → `class="placeholder"` + `addChart()`로 구현했는가? `<div>`로 바를 직접 그리지 않았는가?
- [ ] 표 데이터가 있다면 → `class="placeholder"` + `addTable()`로 구현했는가? HTML `<table>`을 그대로 쓰지 않았는가?
- [ ] PptxGenJS 색상 코드에 `#`이 없는가? (`'2196F3'` O / `'#2196F3'` X)
- [ ] 모든 absolute 요소의 `top + height`가 369pt 이하 (하단 36pt 여백 확보)?
- [ ] 수동 불릿 기호(●, ■, •) 없이 `<ul>/<ol>` 사용했는가?
- [ ] `<p>`/`<h*>` 태그에 background/border/box-shadow 없이 `<div>`로 감쌌는가?
- [ ] `validate-html.sh slides/` 통과했는가?

## 출력

완료 시 보고:
- 생성/수정한 HTML 파일 목록
- output.pptx 경로 (single 모드)
- 디자인 선택 간략 설명
- **위 체크리스트 통과 여부 요약** (특히 네이티브 차트/테이블 적용 여부)
