// Screenshots every page of the built profile at 2x (3840x2160) as high-quality JPEGs.
// build.py then packs them into the PDF. A flat image per page renders identically
// everywhere; the iPhone PDF viewer mis-draws Chromium's vector shadows and
// transparency (black boxes behind icons, grey blocks behind cards).
// Usage: node render.cjs <in.html> <outDir>
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

(async () => {
  const [input, outDir] = process.argv.slice(2);
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  await page.goto("file://" + path.resolve(input), { waitUntil: "networkidle" });
  await page.emulateMedia({ media: "print" });
  await page.evaluate(() => document.fonts.ready);
  const pages = await page.$$("section.page");
  for (let i = 0; i < pages.length; i++) {
    const file = path.join(outDir, `page-${String(i + 1).padStart(2, "0")}.jpg`);
    await pages[i].screenshot({ path: file, type: "jpeg", quality: 90 });
  }
  await browser.close();
  console.log(`${pages.length} pages rendered`);
})();
