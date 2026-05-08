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
- **한글·커스텀 폰트 사용 시 → 아래 "한글·커스텀 폰트 가이드" 필독.** 임의로 시스템 fallback("Apple SD Gothic Neo" / "Malgun Gothic" 등) 으로 갈아끼우지 말 것 — 사용자가 디자인 가이드라인에 명시한 폰트는 그 의도가 명확한 신호이므로, family-name 매핑으로 살리는 게 기본값

### 한글·커스텀 폰트 가이드 (CRITICAL)

PPT의 텍스트 영역(이미지가 아닌 부분)은 PowerPoint를 여는 사용자 PC의 폰트로 렌더링된다. 따라서 **CSS의 `font-family` 이름이 PowerPoint가 인식하는 폰트명과 정확히 일치**해야 깨지지 않는다.

**폰트 파일명(예: `SCDream6.otf`)을 그대로 쓰면 안 됨.** 폰트 파일명은 운영체제가 인식하는 실제 폰트명과 다른 경우가 대부분이다.

#### 정확한 폰트명을 확인하는 방법

1. **Mac**: 폰트북(Font Book) 앱 열기 → 폰트 선택 → 우측 패널에 표시되는 이름 (예: "S-Core Dream")
2. **Windows**: 설정 → 글꼴 → 해당 글꼴 클릭 → 글꼴 패밀리 이름
3. **PowerPoint**: 폰트 드롭다운에 표시되는 이름 그대로 (예: "S-Core Dream 6 Bold")

#### S-Core Dream (에스코어 드림) 정확한 매핑

| 굵기 | font-family 이름 | font-weight 값 |
|---|---|---|
| Thin | `"S-Core Dream 1 Thin"` | 100 |
| ExtraLight | `"S-Core Dream 2 ExtraLight"` | 200 |
| Light | `"S-Core Dream 3 Light"` | 300 |
| Regular | `"S-Core Dream 4 Regular"` | 400 |
| Medium | `"S-Core Dream 5 Medium"` | 500 |
| Bold | `"S-Core Dream 6 Bold"` | 600 |
| ExtraBold | `"S-Core Dream 7 ExtraBold"` | 700 |
| Heavy | `"S-Core Dream 8 Heavy"` | 800 |
| Black | `"S-Core Dream 9 Black"` | 900 |

#### 권장 작성 패턴 — 굵기마다 별도 family-name 등록

같은 family-name + 다른 weight 로 묶는 일반적인 CSS 패턴은 HTML 렌더링에는 문제 없지만 **PPT로 변환되면 weight 정보가 손실되어 모든 텍스트가 같은 굵기로 보일 수 있다.** 안전한 방법:

```css
/* 굵기마다 별도 family-name 등록 */
@font-face {
  font-family: "S-Core Dream 2 ExtraLight";
  src: url("../fonts/SCDream2.otf") format("opentype");
}
@font-face {
  font-family: "S-Core Dream 4 Regular";
  src: url("../fonts/SCDream4.otf") format("opentype");
}
@font-face {
  font-family: "S-Core Dream 6 Bold";
  src: url("../fonts/SCDream6.otf") format("opentype");
}

/* 사용 시점에 정확한 family 이름을 직접 지정 */
body {
  font-family: "S-Core Dream 4 Regular", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
}
.title { font-family: "S-Core Dream 6 Bold", sans-serif; }
.thin-text { font-family: "S-Core Dream 2 ExtraLight", sans-serif; }
```

#### 다른 한글 폰트 예시 (Pretendard, Noto Sans KR 등)

각 폰트의 굵기별 정확한 family-name을 같은 방식으로 등록한다. 예:
- Pretendard: `"Pretendard Thin"`, `"Pretendard Light"`, `"Pretendard Regular"`, `"Pretendard SemiBold"`, `"Pretendard Bold"`, ...
- Noto Sans KR: `"Noto Sans KR Light"`, `"Noto Sans KR Regular"`, `"Noto Sans KR Medium"`, `"Noto Sans KR Bold"`, ...

#### 체크리스트

- [ ] 폰트 파일명(SCDream6.otf 등)을 CSS family-name에 그대로 쓰지 않았는가
- [ ] 굵기마다 별도 `@font-face` family-name으로 등록했는가
- [ ] 사용 시점에 정확한 PowerPoint 인식명을 family-name으로 지정했는가

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
| `ERR_FILE_NOT_FOUND` 폰트/CSS | headless Chrome 이 file:// 자산 차단 | html2pptx.cjs 가 기본으로 `--allow-file-access-from-files` 플래그 자동 부여 (1.x+). 그래도 fail 시 fonts/CSS 를 작업 디렉토리 안으로 복사 |
| `ENOENT` (이미지 경로 `%20` 포함) | `<img src="file:///...">` 의 percent-encoding 미디코드 | html2pptx.cjs 가 자동 `decodeURIComponent` (1.x+). 구버전이면 src 를 디코드한 절대경로로 |
| 폰트 이름은 맞는데 weight 가 다 같게 나옴 | PowerPoint 가 "Family + bold flag" 로 weight 변경 못 하는 폰트 (한국어 SCDream 등) | 아래 "한국어 weight-별 폰트 매핑" 섹션 참고 |
| `<div>` 안 raw text → 빌드 실패 (web-style HTML) | 외부에서 가져온 web-design HTML 이 pptx-skill 컨벤션 안 따름 | 아래 "웹스타일 HTML 어댑터" 섹션의 5-phase 전처리 적용 |

---

## 웹스타일 HTML 어댑터 (외부 HTML 변환 시)

웹디자인용 HTML (web-design idiom — `<div>` 안 raw text, 사진 background-image, pseudo-element 장식 등) 을 pptx-skill 에 그대로 던지면 검증에 막힌다. playwright DOM transform 으로 5단계 자동 변환하는 게 표준 어댑터 패턴.

작업 디렉토리에서 `wrap-text.cjs` 같은 전처리 스크립트를 만들어 각 슬라이드 HTML 을 playwright 로 열고 다음 phase 를 순서대로 적용:

| Phase | 동작 | 해결되는 증상 |
|---|---|---|
| **0. inline margin → padding** | span/b/strong/i/em/u 의 inline-style margin 을 padding 으로 변환. 클래스 기반 margin 은 인라인 0 으로 덮어쓰기. `[data-pptx-image]` 안은 건드리지 않음. | `Inline element <span> has margin-left` |
| **1. bg-image / pseudo 장식 — 면적 기반 분기** | 슬라이드 전체 대비 element 면적 비율 (`area ratio`) 로 3 갈래: <br>① **ratio ≥ 0.9 + 추출 가능한 단일 `url()`** → `<img>` 태그를 첫 자식으로 자동 삽입 + `background-image:none` + 필요 시 `position:relative` 부여. **캡처 마킹은 안 함** → 그 위 텍스트 자식들이 PPT 네이티브로 유지됨 (편집 가능). 풀블리드 표지 사진 + 텍스트 오버레이 패턴이 손 안 대고 정상 처리됨. <br>② **0.7 ≤ ratio < 0.9, 또는 ratio ≥ 0.9 인데 추출 불가능 (gradient·multiple·pseudo-only)** → `data-wrap-text-skip` 마커만 부여. 캡처 마킹하면 lint rule 16 위반(SKILL.md mode A 절대 금지 #22) 이라 수동 수정 필요. <br>③ **ratio < 0.7** → `data-pptx-image="true"` 부여 (기존 동작). 카드 안 부분 사진, gradient 오버레이, eyebrow 옆 데코 라인 등. | 사진 배경, gradient 오버레이, 데코 라인 누락 / 풀블리드 표지 위 텍스트가 이미지로 박제되는 부작용 |
| **2. 한국어 weight → Full Name (선택)** | 아래 "한국어 weight-별 폰트 매핑" 섹션 참고. SCDream 같은 다중 패밀리 폰트일 때만 적용. | PPT 가 폰트 fallback / 가짜 굵게 |
| **3. inline-only 직계자식 → `<p>`** | div 의 직계 children 이 모두 span/b/strong/i/em/u 이고 텍스트·블록 sibling 이 없으면 각 inline child 를 같은 클래스·인라인 스타일을 가진 `<p>` 로 교체. 부모의 flex column 같은 레이아웃 그대로 보존. | `<div class="toc-text"><span>...</span><span>...</span></div>` 같은 패턴에서 텍스트 누락 |
| **4. div 직계 raw text → `<p style="margin:0">`** | 직계 텍스트 노드가 있는 div 를 찾아 텍스트를 `<p>` 로 wrap. 블록 자식이 섞여있으면 텍스트 run 만 골라 wrap. | `DIV element contains unwrapped text` |

각 phase 는 모두 `el.closest('[data-pptx-image]')` 체크해서 캡처 영역 안은 건드리지 않는다.

⚠️ **주의 — 본 어댑터를 "lint 에러 우회 수단" 으로 쓰지 말 것.** lint 가 113개 떴다고 슬라이드 전체를 `data-pptx-image="true"` 로 감싸 PNG 캡처로 도망가면 SKILL.md 모드 A 절대 금지 #21 (차트 외 영역 캡처 포함 금지) 위반이다. html2pptx 가 descendants 를 processed 로 마킹해서 변환은 성공하더라도, 정책상 헤더·KPI·인사이트 같은 텍스트는 네이티브 PPTX 텍스트로 들어가야 PowerPoint 에서 편집 가능하다. 어댑터는 표·차트 컨테이너만 캡처로 두고 그 외 텍스트 위반을 수정하는 용도다. 캡처 범위는 항상 표·차트로 좁혀라.

전체 구현 예시는 skill 안에 들어있다 — `{SKILL_DIR}/scripts/wrap-text.cjs` 를 그대로 작업 디렉토리에 복사하거나 절대경로로 호출하면 된다. `node {SKILL_DIR}/scripts/wrap-text.cjs ./slides` 로 5단계 phase 를 일괄 적용한다. 이 스크립트는 내부에서 `bootstrap.cjs` 를 require 해서 playwright 를 자동 해결하므로 `node_modules` 가 없는 작업 디렉토리에서도 바로 돌아간다. SCDream 외 다른 폰트(Pretendard Static, Noto Sans KR Static 등) 는 스크립트 안 `SCDREAM_FULL` / `SCDREAM_RE` 를 그대로 갈아끼우면 된다.

---

## 한국어 weight-별 폰트 매핑 (PowerPoint 가 family-as-separate-font 로 인식하는 폰트)

한국어 디자인 폰트 (SCDream / 에스코어 드림, 프리텐다드 Static, 노토 Sans KR Static 등) 는 macOS 기준으로 한 family 안에 9개 weight 가 묶여있는데, **PowerPoint 가 각 weight 를 별도 family 처럼 인식**하는 경우가 있음. 이때 `fontFace="에스코어 드림"` + `bold=true` 로는 weight 변경 안 되고 faux-bold 만 적용되어 깨져 보임.

### 진단

```bash
# macOS — 설치된 폰트의 Family / Style / Full Name 확인
system_profiler SPFontsDataType | grep -i "스코어\|Dream" -A5

# Linux/Codex
fc-list :outline -f '%{fullname}\n' | grep -i dream
```

`Family` 와 `Full Name` 이 다르면(예: Family="에스코어 드림", Full Name="에스코어 드림 6 Bold") family-as-separate-font 케이스. PptxGenJS `fontFace` 에는 **Full Name** 을 넣어야 함.

### 해결 — wrap-text.cjs Phase 2 (위 어댑터의 일부)

playwright DOM transform 안에서:

```javascript
const SCDREAM_FULL = {
  100: 'S-Core Dream 1 Thin',
  200: 'S-Core Dream 2 ExtraLight',
  300: 'S-Core Dream 3 Light',
  400: 'S-Core Dream 4 Regular',
  500: 'S-Core Dream 5 Medium',
  600: 'S-Core Dream 6 Bold',
  700: 'S-Core Dream 7 ExtraBold',
  800: 'S-Core Dream 8 Heavy',
  900: 'S-Core Dream 9 Black'
};
const TARGET_RE = /^SCDream|^S-?Core/i;

document.querySelectorAll('*').forEach(el => {
  if (el.closest('[data-pptx-image]')) return; // 캡처 영역은 원본 SCDream + @font-face 그대로
  const cs = getComputedStyle(el);
  const first = (cs.fontFamily || '').split(',')[0].replace(/['"]/g, '').trim();
  if (!TARGET_RE.test(first)) return;
  let w = parseInt(cs.fontWeight, 10);
  if (!isFinite(w)) w = 400;
  const bucket = Math.max(100, Math.min(900, Math.round(w / 100) * 100));
  el.style.fontFamily = `"${SCDREAM_FULL[bucket]}"`;
  el.style.fontWeight = '400';  // pptx-skill 의 합성 bold (≥600) 검출 회피
});
```

핵심:
- `font-family` 는 weight 별 Full Name 으로 강제
- `font-weight: 400` 으로 reset → pptx-skill 이 합성 bold 플래그 안 붙임 (faux-bold 방지)
- `[data-pptx-image]` 안은 건드리지 않음 — 그쪽은 PNG 라스터, CSS @font-face 가 SCDream 으로 정상 렌더

다른 폰트 (프리텐다드 Static, 노토 Sans KR Static 등) 도 같은 패턴으로 SCDREAM_FULL 자리에 해당 매핑 테이블만 갈아끼우면 됨.

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
