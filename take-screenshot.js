const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();

    await page.goto('http://localhost:3000/login');
    await page.waitForTimeout(2000); // Wait for GSAP
    await page.fill('#username', 'dad');
    await page.fill('#password', 'test123');
    await page.click('button[type="submit"]');

    await page.waitForURL('http://localhost:3000/');
    console.log('Logged in successfully, waiting for dashboard to render...');
    await page.waitForTimeout(4000); // 4s wait for dashboard GSAP animations and data to load

    const screenshotPath = 'screenshot-dashboard-loop3.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved to ${screenshotPath}`);

    await browser.close();
})();
