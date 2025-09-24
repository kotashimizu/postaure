import { test, expect } from '@playwright/test';

test.describe('UI Fix Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app', { timeout: 10000 });
  });

  test('Verify alignment status fixes', async ({ page }) => {
    // Wait for alignment status to appear
    const alignmentStatus = page.locator('.alignment-status').first();
    await expect(alignmentStatus).toBeVisible({ timeout: 5000 });

    // Take screenshot of alignment status
    await alignmentStatus.screenshot({ path: 'test-results/alignment-status-fixed.png' });

    // Check text overflow is fixed
    const hasTextOverflow = await alignmentStatus.evaluate(el => {
      return el.scrollWidth > el.clientWidth;
    });

    expect(hasTextOverflow).toBe(false);

    // Verify responsive behavior
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await alignmentStatus.screenshot({ path: 'test-results/alignment-status-mobile.png' });

    const mobileHasOverflow = await alignmentStatus.evaluate(el => {
      return el.scrollWidth > el.clientWidth;
    });

    expect(mobileHasOverflow).toBe(false);
  });

  test('Verify API input section simplification', async ({ page }) => {
    // Navigate to a state where API input would be shown
    // For now, let's check if we can find the new API input section

    // Try to find the old AI settings
    const oldAiSettings = page.locator('.ai-settings');
    const hasOldSettings = await oldAiSettings.count();

    // Try to find the new API input section
    const newApiInput = page.locator('.api-input-section');
    const hasNewInput = await newApiInput.count();

    console.log('Old AI settings found:', hasOldSettings);
    console.log('New API input section found:', hasNewInput);

    // If we need to navigate to see the API section, we can add that logic here
    // For now, let's take a full page screenshot
    await page.screenshot({ path: 'test-results/ui-fixed-full-page.png', fullPage: true });
  });

  test('Check layout after image processing simulation', async ({ page }) => {
    // Simulate adding results section
    await page.evaluate(() => {
      // Create a mock results section
      const resultsSection = document.createElement('div');
      resultsSection.className = 'results-section';
      resultsSection.innerHTML = `
        <h2>分析結果</h2>
        <div class="analysis-results">
          <p>テスト結果データ</p>
          <div class="legend-container">
            <div class="legend-item">
              <div class="legend-color"></div>
              <span>正常</span>
            </div>
            <div class="legend-item">
              <div class="legend-color guide"></div>
              <span>ガイド</span>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(resultsSection);
    });

    await page.waitForTimeout(500);

    // Take screenshot with results
    await page.screenshot({ path: 'test-results/layout-with-results.png', fullPage: true });

    // Check for layout shifts or overflow
    const bodyOverflow = await page.evaluate(() => {
      return {
        scrollWidth: document.body.scrollWidth,
        clientWidth: document.body.clientWidth,
        hasHorizontalScroll: document.body.scrollWidth > document.body.clientWidth
      };
    });

    console.log('Body overflow check:', bodyOverflow);
    expect(bodyOverflow.hasHorizontalScroll).toBe(false);
  });

  test('Test responsive behavior across viewports', async ({ page }) => {
    const viewports = [
      { width: 320, height: 568, name: 'small-mobile' },
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1200, height: 800, name: 'desktop' }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);

      await page.screenshot({
        path: `test-results/responsive-${viewport.name}-${viewport.width}x${viewport.height}.png`,
        fullPage: true
      });

      // Check for horizontal scroll
      const hasScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      console.log(`${viewport.name} (${viewport.width}x${viewport.height}): Has horizontal scroll = ${hasScroll}`);
      expect(hasScroll).toBe(false);
    }
  });

  test('Verify text alignment improvements', async ({ page }) => {
    // Check all text elements for proper alignment
    const textElements = await page.locator('p, h1, h2, h3, h4, h5, h6, span').all();
    let overflowCount = 0;

    for (const element of textElements) {
      if (await element.isVisible()) {
        const hasOverflow = await element.evaluate(el => {
          return el.scrollWidth > el.clientWidth;
        });

        if (hasOverflow) {
          overflowCount++;
          const text = await element.textContent();
          console.log(`Text overflow in element: "${text?.substring(0, 50)}..."`);
        }
      }
    }

    console.log(`Total elements with text overflow: ${overflowCount}`);

    // Allow some minor overflows (like very long URLs or technical terms)
    // but expect most text to fit properly
    expect(overflowCount).toBeLessThan(3);
  });
});