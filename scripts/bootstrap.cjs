/**
 * pptx-skill bootstrap
 * -----------------------------------------------------------------
 * 변환 스크립트(convert.cjs) 상단에서 아래 3줄 블록으로 로드:
 *
 *   const fs = require('fs'), path = require('path');
 *   const bootstrapPath = [
 *     '/mnt/skills/user/pptx-skill/scripts/bootstrap.cjs',
 *     path.join(process.env.HOME || '', '.claude/skills/pptx-skill/scripts/bootstrap.cjs')
 *   ].find(p => fs.existsSync(p));
 *   const { html2pptx, pptxgen } = require(bootstrapPath);
 *
 *   const pptx = new pptxgen();
 *   pptx.layout = 'LAYOUT_16x9';
 *   await html2pptx('slides/slide-01.html', pptx);
 *   await pptx.writeFile({ fileName: 'output.pptx' });
 *
 * 이 파일(bootstrap.cjs)이 담당하는 일:
 *  1. NODE_PATH 자동 감지 (npm root -g) → 글로벌 모듈 require 가능
 *  2. html2pptx.cjs 경로 자동 해결 (Claude Desktop /mnt/... + Claude Code CLI ~/.claude/...)
 *  3. html2pptx + pptxgen 객체를 한 번에 리턴
 *
 * 주의: bootstrap.cjs 자체의 경로는 환경에 따라 다르므로 convert.cjs가
 * 3줄 블록으로 후보 경로를 탐색 후 require해야 한다 (위 예시 참조).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 1) NODE_PATH 자동 감지
if (!process.env.NODE_PATH) {
  try {
    process.env.NODE_PATH = execSync('npm root -g', { encoding: 'utf8' }).trim();
    require('module').Module._initPaths();
  } catch (e) {
    // 무시: 이후 require 실패 시 에러가 자연스럽게 드러남
  }
}

// 2) html2pptx.cjs 경로 해결
const CANDIDATES = [
  '/mnt/skills/user/pptx-skill/scripts/html2pptx.cjs',
  path.join(process.env.HOME || '', '.claude/skills/pptx-skill/scripts/html2pptx.cjs'),
];
const html2pptxPath = CANDIDATES.find(p => p && fs.existsSync(p));
if (!html2pptxPath) {
  throw new Error(
    'html2pptx.cjs not found. Checked:\n  ' + CANDIDATES.join('\n  ')
  );
}

// 3) 한 번에 export
module.exports = {
  html2pptx: require(html2pptxPath),
  pptxgen: require('pptxgenjs'),
  html2pptxPath,  // 디버깅용
};
