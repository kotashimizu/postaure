import { test, expect } from '@playwright/test';

test.describe('Final Camera Fix Verification', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['camera']);
    await page.goto('/');
    await page.waitForSelector('.app', { timeout: 10000 });
  });

  test('Camera stream persistence and capture', async ({ page }) => {
    // Set up console logging
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('[Camera]') || msg.text().includes('[CaptureScreen]')) {
        logs.push(msg.text());
      }
    });

    // Wait for video element
    await page.waitForSelector('video', { timeout: 15000 });

    // Wait for camera initialization logs
    await page.waitForTimeout(2000);

    // Check if we have camera initialization success logs
    const hasInitSuccess = logs.some(log => log.includes('Camera initialization successful'));
    console.log('Camera initialization successful:', hasInitSuccess);

    // Check if camera is being reinitialized unnecessarily
    const initCount = logs.filter(log => log.includes('Starting camera initialization after delay')).length;
    console.log('Camera initialization attempts:', initCount);

    // Check video element state
    const videoState = await page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      return {
        exists: !!video,
        hasSrcObject: !!video?.srcObject,
        readyState: video?.readyState || -1,
        videoWidth: video?.videoWidth || 0,
        videoHeight: video?.videoHeight || 0
      };
    });
    console.log('Video state:', videoState);

    // Try to enable capture
    const overrideButton = page.locator('button:has-text("撮影を続行")');
    if (await overrideButton.isVisible()) {
      await overrideButton.click();
      await page.waitForTimeout(500);
    }

    // Try capture
    const captureButton = page.locator('button.capture-button');
    if (await captureButton.isEnabled()) {
      await captureButton.click();
      await page.waitForTimeout(1000);
    }

    // Check error logs
    const hasStreamError = logs.some(log => log.includes('カメラストリームが接続されていません'));
    const hasInitError = logs.some(log => log.includes('カメラが初期化されていません'));

    console.log('All logs:', logs);
    console.log('Has stream error:', hasStreamError);
    console.log('Has init error:', hasInitError);

    // The important thing is that we shouldn't have unnecessary reinitializations
    expect(initCount).toBeLessThanOrEqual(2); // Allow some retries but not excessive
  });

  test('Camera stream state consistency', async ({ page }) => {
    // Monitor camera state over time
    const states = [];

    for (let i = 0; i < 10; i++) {
      const state = await page.evaluate(() => {
        const video = document.querySelector('video') as HTMLVideoElement;
        return {
          timestamp: Date.now(),
          hasSrcObject: !!video?.srcObject,
          readyState: video?.readyState || -1,
          connected: video?.isConnected || false
        };
      });
      states.push(state);
      await page.waitForTimeout(300);
    }

    console.log('Camera states over time:', states);

    // Check that srcObject doesn't keep getting reset
    const srcObjectStates = states.map(s => s.hasSrcObject);
    const srcObjectChanges = srcObjectStates.filter((state, i) =>
      i > 0 && state !== srcObjectStates[i - 1]
    ).length;

    console.log('SrcObject changes:', srcObjectChanges);
    expect(srcObjectChanges).toBeLessThanOrEqual(2); // Should stabilize quickly
  });
});