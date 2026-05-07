#!/usr/bin/env node
/**
 * audit-content.cjs — Text completeness audit for built PPTX
 *
 * Compares text in source slide HTML files vs text inside the generated PPTX
 * to detect chunks that were silently dropped during conversion (e.g. text
 * inside HTML tags outside pptx-skill's textTags whitelist like <blockquote>,
 * <dt>, <dd>, <figcaption>, <details>, custom web components, etc).
 *
 * Usage:
 *   node audit-content.cjs <slides-dir> <output.pptx> [--threshold=20] [--json=missing.json]
 *
 * Threshold: minimum character count for a chunk to be reported as missing.
 *   Default 20 — rationale: short whitespace/punctuation/icon strings often
 *   normalize differently between HTML textContent and PPTX a:t runs and
 *   yield false positives.
 *
 * Output:
 *   - Console table of missing chunks with slide·tag·class·preview
 *   - Optional JSON manifest for downstream auto-fix:
 *     [{ slide, text, parentTag, parentId, parentClass, parentSelector }]
 *
 * Exit codes:
 *   0 = no missing chunks (or all under threshold)
 *   1 = missing chunks found
 *   2 = run error
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Boot pptx-skill so playwright resolves
const bootstrapPath = [
  '/mnt/skills/user/pptx-skill/scripts/bootstrap.cjs',
  path.join(os.homedir(), '.claude/skills/pptx-skill/scripts/bootstrap.cjs')
].find(p => fs.existsSync(p));
if (!bootstrapPath) { console.error('bootstrap.cjs not found'); process.exit(2); }
require(bootstrapPath);
const { chromium } = require('playwright');

// Lightweight JSZip to read PPTX
let JSZip;
try { JSZip = require('jszip'); } catch (e) {
  // Fallback to bash unzip
  JSZip = null;
}

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

async function extractExpected(slidesDir) {
  const files = fs.readdirSync(slidesDir).filter(f => f.endsWith('.html')).sort();
  if (files.length === 0) throw new Error(`No .html in ${slidesDir}`);
  const launchOptions = {
    args: ['--allow-file-access-from-files'],
    ...(process.platform === 'darwin' ? { channel: 'chrome' } : {})
  };
  const browser = await chromium.launch(launchOptions);
  const expected = [];
  try {
    for (const f of files) {
      const filePath = path.resolve(path.join(slidesDir, f));
      const page = await browser.newPage();
      await page.goto('file://' + filePath);
      await page.waitForLoadState('networkidle');
      const chunks = await page.evaluate(() => {
        // Walk all text nodes; for each, capture text + closest meaningful parent meta.
        // Skip: <style>/<script>/<title>; descendants of [data-pptx-image] (PNG capture).
        const SKIP_ANC = new Set(['STYLE','SCRIPT','TITLE','META','LINK','HEAD','HTML']);
        const result = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const seen = new Set();
        let node;
        while ((node = walker.nextNode())) {
          const raw = (node.textContent || '').replace(/\s+/g, ' ').trim();
          if (!raw) continue;
          // Walk ancestors to detect skip cases
          let p = node.parentElement;
          let inCapture = false;
          let inSkip = false;
          while (p && p !== document.documentElement) {
            if (SKIP_ANC.has(p.tagName)) { inSkip = true; break; }
            if (p.hasAttribute && p.hasAttribute('data-pptx-image')) { inCapture = true; break; }
            p = p.parentElement;
          }
          if (inSkip || inCapture) continue;

          const parent = node.parentElement;
          if (!parent) continue;

          // De-dup identical (text, parentTag) pairs at the same parent — TextWalker
          // sometimes splits adjacent runs; we want one entry per containing element.
          const dupKey = parent.outerHTML.length + ':' + raw;
          if (seen.has(dupKey)) continue;
          seen.add(dupKey);

          // Use the parent element's full textContent as the chunk to match —
          // pptx-skill emits a single text run per parent textTag, so this matches
          // the unit at which content gets dropped.
          const parentTextNorm = (parent.textContent || '').replace(/\s+/g, ' ').trim();
          if (!parentTextNorm) continue;

          // Build a robust selector for auto-fix
          const parentTag = parent.tagName.toLowerCase();
          const parentId = parent.id || '';
          const parentClass = (parent.className && (typeof parent.className === 'string'
            ? parent.className
            : parent.className.baseVal || '')) || '';

          result.push({
            text: parentTextNorm,
            parentTag,
            parentId,
            parentClass,
            // For locating the same element in the auto-fix step
            parentOuterHash: parent.outerHTML.length
          });
        }
        // Final de-dup at chunk level
        const seenText = new Set();
        return result.filter(r => {
          const k = r.text + '|' + r.parentTag + '|' + r.parentClass;
          if (seenText.has(k)) return false;
          seenText.add(k);
          return true;
        });
      });
      await page.close();
      chunks.forEach(c => expected.push({ slide: f, ...c }));
    }
  } finally {
    await browser.close();
  }
  return expected;
}

async function readPptxXmlBlob(pptxPath) {
  if (JSZip) {
    const buf = fs.readFileSync(pptxPath);
    const zip = await JSZip.loadAsync(buf);
    const slideFiles = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort();
    let blob = '';
    for (const n of slideFiles) {
      blob += await zip.files[n].async('string');
      blob += '\n';
    }
    return blob;
  }
  // Fallback: use unzip via node child_process
  const { execSync } = require('child_process');
  const tmp = path.join(os.tmpdir(), 'pptx-audit-' + Date.now());
  fs.mkdirSync(tmp, { recursive: true });
  execSync(`unzip -o -q "${pptxPath}" "ppt/slides/slide*.xml" -d "${tmp}"`);
  const dir = path.join(tmp, 'ppt', 'slides');
  const files = fs.readdirSync(dir).filter(f => /^slide\d+\.xml$/.test(f)).sort();
  let blob = '';
  for (const f of files) blob += fs.readFileSync(path.join(dir, f), 'utf8') + '\n';
  fs.rmSync(tmp, { recursive: true, force: true });
  return blob;
}

function extractActualText(xmlBlob) {
  // Pull every <a:t>...</a:t> text node.
  const matches = xmlBlob.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) || [];
  // Decode common XML entities
  const decode = (s) => s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  const text = matches.map(m => {
    const inner = m.replace(/^<a:t[^>]*>/, '').replace(/<\/a:t>$/, '');
    return decode(inner);
  }).join(' ');
  return norm(text);
}

function chunkInActual(chunk, actualNorm) {
  // Try substring; if not found, try without spaces (handles word-break differences)
  if (actualNorm.includes(chunk)) return true;
  const stripped = chunk.replace(/\s/g, '');
  const actualStripped = actualNorm.replace(/\s/g, '');
  if (actualStripped.includes(stripped)) return true;
  // Soft match: 80% of chunk's words appear consecutively
  return false;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node audit-content.cjs <slides-dir> <output.pptx> [--threshold=20] [--json=missing.json]');
    process.exit(2);
  }
  const slidesDir = args[0];
  const pptxPath = args[1];
  const opts = Object.fromEntries(args.slice(2).map(a => {
    const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  }));
  const threshold = parseInt(opts.threshold || '20', 10);

  if (!fs.existsSync(slidesDir)) { console.error(`Not found: ${slidesDir}`); process.exit(2); }
  if (!fs.existsSync(pptxPath)) { console.error(`Not found: ${pptxPath}`); process.exit(2); }

  console.log(`=== Content audit ===`);
  console.log(`Slides:    ${slidesDir}`);
  console.log(`PPTX:      ${pptxPath}`);
  console.log(`Threshold: ${threshold} chars`);

  const [expected, xmlBlob] = await Promise.all([
    extractExpected(slidesDir),
    readPptxXmlBlob(pptxPath)
  ]);
  const actual = extractActualText(xmlBlob);

  const missing = expected
    .filter(e => e.text.length >= threshold)
    .filter(e => !chunkInActual(e.text, actual));

  // De-dup missing by (slide, text)
  const seen = new Set();
  const uniqueMissing = [];
  for (const m of missing) {
    const k = m.slide + '|' + m.text;
    if (seen.has(k)) continue;
    seen.add(k);
    uniqueMissing.push(m);
  }

  console.log(`\nExpected chunks ≥${threshold}자: ${expected.filter(e => e.text.length >= threshold).length}`);
  console.log(`Missing:                ${uniqueMissing.length}`);

  if (uniqueMissing.length === 0) {
    console.log(`✅ 누락 없음.`);
    if (opts.json) fs.writeFileSync(opts.json, '[]');
    process.exit(0);
  }

  console.log('\n--- 누락 청크 ---');
  uniqueMissing.forEach((m, i) => {
    const preview = m.text.length > 80 ? m.text.slice(0, 80) + '…' : m.text;
    const cls = m.parentClass ? `.${m.parentClass.split(/\s+/).slice(0, 2).join('.')}` : '';
    console.log(`${String(i + 1).padStart(2)}. [${m.slide}] <${m.parentTag}${cls}> ${preview}`);
  });

  if (opts.json) {
    fs.writeFileSync(opts.json, JSON.stringify(uniqueMissing, null, 2));
    console.log(`\nManifest: ${opts.json}`);
  }
  process.exit(1);
}

main().catch(e => { console.error('Fatal:', e.message || e); process.exit(2); });
