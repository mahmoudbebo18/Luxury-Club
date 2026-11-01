// Renders the built profile HTML to a 1920x1080 (16:9) PDF, optionally with PNG previews.
// Usage: node render.cjs <in.html> <out.pdf> [previewDir]
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

(async () => {
  const [input, output, previewDir] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto("file://" + path.resolve(input), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  if (previewDir) {
    fs.mkdirSync(previewDir, { recursive: true });
    await page.emulateMedia({ media: "print" });
    const pages = await page.$$("section.page");
    for (let i = 0; i < pages.length; i++) {
      await pages[i].screenshot({ path: path.join(previewDir, `page-${String(i + 1).padStart(2, "0")}.png`) });
    }
  }

  await page.pdf({ path: output, width: "1920px", height: "1080px", printBackground: true, preferCSSPageSize: true });
  await browser.close();
  console.log("PDF written:", output);
})();
