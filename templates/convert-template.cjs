/**
 * HTML → PPTX 범용 변환 템플릿
 *
 * ============================================================
 * 사용법:
 *   1. 템플릿을 작업 디렉토리에 복사
 *      cp <skill-path>/templates/convert-template.cjs convert.cjs
 *
 *   2. 아래 CONFIG만 수정하고 실행
 *      NODE_PATH=$(npm root -g) node convert.cjs
 *
 *   3. slides/ 디렉토리에 HTML 파일을 넣으면 파일명 순서대로 변환
 *      slides/slide-01-cover.html  → 1번 슬라이드
 *      slides/slide-02-part1.html  → 2번 슬라이드
 *      slides/slide-03-data.html   → 3번 슬라이드
 *      (파일명은 자유, 정렬 순서가 곧 슬라이드 순서)
 * ============================================================
 *
 * ■ HTML 작성 시 반드시 지킬 것:
 *
 *   [텍스트]
 *   1. 모든 텍스트는 <p>, <h1>-<h6>, <ul>, <ol> 안에 작성
 *      ❌ <div>텍스트</div>  →  ✅ <div><p>텍스트</p></div>
 *   2. <td>/<th> 안에 텍스트도 반드시 <p> 태그로 감싸기
 *   3. 수동 불릿 기호 금지 (●, ■, ▪, •, -, * 등) — <span> 안에 넣어도 안 됨
 *      ❌ <p>● 항목</p>  →  ✅ <ul style="list-style: disc;"><li>항목</li></ul>
 *
 *   [스타일]
 *   4. <p>, <h1>-<h6> 태그에 background, border, box-shadow 사용 금지
 *      → <div>로 감싸서 div에 적용
 *   5. CSS gradient 금지 → Sharp로 PNG 렌더 후 <img> 사용
 *   6. 폰트: 웹 안전 폰트만 (Arial, Helvetica, Georgia, Verdana, Tahoma 등)
 *
 *   [레이아웃]
 *   7. body 크기: width: 720pt; height: 405pt (16:9)
 *   8. 하단 여백 36pt 이상 확보 (absolute 요소는 bottom ≥ 38pt)
 *   9. 복잡한 레이아웃(5개+ 요소, 2단 이상)은 absolute positioning 권장
 *
 *   [변환 스크립트]
 *  10. PptxGenJS 색상 코드에 # 금지: { color: 'FF0000' }
 *  11. html2pptx() 반환값: { slide, placeholders } (배열 아님)
 */

// ── CONFIG (이 부분만 수정) ──────────────────────────────
const CONFIG = {
  slidesDir: './slides',           // HTML 슬라이드 디렉토리
  output: './output.pptx',         // 출력 파일 경로
  layout: 'LAYOUT_16x9',          // LAYOUT_16x9 | LAYOUT_4x3 | LAYOUT_16x10

  // placeholder id별 차트 데이터 (없으면 빈 객체 {})
  // HTML에서 <div class="placeholder" id="chart-1"> 로 영역 지정 → 여기서 차트 삽입
  charts: {
    // 'chart-1': {
    //   type: 'LINE',   // LINE | BAR | PIE | SCATTER
    //   data: [{
    //     name: '시리즈명',
    //     labels: ['A', 'B', 'C'],
    //     values: [10, 20, 30]
    //   }],
    //   options: {        // PptxGenJS 차트 옵션 (# 없는 색상!)
    //     chartColors: ['2196F3'],
    //     showLegend: false,
    //     showValue: true,
    //     dataLabelColor: 'FFFFFF',
    //     dataLabelFontSize: 6,
    //     valAxisHidden: true,
    //     plotArea: { fill: { color: '1A1A1A' } }
    //   }
    // }
  }
};
// ──────────────────────────────────────────────────────────

// ── NODE_PATH 자동 감지 ──
const { execSync } = require('child_process');
if (!process.env.NODE_PATH) {
  try {
    process.env.NODE_PATH = execSync('npm root -g', { encoding: 'utf8' }).trim();
    require('module').Module._initPaths();
  } catch (e) {}
}

const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');

// html2pptx 경로 자동 감지 (Claude.ai / Claude Code CLI 양쪽 대응)
const html2pptxPath = fs.existsSync('/mnt/skills/user/pptx-skill/scripts/html2pptx.cjs')
  ? '/mnt/skills/user/pptx-skill/scripts/html2pptx.cjs'
  : path.join(process.env.HOME, '.claude/skills/pptx-skill/scripts/html2pptx.cjs');
const html2pptx = require(html2pptxPath);

(async () => {
  const pptx = new pptxgen();
  pptx.layout = CONFIG.layout;

  // ── slides 디렉토리에서 HTML 파일 자동 수집 (파일명 순) ──
  const slidesDir = path.resolve(CONFIG.slidesDir);
  const htmlFiles = fs.readdirSync(slidesDir)
    .filter(f => f.endsWith('.html'))
    .sort()
    .map(f => path.join(slidesDir, f));

  if (htmlFiles.length === 0) {
    console.error(`ERROR: ${slidesDir} 에 HTML 파일이 없습니다.`);
    process.exit(1);
  }

  console.log(`${htmlFiles.length}개 슬라이드 변환 시작...`);

  // ── 슬라이드 순차 변환 ──
  for (const htmlFile of htmlFiles) {
    const fname = path.basename(htmlFile);
    const ts = Date.now();

    const result = await html2pptx(htmlFile, pptx);
    const placeholders = result.placeholders || [];

    // placeholder에 대응하는 차트가 CONFIG에 있으면 삽입
    if (placeholders.length > 0 && Object.keys(CONFIG.charts).length > 0) {
      const slide = pptx.slides[pptx.slides.length - 1];

      for (const ph of placeholders) {
        const chartDef = CONFIG.charts[ph.id];
        if (!chartDef) continue;

        const chartType = pptx.charts[chartDef.type];
        if (!chartType) {
          console.warn(`  WARNING: ${fname}: unknown chart type "${chartDef.type}" (id: ${ph.id})`);
          continue;
        }

        slide.addChart(chartType, chartDef.data, {
          x: ph.x, y: ph.y, w: ph.w, h: ph.h,
          ...chartDef.options
        });
        console.log(`  CHART: ${fname} -> "${ph.id}" (${chartDef.type})`);
      }
    }

    console.log(`  OK: ${fname} (${Date.now() - ts}ms)`);
  }

  // ── 파일 저장 ──
  const outputPath = path.resolve(CONFIG.output);
  await pptx.writeFile({ fileName: outputPath });
  console.log(`\nDONE: ${outputPath}`);
})();
