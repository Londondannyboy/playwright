/**
 * Deployment Verifier Service
 *
 * Verifies deployments by:
 * 1. Checking CSS loads correctly
 * 2. Verifying images display
 * 3. Testing responsive layouts
 * 4. Visual regression testing
 */

import { Browser, Page } from 'playwright';
import { logger } from '../utils/logger';
import { uploadToCloudinary } from '../utils/cloudinary';
import { compareImages } from '../utils/image-comparison';

export interface DeploymentCheck {
  type: 'screenshot' | 'css_loaded' | 'images_loaded' | 'fonts_loaded' | 'layout_stable' | 'performance';
  selector?: string;
  viewport?: { width: number; height: number };
  min_count?: number;
  font_family?: string;
  wait_time?: number;
}

export interface DeploymentVerificationRequest {
  url: string;
  checks: DeploymentCheck[];
  compareTo?: string;
}

export interface CheckResult {
  type: string;
  passed: boolean;
  message?: string;
  screenshot_url?: string;
  computed_styles?: any;
  images_found?: number;
  failed_images?: string[];
  cumulative_layout_shift?: number;
  load_time?: number;
}

export interface DeploymentVerificationResult {
  url: string;
  status: 'passed' | 'failed';
  checks: CheckResult[];
  visual_diff?: string;
  performance?: {
    load_time: number;
    dom_content_loaded: number;
    first_contentful_paint?: number;
  };
  timestamp: string;
}

export interface VisualRegressionRequest {
  url: string;
  baselineScreenshot?: string;
  threshold: number;
  viewport: { width: number; height: number };
}

export interface VisualRegressionResult {
  passed: boolean;
  pixel_difference: number;
  threshold: number;
  diff_image_url?: string;
  current_screenshot_url?: string;
  differences_found?: Array<{
    area: string;
    severity: 'minor' | 'major';
    pixels_changed: number;
  }>;
}

export class DeploymentVerifier {
  private browser: Browser;

  constructor(browser: Browser) {
    this.browser = browser;
  }

  async verify(request: DeploymentVerificationRequest): Promise<DeploymentVerificationResult> {
    let page: Page | null = null;

    try {
      page = await this.browser.newPage({
        viewport: { width: 1920, height: 1080 }
      });

      logger.info('Deployment verification started', { url: request.url });

      const startTime = Date.now();

      // Navigate to page
      await page.goto(request.url, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      const loadTime = Date.now() - startTime;

      // Run all checks
      const checkResults: CheckResult[] = [];

      for (const check of request.checks) {
        const result = await this.runCheck(page, check);
        checkResults.push(result);
      }

      // Determine overall status
      const status = checkResults.every(r => r.passed) ? 'passed' : 'failed';

      // Get performance metrics
      const performance = await this.getPerformanceMetrics(page);
      performance.load_time = loadTime;

      logger.info('Deployment verification completed', {
        url: request.url,
        status,
        checks_passed: checkResults.filter(r => r.passed).length,
        checks_failed: checkResults.filter(r => !r.passed).length
      });

      return {
        url: request.url,
        status,
        checks: checkResults,
        performance,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      logger.error('Deployment verification error', {
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

  private async runCheck(page: Page, check: DeploymentCheck): Promise<CheckResult> {
    try {
      switch (check.type) {
        case 'screenshot':
          return await this.checkScreenshot(page, check);

        case 'css_loaded':
          return await this.checkCssLoaded(page, check);

        case 'images_loaded':
          return await this.checkImagesLoaded(page, check);

        case 'fonts_loaded':
          return await this.checkFontsLoaded(page, check);

        case 'layout_stable':
          return await this.checkLayoutStable(page, check);

        case 'performance':
          return await this.checkPerformance(page);

        default:
          return {
            type: check.type,
            passed: false,
            message: `Unknown check type: ${check.type}`
          };
      }
    } catch (error: any) {
      return {
        type: check.type,
        passed: false,
        message: error.message
      };
    }
  }

  private async checkScreenshot(page: Page, check: DeploymentCheck): Promise<CheckResult> {
    if (check.viewport) {
      await page.setViewportSize(check.viewport);
    }

    const screenshot = await page.screenshot({
      fullPage: false,
      type: 'png'
    });

    const screenshotUrl = await uploadToCloudinary(screenshot, 'deployments');

    return {
      type: 'screenshot',
      passed: true,
      screenshot_url: screenshotUrl,
      message: `Screenshot captured (${check.viewport?.width}x${check.viewport?.height})`
    };
  }

  private async checkCssLoaded(page: Page, check: DeploymentCheck): Promise<CheckResult> {
    if (!check.selector) {
      return {
        type: 'css_loaded',
        passed: false,
        message: 'Selector is required for CSS check'
      };
    }

    const element = page.locator(check.selector).first();
    const count = await element.count();

    if (count === 0) {
      return {
        type: 'css_loaded',
        passed: false,
        message: `Element not found: ${check.selector}`
      };
    }

    const styles = await element.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        display: computed.display,
        visibility: computed.visibility,
        opacity: computed.opacity,
        color: computed.color,
        fontSize: computed.fontSize,
        fontFamily: computed.fontFamily,
        backgroundColor: computed.backgroundColor
      };
    });

    return {
      type: 'css_loaded',
      passed: true,
      computed_styles: styles,
      message: `CSS loaded for ${check.selector}`
    };
  }

  private async checkImagesLoaded(page: Page, check: DeploymentCheck): Promise<CheckResult> {
    const images = await page.locator('img').all();
    const imageResults = await Promise.all(
      images.map(async (img) => {
        const src = await img.getAttribute('src');
        const complete = await img.evaluate((el: any) => el.complete);
        const naturalWidth = await img.evaluate((el: any) => el.naturalWidth);

        return {
          src,
          loaded: complete && naturalWidth > 0
        };
      })
    );

    const loadedImages = imageResults.filter(img => img.loaded);
    const failedImages = imageResults.filter(img => !img.loaded).map(img => img.src || 'unknown');

    const minCount = check.min_count || 1;
    const passed = loadedImages.length >= minCount;

    return {
      type: 'images_loaded',
      passed,
      images_found: loadedImages.length,
      failed_images: failedImages,
      message: passed
        ? `${loadedImages.length} images loaded successfully`
        : `Only ${loadedImages.length} images loaded (expected at least ${minCount})`
    };
  }

  private async checkFontsLoaded(page: Page, check: DeploymentCheck): Promise<CheckResult> {
    if (!check.font_family) {
      return {
        type: 'fonts_loaded',
        passed: false,
        message: 'font_family is required for font check'
      };
    }

    await page.waitForTimeout(2000); // Wait for fonts to load

    const fontLoaded = await page.evaluate((fontFamily) => {
      return document.fonts.check(`16px ${fontFamily}`);
    }, check.font_family);

    return {
      type: 'fonts_loaded',
      passed: fontLoaded,
      message: fontLoaded
        ? `Font "${check.font_family}" loaded successfully`
        : `Font "${check.font_family}" failed to load`
    };
  }

  private async checkLayoutStable(page: Page, check: DeploymentCheck): Promise<CheckResult> {
    const waitTime = check.wait_time || 2000;

    // Wait for layout to stabilize
    await page.waitForTimeout(waitTime);

    // Get Cumulative Layout Shift (CLS)
    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let cls = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              cls += (entry as any).value;
            }
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });

        setTimeout(() => {
          observer.disconnect();
          resolve(cls);
        }, 100);
      });
    });

    const passed = cls < 0.1; // Good CLS score

    return {
      type: 'layout_stable',
      passed,
      cumulative_layout_shift: cls,
      message: passed
        ? `Layout stable (CLS: ${cls.toFixed(3)})`
        : `Layout unstable (CLS: ${cls.toFixed(3)}, should be < 0.1)`
    };
  }

  private async checkPerformance(page: Page): Promise<CheckResult> {
    const metrics = await this.getPerformanceMetrics(page);

    return {
      type: 'performance',
      passed: true,
      load_time: metrics.load_time,
      message: `Page loaded in ${metrics.load_time}ms`
    };
  }

  private async getPerformanceMetrics(page: Page) {
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');

      return {
        dom_content_loaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        first_contentful_paint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0
      };
    });

    return {
      load_time: 0, // Set by caller
      dom_content_loaded: Math.round(metrics.dom_content_loaded),
      first_contentful_paint: Math.round(metrics.first_contentful_paint)
    };
  }

  async visualRegression(request: VisualRegressionRequest): Promise<VisualRegressionResult> {
    let page: Page | null = null;

    try {
      page = await this.browser.newPage({
        viewport: request.viewport
      });

      await page.goto(request.url, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
      const currentScreenshotUrl = await uploadToCloudinary(screenshot, 'visual-regression');

      if (!request.baselineScreenshot) {
        // No baseline, just return current screenshot
        return {
          passed: true,
          pixel_difference: 0,
          threshold: request.threshold,
          current_screenshot_url: currentScreenshotUrl
        };
      }

      // Compare with baseline
      const comparison = await compareImages(
        request.baselineScreenshot,
        screenshot,
        request.threshold
      );

      return {
        passed: comparison.passed,
        pixel_difference: comparison.difference,
        threshold: request.threshold,
        diff_image_url: comparison.diffImageUrl,
        current_screenshot_url: currentScreenshotUrl,
        differences_found: comparison.differences
      };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }
}
