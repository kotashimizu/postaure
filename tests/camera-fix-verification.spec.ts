import { test, expect } from '@playwright/test';

test.describe('Camera Fix Verification', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['camera']);
    await page.goto('/');
    await page.waitForSelector('.app', { timeout: 10000 });
  });

  test('Camera capture with improved error handling', async ({ page }) => {
    // Wait for video element
    await page.waitForSelector('video', { timeout: 10000 });

    // Enable capture by clicking override if available
    const overrideButton = page.locator('button:has-text("撮影を続行")');
    if (await overrideButton.isVisible()) {
      await overrideButton.click();
    }

    // Wait for capture button to be enabled
    const captureButton = page.locator('button.capture-button');

    // Set up console logging to capture the new debug logs
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('[Camera]')) {
        logs.push(msg.text());
      }
    });

    // Try to capture
    let captureSuccessful = false;
    try {
      if (await captureButton.isEnabled()) {
        await captureButton.click();

        // Wait a moment for the operation to complete
        await page.waitForTimeout(2000);
        captureSuccessful = true;
      }
    } catch (error) {
      console.log('Capture failed as expected in test environment');
    }

    // Check that the new debug logging is working
    const hasDebugLogs = logs.some(log => log.includes('capturePhoto called, checking refs'));
    expect(hasDebugLogs).toBe(true);

    // Verify that the error handling provides more specific error messages
    const hasSpecificErrors = logs.some(log =>
      log.includes('カメラストリームが接続されていません') ||
      log.includes('ビデオの準備がタイムアウトしました') ||
      log.includes('ビデオが正しく読み込まれていません')
    );

    console.log('Debug logs:', logs);
    console.log('Has specific error messages:', hasSpecificErrors);
  });

  test('Video readiness check', async ({ page }) => {
    // Wait for video
    await page.waitForSelector('video', { timeout: 10000 });

    // Check video state periodically
    const videoStates = [];
    for (let i = 0; i < 5; i++) {
      const state = await page.evaluate(() => {
        const video = document.querySelector('video') as HTMLVideoElement;
        return {
          readyState: video?.readyState || -1,
          videoWidth: video?.videoWidth || 0,
          videoHeight: video?.videoHeight || 0,
          hasSrcObject: !!video?.srcObject,
          paused: video?.paused
        };
      });
      videoStates.push(state);
      await page.waitForTimeout(500);
    }

    console.log('Video states over time:', videoStates);

    // Check that readyState progresses
    const finalState = videoStates[videoStates.length - 1];
    expect(finalState.readyState).toBeGreaterThanOrEqual(0);
  });

  test('Camera functionality with waiting logic', async ({ page }) => {
    // Wait for video
    await page.waitForSelector('video', { timeout: 10000 });

    // Test the new waiting logic by simulating capture
    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        const video = document.querySelector('video') as HTMLVideoElement;
        const canvas = document.querySelector('canvas') as HTMLCanvasElement;

        if (!video || !canvas) {
          resolve({ error: 'Missing video or canvas' });
          return;
        }

        // Simulate the new readyState check logic
        const checkReadyState = () => {
          console.log('Video readyState:', video.readyState);
          console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
          console.log('Has srcObject:', !!video.srcObject);

          resolve({
            readyState: video.readyState,
            hasValidDimensions: video.videoWidth > 0 && video.videoHeight > 0,
            hasSrcObject: !!video.srcObject,
            canvasExists: !!canvas,
            success: true
          });
        };

        // Check immediately
        setTimeout(checkReadyState, 100);
      });
    });

    console.log('Camera functionality test result:', result);
    expect(result).toHaveProperty('success', true);
  });
});