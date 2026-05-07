#!/usr/bin/env node
/**
 * lint-html.cjs — 사전 HTML 린트
 *
 * html2pptx.cjs가 변환 중에 throw하는 규칙들을 converter를 돌리기 전에
 * 한 번에 모두 검사한다. Chromium 인스턴스를 한 번만 띄워 여러 슬라이드를
 * 순차 검사하므로 convert.cjs를 N번 재시도하는 것보다 훨씬 빠르다.
 *
 * 검사 규칙 (html2pptx.cjs와 동기화):
 *   1. body 크기: LAYOUT_16x9 (10" × 5.625")
 *   2. HTML 내용이 body를 overflow
 *   3. <div> 직계 자식에 unwrapped text
 *   4. inline 요소 (span/b/i/em/strong/u)에 margin-*
 *   5. text 요소 (<p>, <h1-6>, <ul>, <ol>, <li>)에 background/border/box-shadow
 *   6. text 요소가 수동 불릿 기호(•-*▪▸○●◆◇■□)로 시작
 *   7. CSS gradient 사용
 *   8. <div>에 background-image
 *   9. .placeholder 요소 width/height = 0
 *
 * 차트·표 디폴트(SVG→PNG 캡처) 모드 추가 룰:
 *  10. <table>/<th>/<td> 태그 사용 금지 (금지 #1·2·19)
 *  11. <div class="td"|"th"> 직계 자식에 unwrapped text (금지 #3)
 *  12. <div> 에 transform:rotate(...) 사용 (금지 #11)
 *  13. SVG <rect>/<polyline>/<circle> 이 [data-pptx-image] 컨테이너 밖에 있음 (금지 #12)
 *  14. SVG <rect height="0"> 또는 빈 polyline points (금지 #13)
 *  15. [data-pptx-image] 컨테이너 안에 <h1>/<h2> 헤딩 포함 (금지 #21)
 *
 * 사용법:
 *   node lint-html.cjs slides/               # slides/*.html 전부 검사
 *   node lint-html.cjs slides/slide-01.html  # 단일 파일 검사
 *
 * 종료 코드:
 *   0 = 통과
 *   1 = 린트 에러 존재
 *   2 = 실행 에러 (파일 없음 등)
 */

const fs = require('fs');
const path = require('path');

// bootstrap으로 playwright 로딩
const bootstrapPath = [
  '/mnt/skills/user/pptx-skill/scripts/bootstrap.cjs',
  path.join(process.env.HOME || '', '.claude/skills/pptx-skill/scripts/bootstrap.cjs')
].find(p => fs.existsSync(p));
if (!bootstrapPath) {
  console.error('Error: bootstrap.cjs not found');
  process.exit(2);
}
require(bootstrapPath); // NODE_PATH 세팅만 필요
const { chromium } = require('playwright');

// html2pptx.cjs의 상수들과 맞춤
const PX_PER_IN = 96;
const PT_PER_PX = 0.75;
const TARGET_WIDTH_IN = 10.0;
const TARGET_HEIGHT_IN = 5.625;

// ─── 메인 검증 함수 (page.evaluate 내에서 실행) ───
async function lintSlide(page, htmlFile) {
  const fileErrors = [];

  // 1. body 크기 체크
  const bodyDims = await page.evaluate(() => {
    const body = document.body;
    const style = window.getComputedStyle(body);
    return {
      width: parseFloat(style.width),
      height: parseFloat(style.height),
      scrollWidth: body.scrollWidth,
      scrollHeight: body.scrollHeight
    };
  });

  const widthIn = bodyDims.width / PX_PER_IN;
  const heightIn = bodyDims.height / PX_PER_IN;
  if (Math.abs(widthIn - TARGET_WIDTH_IN) > 0.1 || Math.abs(heightIn - TARGET_HEIGHT_IN) > 0.1) {
    fileErrors.push(
      `HTML dimensions (${widthIn.toFixed(1)}" × ${heightIn.toFixed(1)}") ` +
      `don't match LAYOUT_16x9 (${TARGET_WIDTH_IN}" × ${TARGET_HEIGHT_IN}")`
    );
  }

  // overflow 체크
  const widthOverflowPx = Math.max(0, bodyDims.scrollWidth - bodyDims.width - 1);
  const heightOverflowPx = Math.max(0, bodyDims.scrollHeight - bodyDims.height - 1);
  const widthOverflowPt = widthOverflowPx * PT_PER_PX;
  const heightOverflowPt = heightOverflowPx * PT_PER_PX;
  if (widthOverflowPt > 0 || heightOverflowPt > 0) {
    const directions = [];
    if (widthOverflowPt > 0) directions.push(`${widthOverflowPt.toFixed(1)}pt horizontally`);
    if (heightOverflowPt > 0) directions.push(`${heightOverflowPt.toFixed(1)}pt vertically`);
    const reminder = heightOverflowPt > 0 ? ' (leave 0.5" margin at bottom)' : '';
    fileErrors.push(`HTML content overflows body by ${directions.join(' and ')}${reminder}`);
  }

  // 2~9. DOM 순회 규칙 검사 (browser context에서 실행)
  const domErrors = await page.evaluate(() => {
    const errors = [];
    const textTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI'];
    const inlineTags = ['SPAN', 'B', 'STRONG', 'I', 'EM', 'U'];

    // body background gradient 체크
    const bodyStyle = window.getComputedStyle(document.body);
    const bgImage = bodyStyle.backgroundImage;
    if (bgImage && (bgImage.includes('linear-gradient') || bgImage.includes('radial-gradient'))) {
      errors.push(
        'CSS gradients are not supported on body. ' +
        'Rasterize gradients as PNG first, then use background-image: url(...).'
      );
    }

    // 모든 요소 순회
    document.querySelectorAll('*').forEach((el) => {
      const computed = window.getComputedStyle(el);
      const tag = el.tagName;

      // 규칙 5: text 요소에 background/border/shadow
      if (textTags.includes(tag)) {
        const hasBg = computed.backgroundColor && computed.backgroundColor !== 'rgba(0, 0, 0, 0)';
        const hasBorder =
          (computed.borderTopWidth && parseFloat(computed.borderTopWidth) > 0) ||
          (computed.borderRightWidth && parseFloat(computed.borderRightWidth) > 0) ||
          (computed.borderBottomWidth && parseFloat(computed.borderBottomWidth) > 0) ||
          (computed.borderLeftWidth && parseFloat(computed.borderLeftWidth) > 0);
        const hasShadow = computed.boxShadow && computed.boxShadow !== 'none';

        if (hasBg || hasBorder || hasShadow) {
          errors.push(
            `Text element <${tag.toLowerCase()}> has ${hasBg ? 'background' : hasBorder ? 'border' : 'shadow'}. ` +
            'Backgrounds, borders, and shadows are only supported on <div> elements, not text elements.'
          );
        }
      }

      // 규칙 4: inline 요소에 margin
      if (inlineTags.includes(tag)) {
        ['marginLeft', 'marginRight', 'marginTop', 'marginBottom'].forEach((prop) => {
          if (computed[prop] && parseFloat(computed[prop]) > 0) {
            const kebab = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
            errors.push(
              `Inline element <${tag.toLowerCase()}> has ${kebab} which is not supported in PowerPoint. ` +
              'Remove margin from inline elements.'
            );
          }
        });
      }

      // 규칙 3, 8: <div> 특화 검사
      if (tag === 'DIV' && !textTags.includes(tag)) {
        // unwrapped text (직계 자식 텍스트 노드)
        for (const node of el.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text) {
              errors.push(
                `DIV element contains unwrapped text "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}". ` +
                'All text must be wrapped in <p>, <h1>-<h6>, <ul>, or <ol> tags to appear in PowerPoint.'
              );
            }
          }
        }
        // background-image
        const divBg = computed.backgroundImage;
        if (divBg && divBg !== 'none') {
          errors.push(
            'Background images on DIV elements are not supported. ' +
            'Use solid colors/borders or slide.addImage() in PptxGenJS.'
          );
        }
      }

      // 규칙 6: 수동 불릿 기호
      if (textTags.includes(tag) && tag !== 'LI' && tag !== 'UL' && tag !== 'OL') {
        const text = (el.textContent || '').trim();
        if (text && /^[•\-\*▪▸○●◆◇■□]\s/.test(text)) {
          errors.push(
            `Text element <${tag.toLowerCase()}> starts with bullet symbol "${text.substring(0, 20)}...". ` +
            'Use <ul> or <ol> lists instead of manual bullet symbols.'
          );
        }
      }

      // 규칙 9: placeholder 크기 0
      if (el.className && typeof el.className === 'string' && el.className.includes('placeholder')) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          errors.push(
            `Placeholder "${el.id || 'unnamed'}" has ${rect.width === 0 ? 'width: 0' : 'height: 0'}. ` +
            'Check the layout CSS.'
          );
        }
      }

      // 규칙 10: <table>/<th>/<td> 태그 사용 금지 (금지 #1·2·19)
      // Exception: inside [data-pptx-image] container, the table is rasterized as PNG
      // so html2pptx never tries to convert it — table semantics are fine there.
      if ((tag === 'TABLE' || tag === 'TH' || tag === 'TD' || tag === 'THEAD' || tag === 'TBODY' || tag === 'TR') &&
          !el.closest('[data-pptx-image]')) {
        errors.push(
          `<${tag.toLowerCase()}> tag is not supported by html2pptx. ` +
          `Use <div class="t"> / <div class="tr"> / <div class="th"> / <div class="td"> with CSS grid instead, ` +
          `or wrap the table in a <div data-pptx-image="true"> container for SVG→PNG capture.`
        );
      }

      // 규칙 11: <div class="td"|"th"> 직계 자식 raw text (금지 #3)
      // Exception: inside [data-pptx-image], cells are rasterized as PNG so structure is preserved.
      const _cls = el.className && (typeof el.className === 'string' ? el.className : el.className.baseVal || '');
      if (tag === 'DIV' && _cls && (_cls.split(/\s+/).includes('td') || _cls.split(/\s+/).includes('th')) &&
          !el.closest('[data-pptx-image]')) {
        for (const node of el.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text) {
              errors.push(
                `<div class="${_cls}"> contains unwrapped text "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}". ` +
                'Cell text must be wrapped in <p>, <h1>-<h6>, <ul>, or <ol>.'
              );
            }
          }
        }
      }

      // 규칙 12: <div> 에 transform:rotate(...) (금지 #11 — 차트를 div 회전으로 그리는 패턴)
      if (tag === 'DIV') {
        const tf = computed.transform;
        if (tf && tf !== 'none' && /matrix|rotate/.test(tf)) {
          // 단순한 0도/identity 는 제외
          if (tf !== 'matrix(1, 0, 0, 1, 0, 0)') {
            errors.push(
              `<div> has CSS transform "${tf}". ` +
              'PPTX ignores div rotation — draw rotated charts as SVG inside a <div data-pptx-image="true"> container instead.'
            );
          }
        }
      }

      // 규칙 13: SVG <rect>/<polyline>/<circle> 이 [data-pptx-image] 밖에 있음 (금지 #12)
      if ((tag === 'rect' || tag === 'polyline' || tag === 'circle' || tag === 'path' || tag === 'line') &&
          el.namespaceURI === 'http://www.w3.org/2000/svg') {
        if (!el.closest('[data-pptx-image]')) {
          errors.push(
            `<svg ${tag}> at "${el.id || el.tagName}" is outside any [data-pptx-image] container. ` +
            'html2pptx does not convert SVG shapes to PPTX shapes — wrap the SVG in <div data-pptx-image="true"> for PNG capture.'
          );
        }
      }

      // 규칙 14: SVG <rect height="0"> / 빈 polyline points (금지 #13)
      if (tag === 'rect' && el.namespaceURI === 'http://www.w3.org/2000/svg') {
        const h = el.getAttribute('height');
        if (h !== null && parseFloat(h) === 0) {
          errors.push(
            `<rect> has height="0" — empty placeholder bars are not allowed. Delete unused <rect> elements entirely.`
          );
        }
      }
      if (tag === 'polyline' && el.namespaceURI === 'http://www.w3.org/2000/svg') {
        const pts = el.getAttribute('points');
        if (pts !== null && pts.trim() === '') {
          errors.push(
            `<polyline> has empty points — delete unused <polyline> elements entirely instead of leaving empty.`
          );
        }
      }

      // 규칙 15: [data-pptx-image] 컨테이너 안에 <h1>/<h2> 헤딩 (금지 #21)
      if ((tag === 'H1' || tag === 'H2') && el.closest('[data-pptx-image]')) {
        errors.push(
          `<${tag.toLowerCase()}> is inside a [data-pptx-image] container — title/header text would be rasterized as PNG and lose editability. ` +
          'Move headings outside the capture container so PPTX renders them as native text.'
        );
      }
    });

    // 중복 제거
    return [...new Set(errors)];
  });

  fileErrors.push(...domErrors);
  return fileErrors;
}

// ─── 파일 수집 ───
function collectHtmlFiles(input) {
  const stat = fs.statSync(input);
  if (stat.isFile()) {
    if (!input.endsWith('.html')) {
      throw new Error(`${input} is not an HTML file`);
    }
    return [path.resolve(input)];
  }
  if (stat.isDirectory()) {
    return fs.readdirSync(input)
      .filter((f) => f.endsWith('.html'))
      .sort()
      .map((f) => path.resolve(path.join(input, f)));
  }
  throw new Error(`${input} is neither file nor directory`);
}

// ─── 메인 ───
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('사용법: node lint-html.cjs <slides 디렉토리 또는 html 파일>');
    process.exit(2);
  }

  let files;
  try {
    files = collectHtmlFiles(args[0]);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(2);
  }

  if (files.length === 0) {
    console.error(`Error: HTML 파일을 찾을 수 없습니다 (${args[0]})`);
    process.exit(2);
  }

  console.log(`=== HTML 린트 (${files.length}개 파일) ===`);

  const launchOptions = {};
  if (process.platform === 'darwin') {
    launchOptions.channel = 'chrome';
  }

  const browser = await chromium.launch(launchOptions);
  const results = [];

  try {
    for (const file of files) {
      const page = await browser.newPage();
      await page.setViewportSize({ width: 960, height: 540 });
      try {
        await page.goto(`file://${file}`);
        const errors = await lintSlide(page, file);
        results.push({ file, errors });
      } catch (e) {
        results.push({ file, errors: [`Playwright error: ${e.message}`] });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  // 결과 출력
  let totalErrors = 0;
  for (const { file, errors } of results) {
    const rel = path.relative(process.cwd(), file);
    if (errors.length === 0) {
      console.log(`  OK [${rel}]`);
    } else {
      console.log(`  FAIL [${rel}] — ${errors.length}개 에러`);
      errors.forEach((err, i) => {
        console.log(`    ${i + 1}. ${err}`);
      });
      totalErrors += errors.length;
    }
  }

  console.log('');
  if (totalErrors === 0) {
    console.log('모든 슬라이드 통과. convert.cjs 실행 가능.');
    process.exit(0);
  } else {
    console.log(`총 ${totalErrors}개 에러. 수정 후 재린트하세요.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`Fatal: ${e.message}`);
  process.exit(2);
});
