#!/usr/bin/env node
/**
 * audit-fix.cjs — Auto-remediate text chunks reported by audit-content.cjs
 *
 * Strategy:
 *   Pass A (default) — Tag rename: change the offending element's tag to <p>,
 *                      preserving classes/inline styles/children. Class-based
 *                      CSS keeps the visual styling. Most cases of "tag outside
 *                      pptx-skill textTags whitelist" (blockquote, dt, dd,
 *                      figcaption, details, summary, custom components) resolve
 *                      with this single change.
 *   Pass B (fallback) — Capture marking: set data-pptx-image="true" on the
 *                       element so its region gets PNG-rasterized at convert
 *                       time. Used when Pass A isn't safe or didn't resolve
 *                       on a re-audit.
 *
 * Usage:
 *   node audit-fix.cjs <slides-dir> <missing.json> [--mode=A|B] [--reaudit-pptx=output.pptx]
 *
 * Default mode is A. Caller (e.g. SKILL.md Step 5) typically does:
 *   1. node audit-content.cjs slides-x out.pptx --json=miss1.json
 *   2. (if missing) node audit-fix.cjs slides-x miss1.json --mode=A
 *   3. rerun convert
 *   4. node audit-content.cjs slides-x out.pptx --json=miss2.json
 *   5. (if still missing) node audit-fix.cjs slides-x miss2.json --mode=B
 *   6. rerun convert
 *   7. node audit-content.cjs (final report)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const bootstrapPath = [
  '/mnt/skills/user/pptx-skill/scripts/bootstrap.cjs',
  path.join(os.homedir(), '.claude/skills/pptx-skill/scripts/bootstrap.cjs')
].find(p => fs.existsSync(p));
if (!bootstrapPath) { console.error('bootstrap.cjs not found'); process.exit(2); }
require(bootstrapPath);
const { chromium } = require('playwright');

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

async function applyFix(slidesDir, missing, mode) {
  // Group missing chunks per slide
  const bySlide = {};
  for (const m of missing) {
    if (!bySlide[m.slide]) bySlide[m.slide] = [];
    bySlide[m.slide].push(m);
  }

  const launchOptions = {
    args: ['--allow-file-access-from-files'],
    ...(process.platform === 'darwin' ? { channel: 'chrome' } : {})
  };
  const browser = await chromium.launch(launchOptions);
  let appliedCount = 0;
  try {
    for (const [slideFile, chunks] of Object.entries(bySlide)) {
      const filePath = path.resolve(path.join(slidesDir, slideFile));
      const page = await browser.newPage();
      await page.goto('file://' + filePath);
      await page.waitForLoadState('networkidle');

      const summary = await page.evaluate(({ chunks, mode }) => {
        // For each chunk, find the smallest element whose textContent matches.
        // Strategy: iterate elements and check if normalized textContent EQUALS
        // the chunk text. That gives the exact target. Fall back to "contains"
        // if no exact match.
        const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
        const TEXT_TAGS = new Set(['P','H1','H2','H3','H4','H5','H6','LI','UL','OL']);
        const applied = [];
        const skipped = [];

        function findTarget(chunk) {
          const want = norm(chunk.text);
          // Prefer matching by parentTag+parentClass+exact-text
          let candidates = [];
          if (chunk.parentTag) {
            const sel = chunk.parentClass
              ? `${chunk.parentTag}.${chunk.parentClass.split(/\s+/).filter(Boolean).join('.')}`
              : chunk.parentTag;
            try { candidates = [...document.querySelectorAll(sel)]; } catch (_) { candidates = []; }
          }
          if (!candidates.length) {
            candidates = [...document.querySelectorAll(chunk.parentTag || '*')];
          }
          // Exact match first
          let target = candidates.find(el => norm(el.textContent) === want);
          if (!target) {
            // Containment fallback — pick smallest container
            const containing = candidates.filter(el => norm(el.textContent).includes(want));
            if (containing.length) {
              containing.sort((a, b) => a.textContent.length - b.textContent.length);
              target = containing[0];
            }
          }
          if (!target) {
            // Last resort: walk all elements
            const all = [...document.querySelectorAll('*')]
              .filter(el => norm(el.textContent) === want);
            if (all.length) {
              all.sort((a, b) => a.textContent.length - b.textContent.length);
              target = all[0];
            }
          }
          return target;
        }

        for (const chunk of chunks) {
          const target = findTarget(chunk);
          if (!target) { skipped.push({ chunk: chunk.text.slice(0, 50), reason: 'no target' }); continue; }
          // Skip if target is already inside data-pptx-image
          if (target.closest && target.closest('[data-pptx-image]')) {
            skipped.push({ chunk: chunk.text.slice(0, 50), reason: 'already in capture' });
            continue;
          }

          if (mode === 'A') {
            const INLINE_TAGS = new Set(['B','STRONG','I','EM','U','SPAN','SMALL','SUB','SUP','MARK','CODE']);
            // Skip if target is already a textTag — rename to <p> would be a no-op
            if (TEXT_TAGS.has(target.tagName)) {
              skipped.push({ chunk: chunk.text.slice(0, 50), reason: `target is already <${target.tagName.toLowerCase()}>` });
              continue;
            }
            // Skip inline tags — converting them to <p> breaks parent flow.
            // After a sibling/parent fix renamed the containing block, the inline
            // tag is now inside a textTag and pptx-skill extracts it as a run automatically.
            if (INLINE_TAGS.has(target.tagName)) {
              skipped.push({ chunk: chunk.text.slice(0, 50), reason: `inline <${target.tagName.toLowerCase()}> — rely on parent textTag` });
              continue;
            }
            // Skip if any ancestor is a textTag — same reason
            let anc = target.parentElement;
            let hasTextAnc = false;
            while (anc && anc !== document.body) {
              if (TEXT_TAGS.has(anc.tagName)) { hasTextAnc = true; break; }
              anc = anc.parentElement;
            }
            if (hasTextAnc) {
              skipped.push({ chunk: chunk.text.slice(0, 50), reason: 'inside existing textTag ancestor' });
              continue;
            }
            const p = document.createElement('p');
            for (const attr of target.attributes) p.setAttribute(attr.name, attr.value);
            // Force margin:0 so <p> default margin doesn't shift layout
            const existing = p.getAttribute('style') || '';
            p.setAttribute('style', existing + (existing && !existing.endsWith(';') ? ';' : '') + 'margin:0;');
            while (target.firstChild) p.appendChild(target.firstChild);
            target.parentNode.replaceChild(p, target);
            applied.push({ chunk: chunk.text.slice(0, 50), action: `<${target.tagName.toLowerCase()}> → <p>` });
          } else if (mode === 'B') {
            // Pass B: mark for PNG capture. Use the target itself unless it's
            // a tiny inline; then walk up to a containing block.
            let captureTarget = target;
            while (captureTarget && (captureTarget.tagName === 'B' || captureTarget.tagName === 'SPAN' || captureTarget.tagName === 'STRONG')) {
              captureTarget = captureTarget.parentElement;
            }
            if (!captureTarget) captureTarget = target;
            captureTarget.setAttribute('data-pptx-image', 'true');
            applied.push({ chunk: chunk.text.slice(0, 50), action: `mark <${captureTarget.tagName.toLowerCase()}> for PNG capture` });
          }
        }
        return { applied, skipped, html: '<!DOCTYPE html>\n' + document.documentElement.outerHTML };
      }, { chunks, mode });

      await page.close();
      fs.writeFileSync(filePath, summary.html);
      appliedCount += summary.applied.length;
      console.log(`[${slideFile}] applied=${summary.applied.length} skipped=${summary.skipped.length}`);
      summary.applied.forEach(a => console.log(`  + ${a.action} :: "${a.chunk}…"`));
      summary.skipped.forEach(s => console.log(`  - SKIP (${s.reason}) :: "${s.chunk}…"`));
    }
  } finally {
    await browser.close();
  }
  return appliedCount;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node audit-fix.cjs <slides-dir> <missing.json> [--mode=A|B]');
    process.exit(2);
  }
  const slidesDir = args[0];
  const missingJson = args[1];
  const opts = Object.fromEntries(args.slice(2).map(a => {
    const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  }));
  const mode = (opts.mode || 'A').toUpperCase();
  if (!['A','B'].includes(mode)) { console.error('--mode must be A or B'); process.exit(2); }

  if (!fs.existsSync(slidesDir)) { console.error(`Not found: ${slidesDir}`); process.exit(2); }
  if (!fs.existsSync(missingJson)) { console.error(`Not found: ${missingJson}`); process.exit(2); }

  const missing = JSON.parse(fs.readFileSync(missingJson, 'utf8'));
  if (!Array.isArray(missing) || missing.length === 0) {
    console.log('Nothing to fix.');
    process.exit(0);
  }

  console.log(`=== Auto-fix pass ${mode} ===`);
  console.log(`Slides:  ${slidesDir}`);
  console.log(`Missing: ${missing.length}`);

  const applied = await applyFix(slidesDir, missing, mode);
  console.log(`\nApplied ${applied} fix(es). Re-run convert.cjs and audit-content.cjs to verify.`);
  process.exit(applied > 0 ? 0 : 1);
}

main().catch(e => { console.error('Fatal:', e.message || e); process.exit(2); });
