#!/usr/bin/env node
/*
 * wrap-text.cjs — web-style HTML adapter for pptx-skill.
 *
 * Use when external HTML deck (web design idiom: <div>-only text, photo
 * backgrounds, ::before/::after decorations, multi-weight Korean fonts) needs
 * to be massaged into pptx-skill conventions before lint-html.cjs / html2pptx.cjs.
 * Opens each slide in playwright, runs 5 DOM-transform phases, overwrites in place.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CAPABILITY MANIFEST
 *
 * HANDLES (automatic, no caller action):
 *   - inline_margin_to_padding             span/b/strong/i/em/u inline margin
 *                                          → padding (or zero out class margin)
 *   - bg_image_full_bleed_to_img_tag       ratio ≥ 0.9 + single url() → insert
 *                                          <img> as first child, strip
 *                                          background-image, NO capture mark
 *                                          (text descendants stay PPT-native)
 *   - bg_image_partial_to_capture          ratio < 0.7 → data-pptx-image="true"
 *                                          (rasterize as PNG)
 *   - korean_font_weight_to_full_name      SCDream / 에스코어 드림 family +
 *                                          numeric weight → "에스코어 드림 N XXX"
 *                                          full font name + force weight=400
 *   - inline_only_children_to_p            <div> with only span/b/i/u kids
 *                                          → kids converted to <p> (preserves
 *                                          class + flex layout)
 *   - raw_text_to_p_wrap                   <div>direct text</div>
 *                                          → wrap text in <p style="margin:0">
 *
 * NOT HANDLED (caller must do separately):
 *   - raw_table_conversion                 → SKILL.md A2.2:
 *                                            mode A: wrap <table> in
 *                                                    <div data-pptx-image="true">
 *                                            mode B: replace <table> with
 *                                                    <div class="placeholder">
 *                                                    + slide.addTable()
 *   - px_to_pt_scaling                     → manual ×0.5625 conversion
 *                                            (e.g. dedicated split.cjs script)
 *   - mid_band_skip_resolution             → ratio 0.7–0.9 elements get
 *                                            data-wrap-text-skip marker.
 *                                            Manual <img> conversion required.
 *   - gradient_to_overlay_extraction       → manual <img> + overlay div
 *                                            (CSS gradient stays unrendered)
 *   - content_logic_rewriting              → out of scope
 *
 * STEP A2.0 TRIGGER SIGNALS (when to run this script):
 *   strong (single match OK):
 *     - body or .slide sized in px (1280×720 etc.) — pptx-skill uses pt
 *     - raw <table>/<th>/<td> tags
 *     - <div> direct raw text
 *   weak (only trigger when co-occurring with a strong signal):
 *     - external CSS <link> tag
 *     - presence of background-image
 *
 * PHASES (in order, each skips elements inside [data-pptx-image]):
 *   0  inline_margin_to_padding
 *   1  bg-image / pseudo-decoration (3 branches by area ratio)
 *   2  korean_font_weight_to_full_name
 *   3  inline_only_children_to_p
 *   4  raw_text_to_p_wrap
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STDOUT FORMAT (per file):
 *   fixed slide-NN.html  [P0:N  P1:Xe/Yc/Zs  P2:N  P3:N  P4:N]
 *     P1 counts split: extracted (bg→img) / captured (data-pptx-image) / skipped
 *
 * Usage:
 *   node /path/to/pptx-skill/scripts/wrap-text.cjs <slidesDir>
 *
 * Don't use this as a "lint bypass" tool. data-pptx-image must stay scoped to
 * charts/tables/partial graphics — Phase 1 only auto-marks small decorations.
 * Headers / KPIs / insights / conclusions stay native via Phase 3+4.
 * See SKILL.md mode A 절대 금지 #21·#22.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Boot pptx-skill so playwright resolves from its node_modules
const bootstrapPath = [
  '/mnt/skills/user/pptx-skill/scripts/bootstrap.cjs',
  path.join(os.homedir(), '.claude/skills/pptx-skill/scripts/bootstrap.cjs'),
].find((p) => fs.existsSync(p));
if (!bootstrapPath) {
  console.error('pptx-skill bootstrap.cjs not found');
  process.exit(2);
}
require(bootstrapPath);
const { chromium } = require('playwright');

(async () => {
  const slidesDir = process.argv[2];
  if (!slidesDir) {
    console.error('Usage: node wrap-text.cjs <slidesDir>');
    process.exit(2);
  }
  const absDir = path.resolve(slidesDir);
  const files = fs
    .readdirSync(absDir)
    .filter((f) => f.endsWith('.html'))
    .sort();
  if (files.length === 0) {
    console.error(`No .html files in ${absDir}`);
    process.exit(2);
  }

  const browser = await chromium.launch({
    channel: process.platform === 'darwin' ? 'chrome' : undefined,
    args: ['--allow-file-access-from-files'],
  });

  try {
    for (const f of files) {
      const filePath = path.join(absDir, f);
      const page = await browser.newPage();
      await page.goto('file://' + filePath);
      await page.waitForLoadState('networkidle');

      const html = await page.evaluate(() => {
        // Per-phase counters (stashed on <html> at the end for caller logging)
        let p0 = 0, p1ext = 0, p1cap = 0, p1skip = 0, p2 = 0, p3 = 0, p4 = 0;

        // ── Phase 0: strip margins from inline elements (replace with padding when applicable) ──
        // pptx-skill rejects inline <span>/<b>/<strong>/<i>/<em>/<u> with any margin.
        // Visually, padding on inline elements is identical to margin for spacing purposes.
        const INLINE = new Set(['SPAN', 'B', 'STRONG', 'I', 'EM', 'U']);
        document.querySelectorAll('*').forEach((el) => {
          if (!INLINE.has(el.tagName)) return;
          if (el.closest('[data-pptx-image]')) return; // will be rasterized
          let changed = false;
          // Convert inline-style margin → padding
          for (const side of ['Left', 'Right', 'Top', 'Bottom']) {
            const v = el.style['margin' + side];
            if (v && parseFloat(v) > 0) {
              const padKey = 'padding' + side;
              if (!el.style[padKey]) el.style[padKey] = v;
              el.style['margin' + side] = '';
              changed = true;
            }
          }
          // Override any margin coming from class-based CSS rules to 0
          const cs = getComputedStyle(el);
          for (const side of ['Left', 'Right', 'Top', 'Bottom']) {
            const cv = cs['margin' + side];
            if (cv && parseFloat(cv) > 0) {
              el.style['margin' + side] = '0';
              changed = true;
            }
          }
          if (changed) p0++;
        });

        // ── Phase 1: handle bg-image / pseudo-decorations based on element area ──
        // Three branches by area ratio (element area / slide area):
        //
        //   ratio ≥ 0.9  AND extractable bg-image (single url(), no gradient)
        //     → auto-extract: insert <img> as first child, strip background-image,
        //       ensure positioning context. Do NOT mark as capture. Text
        //       descendants stay PPT-native (editable). This solves the common
        //       "full-bleed cover photo with title text on top" pattern that
        //       previously required manual <img> conversion.
        //
        //   0.7 ≤ ratio < 0.9  OR  ratio ≥ 0.9 with non-extractable bg-image
        //     (gradient-only, multiple backgrounds, pseudo-only decoration)
        //     → skip with data-wrap-text-skip marker. Capture would violate
        //       lint rule 16 (SKILL.md mode A 절대 금지 #22). Manual fix needed.
        //
        //   ratio < 0.7
        //     → mark as data-pptx-image (PNG capture). Partial graphics like
        //       small card photos, gradient overlays, ::before/::after lines.
        //
        // Try-extract is single url() only. Combined "url(...) , gradient(...)"
        // or pure gradients can't become a single <img>, so they fall through
        // to the skip/capture branches.
        function tryExtractBgUrl(bgImg) {
          if (!bgImg || bgImg === 'none') return null;
          const t = bgImg.trim();
          if (/gradient\(/i.test(t)) return null;
          const occurrences = t.match(/url\(/gi) || [];
          if (occurrences.length !== 1) return null;
          const m = t.match(/^url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)$/);
          if (!m) return null;
          return (m[1] ?? m[2] ?? m[3] ?? '').trim() || null;
        }

        const bodyRectP1 = document.body.getBoundingClientRect();
        const slideAreaP1 = bodyRectP1.width * bodyRectP1.height;
        document.querySelectorAll('*').forEach((el) => {
          if (el.hasAttribute('data-pptx-image')) return;
          if (el.parentElement && el.parentElement.closest('[data-pptx-image]')) return;
          let needsCapture = false;

          // (a) Own background-image (photo or gradient)
          const own = getComputedStyle(el).backgroundImage;
          if (own && own !== 'none') needsCapture = true;

          // (b) Pseudo-element decoration: ::before/::after with content !== 'none' AND
          //     either a visible bg / non-zero border / a generated string
          if (!needsCapture) {
            for (const pseudo of [':before', ':after']) {
              const ps = getComputedStyle(el, pseudo);
              if (!ps) continue;
              const content = ps.content;
              if (!content || content === 'none' || content === 'normal') continue;
              const hasBgImg = ps.backgroundImage && ps.backgroundImage !== 'none';
              const hasBgColor =
                ps.backgroundColor && ps.backgroundColor !== 'rgba(0, 0, 0, 0)';
              const hasBorder =
                (parseFloat(ps.borderTopWidth) || 0) +
                  (parseFloat(ps.borderBottomWidth) || 0) +
                  (parseFloat(ps.borderLeftWidth) || 0) +
                  (parseFloat(ps.borderRightWidth) || 0) >
                0;
              if (hasBgImg || hasBgColor || hasBorder) {
                needsCapture = true;
                break;
              }
            }
          }

          if (!needsCapture) return;

          const r = el.getBoundingClientRect();
          const ratio = slideAreaP1 > 0 ? (r.width * r.height) / slideAreaP1 : 0;

          // Full-bleed branch: try to convert bg-image → <img> so text on top stays native
          if (ratio >= 0.9) {
            const url = tryExtractBgUrl(own);
            if (url) {
              const img = document.createElement('img');
              img.setAttribute('src', url);
              img.setAttribute('alt', '');
              const bgSize = getComputedStyle(el).backgroundSize || 'cover';
              const objectFit = bgSize === 'contain' ? 'contain' : 'cover';
              const bgPos = getComputedStyle(el).backgroundPosition || 'center center';
              img.setAttribute(
                'style',
                `position:absolute; top:0; left:0; width:100%; height:100%; object-fit:${objectFit}; object-position:${bgPos};`,
              );
              el.insertBefore(img, el.firstChild);
              el.style.backgroundImage = 'none';
              if (getComputedStyle(el).position === 'static') {
                el.style.position = 'relative';
              }
              el.style.overflow = el.style.overflow || 'hidden';
              el.setAttribute(
                'data-wrap-text-extracted',
                `phase1-bg-to-img:${(ratio * 100).toFixed(0)}%`,
              );
              p1ext++;
              return;
            }
            // Couldn't extract (gradient-only, pseudo-only, or multiple bgs).
            el.setAttribute(
              'data-wrap-text-skip',
              `Phase1: covers ${(ratio * 100).toFixed(0)}% of slide and bg-image is not a single url() (gradient/pseudo/multiple). Manual fix needed.`,
            );
            p1skip++;
            return;
          }

          // Mid-band: would trigger lint rule 16 if marked as capture, but not full-bleed
          // enough to confidently auto-extract. Leave for manual intervention.
          if (ratio >= 0.7) {
            el.setAttribute(
              'data-wrap-text-skip',
              `Phase1: covers ${(ratio * 100).toFixed(0)}% of slide. Convert background-image to <img> tag manually.`,
            );
            p1skip++;
            return;
          }

          // Partial graphic: capture as PNG (existing behavior)
          el.setAttribute('data-pptx-image', 'true');
          p1cap++;
        });

        // ── Phase 2: SCDream weight → specific full font-name ──
        // PowerPoint sees each SCDream weight as a separate font family
        // ("에스코어 드림 1 Thin" … "에스코어 드림 9 Black"). Sending just
        // "에스코어 드림" + bold flag doesn't work — PPT applies faux-bold
        // instead of switching to the designed weight.
        // For text NOT inside [data-pptx-image] (PNG captured), pin font-family
        // to the exact weighted full name based on computed font-weight, and
        // force font-weight:400 so pptx-skill's synthetic-bold check doesn't double up.
        //
        // Edit SCDREAM_FULL / SCDREAM_RE for other weighted families
        // (Pretendard Static, Noto Sans KR Static, etc.).
        const SCDREAM_FULL = {
          100: '에스코어 드림 1 Thin',
          200: '에스코어 드림 2 ExtraLight',
          300: '에스코어 드림 3 Light',
          400: '에스코어 드림 4 Regular',
          500: '에스코어 드림 5 Medium',
          600: '에스코어 드림 6 Bold',
          700: '에스코어 드림 7 ExtraBold',
          800: '에스코어 드림 8 Heavy',
          900: '에스코어 드림 9 Black',
        };
        const SCDREAM_RE = /^에스코어|^SCDream|^S-?Core/i;
        document.querySelectorAll('*').forEach((el) => {
          if (el.closest('[data-pptx-image]')) return;
          const cs = getComputedStyle(el);
          const fam = cs.fontFamily || '';
          const first = fam.split(',')[0].replace(/['"]/g, '').trim();
          if (!SCDREAM_RE.test(first)) return;
          let w = parseInt(cs.fontWeight, 10);
          if (!isFinite(w)) w = 400;
          const bucket = Math.max(100, Math.min(900, Math.round(w / 100) * 100));
          const target = SCDREAM_FULL[bucket] || SCDREAM_FULL[400];
          el.style.fontFamily = `"${target}"`;
          el.style.fontWeight = '400'; // bypass pptx-skill faux-bold
          p2++;
        });

        // ── Phase 3: inline-only direct children of <div> → convert to <p> ──
        // pptx-skill only extracts text from textTags (P, H1-H6, UL, OL, LI). Orphan spans
        // (not inside a textTag) get lost. Pattern: <div class="toc-text">
        // <span class="toc-eye">…</span><span class="toc-t">…</span></div>.
        // Converting span→p preserves CSS class styling and keeps flex layout intact.
        const INLINE2 = new Set(['SPAN', 'B', 'STRONG', 'I', 'EM', 'U']);
        document.querySelectorAll('div').forEach((div) => {
          if (div.closest('[data-pptx-image]')) return;
          const direct = [...div.childNodes];
          // Skip if any direct text node is non-empty (Phase 4 handles those)
          if (direct.some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim())) return;
          // Skip if any direct child is block-level
          if (
            direct.some(
              (n) =>
                n.nodeType === Node.ELEMENT_NODE && !INLINE2.has(n.tagName) && n.tagName !== 'BR',
            )
          )
            return;
          for (const child of direct) {
            if (child.nodeType !== Node.ELEMENT_NODE) continue;
            if (!INLINE2.has(child.tagName)) continue;
            const p = document.createElement('p');
            for (const attr of child.attributes) p.setAttribute(attr.name, attr.value);
            const existing = p.getAttribute('style') || '';
            p.setAttribute(
              'style',
              existing + (existing && !existing.endsWith(';') ? ';' : '') + 'margin:0;',
            );
            while (child.firstChild) p.appendChild(child.firstChild);
            child.parentNode.replaceChild(p, child);
            p3++;
          }
        });

        // ── Phase 4: wrap unwrapped text inside <div> with <p style="margin:0"> ──
        const BLOCK = new Set([
          'DIV', 'SECTION', 'ARTICLE', 'UL', 'OL', 'TABLE',
          'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
          'HEADER', 'FOOTER', 'NAV', 'MAIN', 'ASIDE', 'FIGURE',
        ]);
        document.querySelectorAll('div').forEach((div) => {
          if (div.closest('[data-pptx-image]')) return;
          const childArr = [...div.childNodes];
          const hasDirectText = childArr.some(
            (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim(),
          );
          if (!hasDirectText) return;
          const hasBlockChild = childArr.some(
            (n) => n.nodeType === Node.ELEMENT_NODE && BLOCK.has(n.tagName),
          );

          if (!hasBlockChild) {
            // No block children — wrap entire content in one <p>.
            const p = document.createElement('p');
            p.style.margin = '0';
            while (div.firstChild) p.appendChild(div.firstChild);
            div.appendChild(p);
            p4++;
          } else {
            // Mixed: text + block. Wrap each contiguous run of text/inline siblings.
            const groups = [];
            let group = [];
            for (const n of childArr) {
              const isInline =
                n.nodeType === Node.TEXT_NODE ||
                (n.nodeType === Node.ELEMENT_NODE && !BLOCK.has(n.tagName));
              if (isInline) {
                group.push(n);
              } else {
                if (
                  group.length &&
                  group.some((x) => x.nodeType === Node.TEXT_NODE && x.textContent.trim())
                ) {
                  groups.push(group);
                }
                group = [];
              }
            }
            if (
              group.length &&
              group.some((x) => x.nodeType === Node.TEXT_NODE && x.textContent.trim())
            ) {
              groups.push(group);
            }
            for (const grp of groups) {
              const p = document.createElement('p');
              p.style.margin = '0';
              const ref = grp[0];
              ref.parentNode.insertBefore(p, ref);
              for (const n of grp) p.appendChild(n);
              p4++;
            }
          }
        });

        // Stash counters on <html> so caller can render a one-line summary.
        // Format: p0/p1ext/p1cap/p1skip/p2/p3/p4
        document.documentElement.setAttribute(
          'data-wrap-text-stats',
          `${p0}/${p1ext}/${p1cap}/${p1skip}/${p2}/${p3}/${p4}`,
        );

        return '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
      });

      await page.close();
      fs.writeFileSync(filePath, html);
      // Parse phase counters: p0/p1ext/p1cap/p1skip/p2/p3/p4
      const sm = html.match(/data-wrap-text-stats="(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)"/);
      let summary = '';
      if (sm) {
        const [, p0, p1e, p1c, p1s, p2, p3, p4] = sm;
        summary = `  [P0:${p0}  P1:${p1e}e/${p1c}c/${p1s}s  P2:${p2}  P3:${p3}  P4:${p4}]`;
      }
      console.log(`  fixed ${f}${summary}`);
    }
  } finally {
    await browser.close();
  }
  console.log('Done.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
