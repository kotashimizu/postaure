import { test, expect } from '@playwright/test';

test.describe('Camera Debug Tests', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['camera']);
    await page.goto('/');
    await page.waitForSelector('.app', { timeout: 10000 });
  });

  test('Debug camera initialization and canvas ref', async ({ page }) => {
    // Wait for video to be visible
    await page.waitForSelector('video', { timeout: 10000 });

    // Check canvas element in DOM
    const canvasExists = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      console.log('Found canvases:', canvases.length);

      for (let i = 0; i < canvases.length; i++) {
        const canvas = canvases[i];
        console.log(`Canvas ${i}:`, {
          display: window.getComputedStyle(canvas).display,
          width: canvas.width,
          height: canvas.height,
          offsetParent: canvas.offsetParent !== null,
          connected: canvas.isConnected
        });
      }

      return canvases.length > 0;
    });

    expect(canvasExists).toBe(true);

    // Check camera state details
    const cameraInfo = await page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      if (!video) return { error: 'No video element found' };

      return {
        hasVideo: !!video,
        hasSrcObject: !!video.srcObject,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState,
        paused: video.paused,
        currentTime: video.currentTime,
        duration: video.duration,
        streamActive: video.srcObject ? (video.srcObject as MediaStream).active : false,
        streamTracks: video.srcObject ? (video.srcObject as MediaStream).getTracks().length : 0
      };
    });

    console.log('Camera info:', cameraInfo);

    // Try to simulate capture button click and catch the error
    const captureButton = page.locator('button.capture-button');
    await expect(captureButton).toBeVisible();

    // Enable capture by clicking override if available
    const overrideButton = page.locator('button:has-text("撮影を続行")');
    if (await overrideButton.isVisible()) {
      await overrideButton.click();
      await expect(captureButton).toBeEnabled();
    }

    // Check what happens when we try to capture
    const captureResult = await page.evaluate(() => {
      return new Promise((resolve) => {
        const button = document.querySelector('button.capture-button') as HTMLButtonElement;
        if (!button) {
          resolve({ error: 'No capture button found' });
          return;
        }

        const originalConsoleError = console.error;
        const errors: string[] = [];

        console.error = (...args) => {
          errors.push(args.join(' '));
          originalConsoleError.apply(console, args);
        };

        try {
          button.click();
          setTimeout(() => {
            console.error = originalConsoleError;
            resolve({ success: true, errors });
          }, 1000);
        } catch (error) {
          console.error = originalConsoleError;
          resolve({ error: error.message, errors });
        }
      });
    });

    console.log('Capture result:', captureResult);
  });

  test('Debug ref state when capture is called', async ({ page }) => {
    // Wait for video
    await page.waitForSelector('video', { timeout: 10000 });

    // Inject debugging code to check refs
    await page.evaluate(() => {
      // Hook into the capture function to debug refs
      const originalError = Error;
      window.Error = function(message) {
        if (message === 'カメラが初期化されていません') {
          const video = document.querySelector('video');
          const canvas = document.querySelector('canvas');

          console.error('Debug info when capture fails:', {
            videoExists: !!video,
            videoSrcObject: !!(video as HTMLVideoElement)?.srcObject,
            canvasExists: !!canvas,
            canvasConnected: canvas?.isConnected,
            canvasParent: canvas?.parentElement?.tagName,
            videoConnected: video?.isConnected,
            videoParent: video?.parentElement?.tagName
          });
        }
        return new originalError(message);
      } as any;
    });

    // Now try to trigger the error
    const overrideButton = page.locator('button:has-text("撮影を続行")');
    if (await overrideButton.isVisible()) {
      await overrideButton.click();
    }

    const captureButton = page.locator('button.capture-button');
    if (await captureButton.isEnabled()) {
      await captureButton.click();
      await page.waitForTimeout(1000);
    }
  });
});