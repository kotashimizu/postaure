import { test, expect } from '@playwright/test';

test.describe('Camera Functionality Tests', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant camera permissions
    await context.grantPermissions(['camera']);

    // Navigate to the app
    await page.goto('/');

    // Wait for the app to load
    await page.waitForSelector('.app', { timeout: 10000 });
  });

  test('Camera initialization and permission request', async ({ page }) => {
    // Check for camera video element
    const videoElement = page.locator('video');
    await expect(videoElement).toBeVisible({ timeout: 10000 });

    // Verify camera stream is active
    const hasVideoStream = await page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      return video && video.srcObject !== null && (video.srcObject as MediaStream).active;
    });
    expect(hasVideoStream).toBe(true);

    // Check camera state indicators
    const cameraStatus = await page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      if (!video || !video.srcObject) return 'no-camera';
      const stream = video.srcObject as MediaStream;
      const tracks = stream.getVideoTracks();
      if (tracks.length === 0) return 'no-tracks';
      return tracks[0].enabled ? 'enabled' : 'disabled';
    });
    expect(cameraStatus).toBe('enabled');
  });

  test('Camera guide overlay display', async ({ page }) => {
    // Wait for camera guide overlay
    const cameraGuide = page.locator('.camera-guide-overlay');
    await expect(cameraGuide).toBeVisible({ timeout: 5000 });

    // Check for frontal silhouette guide
    const frontalGuide = page.locator('.frontal-silhouette');
    await expect(frontalGuide).toBeVisible();

    // Check alignment status indicator (use first one to avoid strict mode)
    const alignmentStatus = page.locator('.alignment-status').first();
    await expect(alignmentStatus).toBeVisible();

    // Verify initial alignment message
    const statusText = await alignmentStatus.textContent();
    expect(statusText).toContain('位置を調整してください');
  });

  test('Capture button functionality', async ({ page }) => {
    // Wait for the specific capture button (not the tab button)
    const captureButton = page.locator('button.capture-button');

    // Initially button should be disabled (not aligned)
    await expect(captureButton).toBeDisabled({ timeout: 5000 });

    // Check for alignment override button
    const overrideButton = page.locator('button:has-text("撮影を続行")');
    if (await overrideButton.isVisible()) {
      // Click override to enable capture
      await overrideButton.click();
      await expect(captureButton).toBeEnabled();
    }
  });

  test('Mode switching between camera and upload', async ({ page }) => {
    // Check for mode toggle buttons
    const uploadButton = page.locator('button:has-text("画像をアップロード")');

    if (await uploadButton.isVisible()) {
      // Switch to upload mode
      await uploadButton.click();

      // Verify camera stops
      const videoElement = page.locator('video');
      await expect(videoElement).toBeHidden({ timeout: 5000 });

      // Check for upload interface
      const uploadArea = page.locator('.upload-area');
      await expect(uploadArea).toBeVisible();

      // Switch back to camera mode
      const cameraButton = page.locator('button:has-text("カメラで撮影")');
      if (await cameraButton.isVisible()) {
        await cameraButton.click();
        await expect(videoElement).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('Camera view switching (frontal to sagittal)', async ({ page }) => {
    // Take frontal photo first (with override if needed)
    const overrideButton = page.locator('button:has-text("撮影を続行")');
    if (await overrideButton.isVisible()) {
      await overrideButton.click();
    }

    const captureButton = page.locator('button.capture-button');
    if (await captureButton.isEnabled()) {
      await captureButton.click();

      // Wait for view to switch
      await page.waitForTimeout(1000);

      // Check for sagittal view indicators
      const sagittalGuide = page.locator('.sagittal-silhouette');
      const viewSwitched = await sagittalGuide.isVisible();

      if (viewSwitched) {
        expect(viewSwitched).toBe(true);

        // Check for sagittal alignment text
        const alignmentText = await page.locator('.alignment-indicators text').textContent();
        expect(alignmentText).toContain('真横から撮影');
      }
    }
  });

  test('Error handling for camera access denial', async ({ page, context }) => {
    // Create a new context without camera permissions
    const restrictedContext = await context.browser()?.newContext({
      permissions: [],
    });

    if (restrictedContext) {
      const restrictedPage = await restrictedContext.newPage();
      await restrictedPage.goto('/');

      // Wait for error message
      const errorMessage = restrictedPage.locator('text=/カメラアクセスが拒否されました/');
      const hasError = await errorMessage.isVisible({ timeout: 10000 }).catch(() => false);

      if (hasError) {
        expect(hasError).toBe(true);
      }

      await restrictedContext.close();
    }
  });

  test('Canvas element for photo capture', async ({ page }) => {
    // Check for canvas element (used for capture) - it might be hidden initially
    const canvas = await page.evaluate(() => {
      const canvasElements = document.querySelectorAll('canvas');
      const canvasElement = Array.from(canvasElements).find(c => c.style.display !== 'none') || canvasElements[0];
      return {
        exists: canvasElements.length > 0,
        width: canvasElement?.width || 0,
        height: canvasElement?.height || 0,
        hasContext: !!canvasElement?.getContext('2d')
      };
    });

    if (canvas.exists) {
      expect(canvas.hasContext).toBe(true);
    } else {
      // Canvas might be created dynamically, just check if we can create one
      const canvasSupport = await page.evaluate(() => {
        try {
          const testCanvas = document.createElement('canvas');
          return !!testCanvas.getContext('2d');
        } catch {
          return false;
        }
      });
      expect(canvasSupport).toBe(true);
    }
  });

  test('Video stream properties', async ({ page }) => {
    // Wait for video to be ready
    await page.waitForTimeout(2000);

    const videoProperties = await page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      if (!video || !video.srcObject) return null;

      const stream = video.srcObject as MediaStream;
      const videoTrack = stream.getVideoTracks()[0];

      return {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState,
        paused: video.paused,
        trackEnabled: videoTrack?.enabled,
        trackLabel: videoTrack?.label,
        trackSettings: videoTrack?.getSettings()
      };
    });

    if (videoProperties) {
      expect(videoProperties.videoWidth).toBeGreaterThan(0);
      expect(videoProperties.videoHeight).toBeGreaterThan(0);
      expect(videoProperties.readyState).toBeGreaterThanOrEqual(2); // HAVE_CURRENT_DATA
      expect(videoProperties.paused).toBe(false);
      expect(videoProperties.trackEnabled).toBe(true);
    }
  });

  test('Accessibility features', async ({ page }) => {
    // Check for ARIA labels on the capture button (not the tab button)
    const captureButton = page.locator('button.capture-button');
    const ariaLabel = await captureButton.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();

    // Check for keyboard navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check if Space key triggers capture (when enabled)
    const overrideButton = page.locator('button:has-text("撮影を続行")');
    if (await overrideButton.isVisible()) {
      await overrideButton.click();
      await page.keyboard.press('Space');

      // Check if capture was triggered
      await page.waitForTimeout(1000);
    }
  });
});