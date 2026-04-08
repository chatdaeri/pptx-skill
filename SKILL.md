---
name: pptx-skill
description: HTML 슬라이드를 PowerPoint(PPTX) 파일로 변환. PPTX 생성, 편집, 썸네일 생성이 필요할 때 사용.
---

# PPTX Skill - PowerPoint 변환 스킬

HTML 슬라이드를 PowerPoint 프레젠테이션 파일로 변환하는 스킬입니다.

## 기능 개요

### 1. 새 프레젠테이션 생성 (HTML → PPTX)
HTML 슬라이드 파일들을 PowerPoint로 변환

### 2. 기존 프레젠테이션 편집
PPTX 파일의 내용 수정

### 3. 썸네일 생성
프레젠테이션의 미리보기 이미지 생성

## HTML → PPTX 규격 변환 가이드

### px → pt 변환 기준

PPTX 슬라이드 규격은 720pt × 405pt (16:9)이다. 일반적인 웹용 HTML 슬라이드(1280×720px 등)를 PPTX용으로 작성할 때 아래 변환 비율을 적용한다.

| 레이아웃 | body 크기 (pt) | PptxGenJS layout 값 |
|---------|--------------|---------------------|
| 16:9 (기본) | 720pt × 405pt | `LAYOUT_16x9` |
| 4:3 | 720pt × 540pt | `LAYOUT_4x3` |
| 16:10 | 720pt × 450pt | `LAYOUT_16x10` |

| 원본 (px 기반) | PPTX (pt 기반) | 변환 비율 |
|---------------|---------------|---------|
| 1280px (폭) | 720pt | ×0.5625 |
| 720px (높이) | 405pt | ×0.5625 |

### 폰트 크기 변환

px → pt 변환 비율: **×0.45~0.50** (폰트는 단순 레이아웃 비율 ×0.5625보다 약간 작게 적용해야 가독성이 유지됨)

> **원칙**: 유저가 디자인 가이드를 제공하거나 참고할 디자인이 있는 경우, 해당 가이드의 폰트 크기를 변환 비율에 따라 적용한다. 아래 매핑은 **참고 디자인이 없을 때만** 사용하는 기본 예시이다.

| 용도 | 원본 px | PPTX pt (기본 예시) |
|------|--------|---------|
| 메인 타이틀 | 36~40px | 15~18pt |
| 서브 타이틀 | 22~26px | 9~11pt |
| 섹션 레이블 | 13~14px | 6~7pt |
| 소제목 | 16~18px | 7~8pt |
| 본문/테이블 | 13~14px | 6~7pt |
| 출처/주석 | 11~12px | 5~5.5pt |
| 페이지 번호 | 11px | 5pt |

### 간격/여백 변환

px → pt 변환 비율: **×0.5625** (레이아웃과 동일)

> **원칙**: 유저가 디자인 가이드를 제공하거나 참고할 디자인이 있는 경우, 해당 가이드의 간격/여백을 변환 비율에 따라 적용한다. 아래 매핑은 **참고 디자인이 없을 때만** 사용하는 기본 예시이다.

| 용도 | 원본 px | PPTX pt (기본 예시) |
|------|--------|---------|
| 슬라이드 패딩 (상) | 40px | 18~22pt |
| 슬라이드 패딩 (좌/우) | 50px | 26~28pt |
| 슬라이드 패딩 (하) | 30px | **최소 36pt (0.5인치)** — 하단 여백 필수 |
| 요소 간 간격 (대) | 24px | 10~12pt |
| 요소 간 간격 (소) | 8px | 3~4pt |

> **중요**: 하단 여백은 반드시 36pt(0.5인치) 이상 확보해야 한다. 이 영역을 침범하면 오버플로우 에러가 발생한다.

### 색상 코드 변환

CSS에서는 `#` 접두사를 사용하고, PptxGenJS에서는 `#`을 제거해야 한다. 예: `#2196F3` (HTML) → `2196F3` (PptxGenJS)

## 의존성 확인 (필수 - 작업 시작 전 반드시 실행)

스킬 사용 전 아래 스크립트를 실행하여 모든 의존성을 확인한다.
NODE_PATH를 자동 감지하므로 Claude Code CLI / Claude Desktop 양쪽에서 동작한다.

```bash
bash ~/.claude/skills/pptx-skill/scripts/check-deps.sh
```

누락된 항목이 있으면 출력된 설치 명령을 실행하여 해결한다. 모두 OK가 나오면 다음 단계로 진행한다.

## NODE_PATH 설정 (중요)

Node.js 글로벌 패키지를 변환 스크립트에서 찾으려면 NODE_PATH가 필요하다.
변환 스크립트(.cjs) 작성 시 상단에 아래 코드를 반드시 포함한다:

```javascript
// NODE_PATH 자동 감지 (Claude Code CLI / Claude Desktop 양쪽 대응)
const { execSync } = require('child_process');
if (!process.env.NODE_PATH) {
  try {
    process.env.NODE_PATH = execSync('npm root -g', { encoding: 'utf8' }).trim();
    require('module').Module._initPaths();
  } catch (e) {}
}
```

또는 실행 시 환경변수를 지정한다:
```bash
NODE_PATH=$(npm root -g) node convert.cjs
```

## 핵심 워크플로우

### HTML → PPTX 변환

> **⚡ 빠른 시작**: 변환 스크립트를 처음부터 작성하지 말고 템플릿을 복사해서 시작한다.
> 템플릿에 자주 발생하는 실수 체크리스트가 주석으로 포함되어 있다.

1. **의존성 확인**
   ```bash
   bash ~/.claude/skills/pptx-skill/scripts/check-deps.sh
   ```

2. **변환 스크립트 템플릿 복사**
   ```bash
   # Claude.ai 환경
cp /mnt/skills/user/pptx-skill/templates/convert-template.cjs convert.cjs
# Claude Code CLI 환경
# cp ~/.claude/skills/pptx-skill/templates/convert-template.cjs convert.cjs
   ```
   템플릿 상단의 체크리스트를 반드시 읽고 HTML 작성에 반영한다.

3. **HTML 슬라이드 작성 + 즉시 검증 (1개씩 반복)**

   **중요: 슬라이드를 여러 개 한꺼번에 만들고 나중에 검증하지 않는다.**
   1개 작성 → 즉시 검증 → 통과 → 다음 슬라이드 작성 순서로 진행해야
   에러가 누적되지 않아 전체 작업 시간이 크게 단축된다.

   ```bash
   # 슬라이드 1개 작성 후 바로 검증
   bash ~/.claude/skills/pptx-skill/scripts/validate-html.sh slides/slide-01.html

   # 통과 확인 후 다음 슬라이드 작성 → 검증
   bash ~/.claude/skills/pptx-skill/scripts/validate-html.sh slides/slide-02.html
   ```

   검증 시 확인되는 항목:
   - `<td>`, `<th>` 안에 `<p>` 없이 직접 텍스트가 있으면 PPTX에서 누락됨
   - CSS gradient가 background에 사용되면 PPTX에서 변환 안됨
   - body 크기가 720pt × 405pt인지 확인

   **validate-html.sh가 잡지 못하지만 변환 시 에러를 유발하는 항목:**
   - `<p>`, `<h1>`-`<h6>` 태그에 `border`, `background`, `box-shadow` 사용 → `<div>`로 감싸서 해결
   - 텍스트 앞에 수동 불릿 기호 (●, ■, ▪, •, -, *) → `<ul>/<ol>` 사용
   - `<span>` 안에 불릿 기호를 넣어도 에러 발생 (예: `<span>●</span> 제목`)
   
   > **주의**: CONFIG.slidesDir로 지정한 폴더에는 PPTX 변환 대상 HTML 파일만 넣는다. 웹 미리보기용 HTML(브라우저 확인용, px 기반)은 해당 폴더 바깥에 보관한다. 같은 폴더에 섞이면 중복 변환된다.
   
4. **convert.cjs 수정 후 실행**
   ```bash
   NODE_PATH=$(npm root -g) node convert.cjs
   ```

5. **결과 검증 (썸네일)**
   ```bash
   python3 ~/.claude/skills/pptx-skill/scripts/thumbnail.py output.pptx thumbnail --cols 5
   ```

### html2pptx() 반환값

html2pptx()는 `{ slide, placeholders }` 객체를 반환한다. placeholders가 배열이 아니라 객체 속성이므로 주의한다.

```javascript
// ✅ 올바른 사용
const result = await html2pptx('slide.html', pptx);
const placeholders = result.placeholders || [];
const chartPos = placeholders.find(p => p.id === 'my-chart');

// ❌ 잘못된 사용 — placeholders.find is not a function 에러 발생
const placeholders = await html2pptx('slide.html', pptx);
placeholders.find(p => p.id === 'my-chart');
```

## 스크립트 사용법

### check-deps.sh
의존성 전체 확인 (Node.js, Python, 시스템 도구, Playwright 브라우저)

```bash
bash ~/.claude/skills/pptx-skill/scripts/check-deps.sh
```

### validate-html.sh
HTML 슬라이드 변환 전 검증 (텍스트 태그 누락, gradient 사용, body 크기)

```bash
# 단일 파일
bash ~/.claude/skills/pptx-skill/scripts/validate-html.sh slides/slide-01.html

# 디렉토리 전체
bash ~/.claude/skills/pptx-skill/scripts/validate-html.sh slides/
```

### html2pptx.cjs
HTML 파일들을 PPTX로 변환. **직접 작성하지 말고 변환 템플릿을 복사해서 CONFIG만 수정하는 것을 권장한다** (하단 "변환 템플릿" 섹션 참조).

수동 작성이 필요한 경우 아래 패턴을 따른다:

```javascript
const result = await html2pptx('slide.html', pptx);
// ⚠ 반환값은 { slide, placeholders } 객체
const placeholders = result.placeholders || [];
```

### thumbnail.py
프레젠테이션 썸네일 그리드 생성 (LibreOffice + Poppler 사용)

```bash
python3 ~/.claude/skills/pptx-skill/scripts/thumbnail.py presentation.pptx output-thumbnail
```

옵션:
- `--cols N`: 열 수 (기본 5, 범위 3-6)

### pack.py / unpack.py
PPTX 파일 패키징/언패키징

```bash
# 언패킹
python .claude/skills/pptx-skill/ooxml/scripts/unpack.py presentation.pptx output_dir

# 패킹
python .claude/skills/pptx-skill/ooxml/scripts/pack.py input_dir presentation.pptx
```

### validate.py
PPTX 구조 검증

```bash
python .claude/skills/pptx-skill/ooxml/scripts/validate.py unpacked_dir --original presentation.pptx
```

## 상세 문서

- [html2pptx.md](html2pptx.md) - HTML to PPTX 변환 상세 가이드
- [ooxml.md](ooxml.md) - Office Open XML 기술 참조

## PptxGenJS 핵심 규칙

### 색상 코드
```javascript
// 올바른 사용 - # 없이
{ color: 'FF0000' }

// 잘못된 사용 - 파일 손상 유발
{ color: '#FF0000' }
```

### 슬라이드 추가
```javascript
const slide = pres.addSlide();

// 텍스트 추가
slide.addText('제목', {
  x: 0.5,
  y: 0.5,
  w: 9,
  h: 1,
  fontSize: 36,
  color: '1a1a2e',
  bold: true
});

// 이미지 추가
slide.addImage({
  path: 'image.png',
  x: 1,
  y: 2,
  w: 4,
  h: 3
});

// 도형 추가
slide.addShape(pres.ShapeType.rect, {
  x: 0.5,
  y: 1,
  w: 3,
  h: 2,
  fill: { color: '1e3a5f' }
});
```

### 차트 추가
```javascript
// 막대 차트
slide.addChart(pres.ChartType.bar, [
  {
    name: '시리즈 1',
    labels: ['A', 'B', 'C'],
    values: [10, 20, 30]
  }
], {
  x: 1,
  y: 2,
  w: 8,
  h: 4
});

// 원형 차트
slide.addChart(pres.ChartType.pie, [...], {...});

// 선형 차트
slide.addChart(pres.ChartType.line, [...], {...});
```

## 전체 변환 프로세스

```
┌─────────────────┐
│   HTML 슬라이드  │
│   slides/*.html │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  html2pptx.js   │
│  (Playwright +  │
│   PptxGenJS)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   PPTX 파일     │
│ presentation.   │
│     pptx        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  thumbnail.py   │
│  (미리보기)     │
└─────────────────┘
```

## 의존성

### Node.js (글로벌 설치, NODE_PATH=/opt/homebrew/lib/node_modules)
- **pptxgenjs**: PowerPoint 생성
- **playwright**: 브라우저 렌더링
- **sharp**: 이미지 처리

### Python (pip3)
- **pillow**: 이미지 처리 (썸네일 그리드 생성)

### 시스템 (brew)
- **LibreOffice** (`soffice`): PPTX → PDF 변환
- **Poppler** (`pdftoppm`): PDF → 이미지 변환

## 주의사항

1. **색상 코드**: PptxGenJS에서 # 접두사 사용 금지
2. **폰트**: 웹 안전 폰트만 사용
3. **텍스트**: p, h1-h6, ul, ol 태그만 변환됨
4. **그라데이션**: CSS 그라데이션은 이미지로 대체
5. **검증**: 변환 후 반드시 썸네일로 확인

## 레이아웃 작성 전략

### flex → absolute positioning 단계적 전환

HTML 슬라이드 작성 시 레이아웃 방식은 다음 순서로 시도한다.

**1단계: flex 레이아웃으로 시작**
간단한 구조(요소 3~4개 이하, 단일 컬럼)는 flex로 충분하다.

```html
<div style="display: flex; gap: 12pt;">
  <div style="width: 330pt;">좌측</div>
  <div style="width: 330pt;">우측</div>
</div>
```

**2단계: 오버플로우 발생 시 absolute positioning으로 전환**
flex 레이아웃에서 오버플로우 에러가 반복되면 absolute positioning으로 전환한다. 특히 다음 경우에 absolute가 안정적이다:
- 2단 이상 복합 레이아웃 (정보박스 + 차트 등)
- 요소가 5개 이상인 복잡한 슬라이드
- 바 차트처럼 높이를 정밀하게 제어해야 하는 경우

```html
<!-- absolute positioning 예시 -->
<div style="position: absolute; top: 80pt; left: 26pt; width: 330pt;">
  <p>좌측 콘텐츠</p>
</div>
<div style="position: absolute; top: 80pt; left: 370pt; width: 324pt;">
  <p>우측 콘텐츠</p>
</div>
```

**absolute positioning 사용 시 주의점:**
- 모든 요소의 bottom 좌표가 369pt(= 405pt - 36pt 하단여백) 이하인지 확인
- width를 반드시 명시해야 텍스트 줄바꿈이 예측 가능
- 하단 고정 요소(시사점 박스, 페이지 번호)는 `bottom: 38pt` 이상으로 설정

## 불릿(Bullet) 스타일 가이드

### 수동 불릿 기호 사용 금지

`●`, `■`, `▪`, `•`, `-`, `*` 등 수동 불릿 기호를 텍스트에 직접 넣으면 변환 시 에러가 발생한다. `<span>` 안에 넣어도 동일하게 에러가 발생한다. 반드시 `<ul>` / `<ol>` 태그를 사용한다.

```html
<!-- ❌ 금지: 수동 불릿 -->
<p>● 항목 1</p>
<p>■ 항목 2</p>
<p><span>●</span> 항목 3</p>

<!-- ✅ 올바른 사용: ul/li -->
<ul>
  <li>항목 1</li>
  <li>항목 2</li>
</ul>
```

### 불릿 스타일 커스터마이징

`<ul>`을 사용하면 PPTX에서 기본 원형 불릿(•)이 적용된다. 불릿 스타일을 변경하려면 다음 방법을 사용한다.

**방법 1: CSS list-style-type (권장)**
```html
<!-- 원형 불릿 (기본) -->
<ul style="list-style: disc;"><li>항목</li></ul>

<!-- 사각형 불릿 -->
<ul style="list-style: square;"><li>항목</li></ul>

<!-- 불릿 없음 (텍스트만) -->
<ul style="list-style: none;"><li>항목</li></ul>
```

**방법 2: 불릿 없는 리스트 + 텍스트 내 기호 (우회)**
특수 불릿이 꼭 필요하면, list-style을 none으로 하고 li 텍스트 안에서 처리한다.
단, `<li>` 태그의 텍스트 시작이 `●`, `■`, `▪`, `•`, `-`, `*` 이면 에러가 발생하므로, 반드시 일반 텍스트로 시작해야 한다.

```html
<!-- 커스텀 기호가 필요한 경우 -->
<ul style="list-style: none; padding-left: 0;">
  <li>  항목 1</li>  <!-- 공백+유니코드 조합 -->
</ul>
```

> **참고**: 대부분의 경우 `list-style: disc` (원형) 또는 `list-style: none` (불릿 없음)으로 충분하다. 커스텀 불릿은 PPTX 변환 후 결과를 반드시 썸네일로 확인할 것.

## 자주 발생하는 에러 & 즉시 해결법

| 에러 메시지 / 증상 | 원인 | 해결 |
|---|---|---|
| `Text element <p> starts with bullet symbol` | `<p>● 제목</p>` 또는 `<p><span>●</span> 제목</p>` | `<ul><li>제목</li></ul>` 로 변경하거나, 불릿 기호 자체를 제거 |
| `Text element <p> has border` | `<p style="border-bottom:...">` | `<div style="border-bottom:..."><p>텍스트</p></div>` 로 감싸기 |
| `placeholders.find is not a function` | `html2pptx()` 반환값을 바로 배열로 사용 | `const result = await html2pptx(...)` 후 `result.placeholders` 로 접근 |
| `color: '#FF0000'` → 파일 손상 | PptxGenJS에서 # 접두사 사용 | `color: 'FF0000'` (# 제거) |
| 텍스트가 PPTX에 안 나옴 | `<div>텍스트</div>` (p 태그 없음) | `<div><p>텍스트</p></div>` |
| `<td>` 안 텍스트 누락 | `<td>내용</td>` | `<td><p>내용</p></td>` |
| HTML dimensions don't match | body 크기가 720pt × 405pt 아님 | `body { width: 720pt; height: 405pt; }` 확인 |
| HTML content overflows body | 콘텐츠가 body 영역 초과 | 하단 여백 36pt 이상 확보, absolute 요소 bottom ≥ 38pt |

## 변환 템플릿

변환 스크립트를 처음부터 작성하지 않고, 아래 템플릿을 복사해서 사용한다.
**CONFIG 객체만 수정하면 어떤 HTML 슬라이드든 변환 가능하다.**

```bash
# Claude.ai 환경
cp /mnt/skills/user/pptx-skill/templates/convert-template.cjs convert.cjs
# Claude Code CLI 환경
# cp ~/.claude/skills/pptx-skill/templates/convert-template.cjs convert.cjs
```

### CONFIG 설정 방법

```javascript
const CONFIG = {
  slidesDir: './slides',         // HTML 파일 디렉토리 (파일명 순 = 슬라이드 순)
  output: './output.pptx',       // 출력 파일 경로
  layout: 'LAYOUT_16x9',        // 슬라이드 비율
  charts: {                      // placeholder id → 차트 데이터 매핑 (없으면 {})
    'my-chart-id': {
      type: 'LINE',              // LINE | BAR | PIE | SCATTER
      data: [{ name: '시리즈', labels: ['A','B'], values: [10,20] }],
      options: { chartColors: ['2196F3'], showLegend: false }
    }
  }
};
```

### 동작 방식
1. `slidesDir` 안의 `.html` 파일을 파일명 정렬 순서대로 자동 수집
2. 각 HTML을 순차적으로 `html2pptx()`로 변환
3. 변환된 슬라이드에 `class="placeholder"` 요소가 있고 CONFIG.charts에 해당 id가 있으면 네이티브 차트 자동 삽입
4. 최종 PPTX 저장

템플릿 위치:
- Claude.ai: `/mnt/skills/user/pptx-skill/templates/convert-template.cjs`
- Claude Code CLI: `~/.claude/skills/pptx-skill/templates/convert-template.cjs`
