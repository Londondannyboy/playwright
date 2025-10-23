/**
 * Screenshot Service
 *
 * Captures screenshots for:
 * 1. Social media cards (Open Graph images)
 * 2. Citation evidence
 * 3. Visual documentation
 */

import { Browser, Page } from 'playwright';
import { logger } from '../utils/logger';
import { uploadToCloudinary } from '../utils/cloudinary';

export interface ScreenshotRequest {
  url: string;
  viewport: { width: number; height: number };
  selector?: string;
  fullPage?: boolean;
}

export interface ScreenshotResult {
  screenshot_url: string;
  width: number;
  height: number;
  file_size: number;
  timestamp: string;
}

export class ScreenshotService {
  private browser: Browser;

  constructor(browser: Browser) {
    this.browser = browser;
  }

  async capture(request: ScreenshotRequest): Promise<ScreenshotResult> {
    let page: Page | null = null;

    try {
      page = await this.browser.newPage({
        viewport: request.viewport
      });

      logger.info('Screenshot capture started', { url: request.url });

      await page.goto(request.url, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      let screenshot: Buffer;

      if (request.selector) {
        // Screenshot specific element
        const element = page.locator(request.selector).first();
        screenshot = await element.screenshot({ type: 'png' });
      } else {
        // Screenshot full page or viewport
        screenshot = await page.screenshot({
          fullPage: request.fullPage ?? false,
          type: 'png'
        });
      }

      const screenshotUrl = await uploadToCloudinary(screenshot, 'screenshots');

      logger.info('Screenshot captured successfully', {
        url: request.url,
        size: screenshot.length
      });

      return {
        screenshot_url: screenshotUrl,
        width: request.viewport.width,
        height: request.viewport.height,
        file_size: screenshot.length,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      logger.error('Screenshot capture failed', {
        url: request.url,
        error: error.message
      });
      throw error;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }
}
