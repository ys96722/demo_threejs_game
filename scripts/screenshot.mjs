import { chromium } from 'playwright';

const url = process.argv[2];
const out = process.argv[3];

if (!url || !out) {
  console.error('Usage: npm run screenshot <url> <output.png>');
  process.exit(1);
}

const browser = await chromium.launch({
  headless: false,
  args: ['--no-sandbox', '--window-size=1280,720'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
await page.screenshot({ path: out });
await browser.close();
console.log('Saved', out);
