// Renders the app icon and splash source images into assets/ for `npx @capacitor/assets generate`.
// Run with Playwright available: node scripts/render-assets.mjs
import { chromium } from "playwright";

const glyph = (color) => `
  <path d="M60 44v104l12-8 12 8 12-8 12 8 12-8 12 8V44l-12 8-12-8-12 8-12-8-12 8Z" fill="#fff"/>
  <path d="M80 118V74l32 44V74M72 90h48M72 102h48" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
const gradient = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#139170"/><stop offset="1" stop-color="#0a4f3c"/></linearGradient></defs>`;

// @capacitor/assets insets the adaptive-icon layers into Android's safe zone itself, so the glyph is drawn full size.
const foreground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">${glyph("#0f7a5c")}</svg>`;
const background = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">${gradient}<rect width="192" height="192" fill="url(#g)"/></svg>`;
const iconOnly = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">${gradient}<rect width="192" height="192" fill="url(#g)"/>${glyph("#0f7a5c")}</svg>`;
const splash = (page) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732"><rect width="2732" height="2732" fill="${page}"/>
  <g transform="translate(1116 1116) scale(2.604)">${gradient}<rect width="192" height="192" rx="44" fill="url(#g)"/>${glyph("#0f7a5c")}</g></svg>`;

const outputs = [
  ["icon-foreground.png", foreground, 1024, true],
  ["icon-background.png", background, 1024, false],
  ["icon-only.png", iconOnly, 1024, false],
  ["splash.png", splash("#f4f5f2"), 2732, false],
  ["splash-dark.png", splash("#0e100f"), 2732, false],
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const [file, svg, size, transparent] of outputs) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>*{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: `assets/${file}`, omitBackground: transparent });
  await page.close();
  console.log(`assets/${file}`);
}
await browser.close();
