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

1. **의존성 확인**
   ```bash
   bash ~/.claude/skills/pptx-skill/scripts/check-deps.sh
   ```

2. **HTML 슬라이드 준비**
   - `slides/` 디렉토리에 HTML 파일들 확인
   - 각 파일이 720pt × 405pt (16:9) 규격인지 검증

3. **HTML 검증 (변환 전)**
   ```bash
   bash ~/.claude/skills/pptx-skill/scripts/validate-html.sh slides/
   ```
   - `<td>`, `<th>` 안에 `<p>` 없이 직접 텍스트가 있으면 PPTX에서 누락됨
   - CSS gradient가 background에 사용되면 PPTX에서 변환 안됨
   - body 크기가 720pt × 405pt인지 확인

4. **html2pptx.js 실행**
   ```bash
   NODE_PATH=$(npm root -g) node convert.cjs
   ```

5. **결과 검증 (썸네일)**
   ```bash
   python3 ~/.claude/skills/pptx-skill/scripts/thumbnail.py output.pptx thumbnail --cols 5
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
HTML 파일들을 PPTX로 변환. 변환 스크립트 작성 예시:

```javascript
// NODE_PATH 자동 감지
const { execSync } = require('child_process');
if (!process.env.NODE_PATH) {
  try {
    process.env.NODE_PATH = execSync('npm root -g', { encoding: 'utf8' }).trim();
    require('module').Module._initPaths();
  } catch (e) {}
}

const pptxgen = require('pptxgenjs');
const html2pptx = require(process.env.HOME + '/.claude/skills/pptx-skill/scripts/html2pptx.cjs');

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_16x9';

await html2pptx('slides/slide-01.html', pptx);
await html2pptx('slides/slide-02.html', pptx);

await pptx.writeFile({ fileName: 'output.pptx' });
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
