import { test, expect } from '@playwright/test';

test.describe('UI Layout Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app', { timeout: 10000 });
  });

  test('Analyze text alignment and layout issues', async ({ page }) => {
    // Take initial screenshot
    await page.screenshot({ path: 'test-results/ui-initial.png', fullPage: true });

    // Check for common layout issues
    const layoutIssues = await page.evaluate(() => {
      const issues: string[] = [];

      // Check for text overflow
      const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div');
      textElements.forEach((el, i) => {
        const element = el as HTMLElement;
        if (element.scrollWidth > element.clientWidth) {
          issues.push(`Text overflow in element ${i}: ${element.tagName} - "${element.textContent?.substring(0, 50)}..."`);
        }
      });

      // Check for alignment issues
      const alignmentElements = document.querySelectorAll('.alignment-status, .capture-instructions, .results-section');
      alignmentElements.forEach((el, i) => {
        const element = el as HTMLElement;
        const rect = element.getBoundingClientRect();
        const computedStyle = getComputedStyle(element);

        issues.push(`Element ${i} (${element.className}): position=${computedStyle.position}, top=${computedStyle.top}, left=${computedStyle.left}, width=${rect.width}, height=${rect.height}`);
      });

      return issues;
    });

    console.log('Layout analysis results:', layoutIssues);

    // Check API settings section
    const apiSettings = await page.locator('.ai-settings, .api-settings').first();
    if (await apiSettings.isVisible()) {
      await apiSettings.screenshot({ path: 'test-results/api-settings-before.png' });

      const apiContent = await apiSettings.evaluate(el => {
        return {
          innerHTML: el.innerHTML,
          className: el.className,
          children: Array.from(el.children).map(child => ({
            tagName: child.tagName,
            className: child.className,
            textContent: child.textContent?.substring(0, 100)
          }))
        };
      });

      console.log('API Settings current structure:', apiContent);
    }

    // Check for layout shifts after image processing
    const captureContainer = page.locator('.capture-container, .camera-view');
    if (await captureContainer.isVisible()) {
      await captureContainer.screenshot({ path: 'test-results/capture-container.png' });
    }

    // Check results section layout
    const resultsSection = page.locator('.results-section, .analysis-results');
    if (await resultsSection.isVisible()) {
      await resultsSection.screenshot({ path: 'test-results/results-section.png' });
    }
  });

  test('Check responsive layout issues', async ({ page }) => {
    // Test different viewport sizes
    const viewports = [
      { width: 375, height: 667 }, // iPhone SE
      { width: 768, height: 1024 }, // iPad
      { width: 1920, height: 1080 } // Desktop
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);

      await page.screenshot({
        path: `test-results/responsive-${viewport.width}x${viewport.height}.png`,
        fullPage: true
      });

      // Check for horizontal scrolling
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      console.log(`Viewport ${viewport.width}x${viewport.height}: Horizontal scroll = ${hasHorizontalScroll}`);
    }
  });

  test('Identify specific UI elements for modification', async ({ page }) => {
    // Find all elements that might need layout fixes
    const elementSelectors = [
      '.alignment-status',
      '.ai-settings',
      '.api-settings',
      '.capture-instructions',
      '.results-section',
      '.analysis-results',
      '.legend-container',
      '.posture-analysis'
    ];

    for (const selector of elementSelectors) {
      const elements = await page.locator(selector).all();

      if (elements.length > 0) {
        console.log(`Found ${elements.length} elements for selector: ${selector}`);

        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];
          if (await element.isVisible()) {
            const boundingBox = await element.boundingBox();
            const styles = await element.evaluate(el => {
              const computed = getComputedStyle(el);
              return {
                position: computed.position,
                display: computed.display,
                flexDirection: computed.flexDirection,
                textAlign: computed.textAlign,
                margin: computed.margin,
                padding: computed.padding,
                width: computed.width,
                height: computed.height
              };
            });

            console.log(`${selector}[${i}]:`, { boundingBox, styles });
          }
        }
      }
    }
  });
});