/**
 * bootstrap-patched.cjs
 * 
 * 기존 bootstrap.cjs와 동일한 { html2pptx, pptxgen } 인터페이스를 제공하되,
 * Linux(Claude Desktop) 환경에서 Playwright viewport 버그를 우회한 html2pptx를 반환.
 * 
 * macOS(Claude Code) → 원본 bootstrap.cjs 그대로 사용 (버그 없음)
 * Linux(Claude Desktop) → html2pptx-patched.cjs 사용
 * 
 * 사용법 (convert.cjs 상단):
 *   const { html2pptx, pptxgen } = require('./bootstrap-patched.cjs');
 */

const fs = require('fs');
const path = require('path');

// 원본 bootstrap 로드 (NODE_PATH 설정 등 처리)
const bootstrapPath = [
  '/mnt/skills/user/pptx-skill/scripts/bootstrap.cjs',
  path.join(process.env.HOME || '', '.claude/skills/pptx-skill/scripts/bootstrap.cjs')
].find(p => fs.existsSync(p));

if (!bootstrapPath) throw new Error('pptx-skill bootstrap.cjs not found');

const original = require(bootstrapPath);

if (process.platform === 'darwin') {
  // Claude Code (macOS): 버그 없음 → 원본 그대로
  module.exports = original;
} else {
  // Claude Desktop (Linux): 패치된 html2pptx 사용
  const patchedPath = path.join(__dirname, 'html2pptx-patched.cjs');
  
  if (!fs.existsSync(patchedPath)) {
    throw new Error(
      'html2pptx-patched.cjs not found. ' +
      'Copy the original html2pptx.cjs and apply viewport patch first.'
    );
  }
  
  const patchedHtml2pptx = require(patchedPath);
  
  module.exports = {
    html2pptx: patchedHtml2pptx,
    pptxgen: original.pptxgen
  };
}
