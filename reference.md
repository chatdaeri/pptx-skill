# pptx-skill — Reference

SKILL.md에서 분리된 상세 레퍼런스. **매 실행마다 로드되지 않는다.** 필요할 때만 Read로 참조.

- **HTML 작성 공통 규칙** — HTML 슬라이드 작성 시 반드시 지킬 규격
- **px → pt 변환 기준** — 원본 디자인(px)을 PPTX(pt)로 변환할 때 비율/매핑 표
- **레이아웃 전략** — flex vs absolute positioning 판단 기준
- **불릿 스타일 가이드** — `<ul>`/`<ol>` 커스터마이징
- **자주 발생하는 에러** — 즉시 해결법 표
- **변환 스크립트 부트스트랩** — bootstrap.cjs 사용법

---

## HTML 작성 공통 규칙 (CRITICAL)

### 크기/래퍼
```html
<body style="width:720pt; height:405pt; margin:0; padding:0; display:flex;">
  <div class="w" style="width:720pt; height:405pt; position:relative;">
    ...
  </div>
</body>
```
- `display:flex`는 margin collapse 방지용 (overflow validation에 영향)
- 하단 여백 **36pt 이상** 확보. absolute 요소는 `bottom: 38pt` 이상

### 텍스트 규칙
- **모든 텍스트는 `<p>`, `<h1>`-`<h6>`, `<ul>`, `<ol>` 안에** 작성
  - ❌ `<div>텍스트</div>` → PPTX에서 안 보임
  - ❌ `<span>텍스트</span>` (최상위) → 안 보임
  - ✅ `<div><p>텍스트</p></div>`
- `<td>`/`<th>` 안의 텍스트도 반드시 `<p>`로 감싸기
- **수동 불릿 금지** (`●`, `■`, `▪`, `•`, `-`, `*`) — `<span>`으로 감싸도 에러. `<ul>/<ol>` 사용
- 폰트는 웹 안전 폰트만: `Arial`, `Helvetica`, `Georgia`, `Verdana`, `Tahoma`, `Trebuchet MS`, `Times New Roman`, `Courier New`

### 스타일 규칙
- `<p>`, `<h*>`, `<ul>`, `<ol>` 등 **텍스트 요소**에 `background`/`border`/`box-shadow` **금지** → `<div>`로 감싸기
- **CSS gradient 금지** (`linear-gradient`, `radial-gradient`) — Sharp로 PNG 렌더 후 `<img>` 사용
- 인라인 서식: `<b>`, `<i>`, `<u>`, 또는 `<span>` + CSS (`font-weight`, `font-style`, `text-decoration`, `color`)
- `<span>`에는 margin/padding 적용 불가

### 좌표 규칙 (absolute positioning)
- 모든 요소의 `top + height`가 **369pt** (= 405 - 36) 이하
- `width`를 반드시 명시해야 텍스트 줄바꿈이 예측 가능
- 하단 고정 요소는 `bottom: 38pt` 이상

---

## px → pt 변환 기준

### 레이아웃
| 비율 | body 크기 (pt) | PptxGenJS layout |
|---|---|---|
| 16:9 (기본) | 720 × 405 | `LAYOUT_16x9` |
| 4:3 | 720 × 540 | `LAYOUT_4x3` |
| 16:10 | 720 × 450 | `LAYOUT_16x10` |

### 폭/높이/간격 (×0.5625)
| 원본 (px) | PPTX (pt) |
|---|---|
| 1280 (width) | 720 |
| 720 (height) | 405 |
| 50 (패딩 좌/우) | 26~28 |
| 40 (패딩 상) | 18~22 |
| 30 (패딩 하) | **최소 36** (0.5인치) |
| 24 (간격 대) | 10~12 |
| 8 (간격 소) | 3~4 |

### 폰트 크기 (×0.45~0.50)
> **원칙**: 디자인 가이드가 있으면 그 비율로 변환. 아래는 **참고 디자인이 없을 때** 기본 예시.

| 용도 | 원본 px | PPTX pt |
|---|---|---|
| 메인 타이틀 | 36~40 | 15~18 |
| 서브 타이틀 | 22~26 | 9~11 |
| 소제목 | 16~18 | 7~8 |
| 섹션 레이블 | 13~14 | 6~7 |
| 본문/테이블 | 13~14 | 6~7 |
| 출처/주석 | 11~12 | 5~5.5 |
| 페이지 번호 | 11 | 5 |

### 색상 코드
- CSS HTML: `#2196F3` (# 포함)
- PptxGenJS 코드: `'2196F3'` (# 제거 필수 — 포함 시 파일 손상)

---

## 레이아웃 전략: flex vs absolute positioning

**1단계: flex로 시작**
단순 구조(요소 3~4개, 단일 컬럼)는 flex로 충분.

**2단계: 오버플로우/복잡도 발생 시 absolute로 전환**
- 2단 이상 복합 레이아웃
- 요소 5개 이상
- 바 차트처럼 높이를 정밀 제어해야 하는 경우

**absolute 사용 시**:
- 모든 요소 `top + height ≤ 369pt`
- `width` 명시
- 하단 고정 요소는 `bottom: 38pt+`

**오버플로우 에러 원인**: 중첩 flex gap 누적, `<ul>/<li>` 기본 margin, line-height 차이.
빠른 해결: absolute로 전환 / 폰트 0.5~1pt 감소 / gap·padding 2~4pt 감소.

---

## 불릿 스타일 가이드

**수동 불릿 금지**: `●`, `■`, `▪`, `•`, `-`, `*` 등을 텍스트에 직접(또는 `<span>` 안에) 넣으면 변환 에러.

```html
<!-- ❌ 금지 -->
<p>● 항목 1</p>
<p><span>●</span> 항목 2</p>

<!-- ✅ 올바른 사용 -->
<ul><li>항목 1</li></ul>
```

**커스터마이징**:
```html
<ul style="list-style: disc;"><li>원형</li></ul>
<ul style="list-style: square;"><li>사각형</li></ul>
<ul style="list-style: none;"><li>불릿 없음</li></ul>
```
대부분의 슬라이드는 `disc` 또는 `none`으로 충분.

---

## 자주 발생하는 에러 & 즉시 해결법

| 에러 메시지 / 증상 | 원인 | 해결 |
|---|---|---|
| `Text element <p> starts with bullet symbol` | `<p>● 제목</p>` | `<ul><li>제목</li></ul>` |
| `Text element <p> has border` | `<p style="border-bottom:...">` | `<div style="border-bottom:..."><p>텍스트</p></div>` |
| `placeholders.find is not a function` | 반환값을 바로 배열로 사용 | `result.placeholders`로 접근 |
| `color: '#FF0000'` → 파일 손상 | PptxGenJS에서 # 접두사 사용 | `color: 'FF0000'` (# 제거) |
| 텍스트가 PPTX에 안 나옴 | `<div>텍스트</div>` | `<div><p>텍스트</p></div>` |
| `<td>` 안 텍스트 누락 | `<td>내용</td>` | `<td><p>내용</p></td>` |
| HTML dimensions don't match | body 크기 불일치 | `body { width:720pt; height:405pt; }` 확인 |
| HTML content overflows body | 콘텐츠 초과 | 하단 여백 36pt 이상 확보 |
| **차트가 편집 불가 도형으로 들어감** | `<div>`로 수동 바 차트 작성 | placeholder + `slide.addChart(pptx.charts.BAR, ...)` |
| **표가 편집 불가 도형으로 들어감** | HTML `<table>` 그대로 변환 | placeholder + `slide.addTable(...)` |
| Agent 529/Overloaded 에러 | API 혼잡 | 파일 존재 먼저 확인 — 부분 성공 많음. 바로 재호출 금지 |

---

## 변환 스크립트 부트스트랩 (bootstrap.cjs)

NODE_PATH 설정 + html2pptx 경로 해결을 자동 처리. **Claude Desktop(`/mnt/skills/user/...`)과 Claude Code(`~/.claude/skills/...`) 양쪽 환경을 동시에 대응**한다.

```javascript
// convert.cjs 상단: 3줄 블록으로 양쪽 환경 자동 감지
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

  // Chromium 1회 기동 → 모든 슬라이드에서 재사용 (대량 변환 시 큰 속도 개선)
  const launchOptions = process.platform === 'darwin' ? { channel: 'chrome' } : {};
  const browser = await chromium.launch(launchOptions);
  try {
    const { slide, placeholders } = await html2pptx('slides/slide-01.html', pptx, { browser });
    // ... 네이티브 차트/테이블 후처리 ...
    // const area = placeholders.find(p => p.id === 'chart-1');
    // slide.addChart(pptx.charts.BAR, data, { ...area, ... });
  } finally {
    await browser.close();
  }

  await pptx.writeFile({ fileName: 'output.pptx' });
}
main().catch(e => { console.error(e); process.exit(1); });
```

**`options.browser`는 옵셔널.** 생략하면 `html2pptx()`가 자체 browser를 기동/종료한다 (기존 동작). 한 번의 변환에서 슬라이드 2장 이상이면 공유 browser 권장.

실행:
```bash
node convert.cjs
```
(bootstrap.cjs가 NODE_PATH와 html2pptx 경로를 자동 설정하므로 환경변수 수동 지정 불필요)

---

## html2pptx() 반환값

```javascript
const result = await html2pptx('slide.html', pptx);
const slide = result.slide;
const placeholders = result.placeholders || [];
const chartPos = placeholders.find(p => p.id === 'my-chart');
```

**잘못된 사용**:
```javascript
const placeholders = await html2pptx('slide.html', pptx);  // ❌ 객체가 배열이 아님
placeholders.find(...);  // TypeError
```

PptxGenJS API 코드 예제(addChart/addTable/addImage)는 [html2pptx.md](html2pptx.md)를 참조.
