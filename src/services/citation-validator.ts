/**
 * Citation Validator Service
 *
 * Validates citations by:
 * 1. Checking if URL is accessible
 * 2. Detecting paywalls/CAPTCHAs
 * 3. Finding expected text on page
 * 4. Taking screenshot evidence
 */

import { Browser, Page } from 'playwright';
import { logger } from '../utils/logger';
import { uploadToCloudinary } from '../utils/cloudinary';

export interface CitationValidationRequest {
  url: string;
  expectedText?: string;
  takeScreenshot?: boolean;
  checkPaywall?: boolean;
}

export interface CitationValidationResult {
  url: string;
  status: 'valid' | 'paywall' | 'not_found' | 'text_not_found' | 'error' | 'captcha';
  http_status: number;
  text_found: boolean | null;
  text_location?: string;
  paywall_detected: boolean;
  paywall_text?: string;
  captcha_detected: boolean;
  screenshot_url?: string;
  validation_timestamp: string;
  response_time_ms: number;
  page_title?: string;
  error_message?: string;
}

export class CitationValidator {
  private browser: Browser;

  constructor(browser: Browser) {
    this.browser = browser;
  }

  async validate(request: CitationValidationRequest): Promise<CitationValidationResult> {
    const startTime = Date.now();
    let page: Page | null = null;

    try {
      page = await this.browser.newPage({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      });

      logger.info('Citation validation started', { url: request.url });

      // Navigate to URL with timeout
      const response = await page.goto(request.url, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      const httpStatus = response?.status() || 0;
      const pageTitle = await page.title();

      // Check for 404 or error pages
      if (httpStatus >= 400) {
        return {
          url: request.url,
          status: 'not_found',
          http_status: httpStatus,
          text_found: null,
          paywall_detected: false,
          captcha_detected: false,
          validation_timestamp: new Date().toISOString(),
          response_time_ms: Date.now() - startTime,
          page_title: pageTitle
        };
      }

      // Check for CAPTCHA
      const captchaDetected = await this.detectCaptcha(page);
      if (captchaDetected) {
        logger.warn('CAPTCHA detected', { url: request.url });
        return {
          url: request.url,
          status: 'captcha',
          http_status: httpStatus,
          text_found: null,
          paywall_detected: false,
          captcha_detected: true,
          validation_timestamp: new Date().toISOString(),
          response_time_ms: Date.now() - startTime,
          page_title: pageTitle
        };
      }

      // Check for paywall
      let paywallDetected = false;
      let paywallText: string | undefined;

      if (request.checkPaywall) {
        const paywallResult = await this.detectPaywall(page);
        paywallDetected = paywallResult.detected;
        paywallText = paywallResult.text;
      }

      // Check if expected text exists
      let textFound: boolean | null = null;
      let textLocation: string | undefined;

      if (request.expectedText) {
        const textResult = await this.findExpectedText(page, request.expectedText);
        textFound = textResult.found;
        textLocation = textResult.location;
      }

      // Take screenshot
      let screenshotUrl: string | undefined;
      if (request.takeScreenshot) {
        const screenshot = await page.screenshot({
          fullPage: true,
          type: 'png'
        });
        screenshotUrl = await uploadToCloudinary(screenshot, 'citations');
      }

      // Determine final status
      let status: CitationValidationResult['status'] = 'valid';
      if (paywallDetected) {
        status = 'paywall';
      } else if (request.expectedText && !textFound) {
        status = 'text_not_found';
      }

      return {
        url: request.url,
        status,
        http_status: httpStatus,
        text_found: textFound,
        text_location: textLocation,
        paywall_detected: paywallDetected,
        paywall_text: paywallText,
        captcha_detected: false,
        screenshot_url: screenshotUrl,
        validation_timestamp: new Date().toISOString(),
        response_time_ms: Date.now() - startTime,
        page_title: pageTitle
      };
    } catch (error: any) {
      logger.error('Citation validation error', {
        url: request.url,
        error: error.message
      });

      return {
        url: request.url,
        status: 'error',
        http_status: 0,
        text_found: null,
        paywall_detected: false,
        captcha_detected: false,
        validation_timestamp: new Date().toISOString(),
        response_time_ms: Date.now() - startTime,
        error_message: error.message
      };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  private async detectPaywall(page: Page): Promise<{ detected: boolean; text?: string }> {
    const paywallIndicators = [
      'subscribe',
      'subscription',
      'paywall',
      'premium content',
      'member exclusive',
      'sign in to continue',
      'register to read',
      'become a member',
      'unlock this article'
    ];

    for (const indicator of paywallIndicators) {
      const locator = page.locator(`text=/${indicator}/i`).first();
      const count = await locator.count();

      if (count > 0) {
        const text = await locator.textContent();
        return { detected: true, text: text || indicator };
      }
    }

    return { detected: false };
  }

  private async detectCaptcha(page: Page): Promise<boolean> {
    const captchaIndicators = [
      'recaptcha',
      'captcha',
      'hcaptcha',
      'robot verification',
      'verify you are human'
    ];

    for (const indicator of captchaIndicators) {
      const count = await page.locator(`text=/${indicator}/i`).count();
      if (count > 0) {
        return true;
      }
    }

    // Check for reCAPTCHA iframe
    const frames = page.frames();
    for (const frame of frames) {
      const url = frame.url();
      if (url.includes('recaptcha') || url.includes('captcha')) {
        return true;
      }
    }

    return false;
  }

  private async findExpectedText(
    page: Page,
    expectedText: string
  ): Promise<{ found: boolean; location?: string }> {
    try {
      // Try exact match first
      const exactLocator = page.locator(`text="${expectedText}"`);
      let count = await exactLocator.count();

      if (count > 0) {
        return { found: true, location: 'exact match' };
      }

      // Try case-insensitive partial match
      const partialLocator = page.locator(`text=/${expectedText}/i`);
      count = await partialLocator.count();

      if (count > 0) {
        return { found: true, location: 'partial match (case-insensitive)' };
      }

      // Try searching in page content
      const pageContent = await page.content();
      const normalizedContent = pageContent.toLowerCase();
      const normalizedText = expectedText.toLowerCase();

      if (normalizedContent.includes(normalizedText)) {
        return { found: true, location: 'found in HTML content' };
      }

      return { found: false };
    } catch (error: any) {
      logger.error('Error finding expected text', { error: error.message });
      return { found: false };
    }
  }

  async batchValidate(
    citations: CitationValidationRequest[]
  ): Promise<CitationValidationResult[]> {
    logger.info('Batch citation validation started', { count: citations.length });

    const results = await Promise.all(
      citations.map(citation => this.validate(citation))
    );

    logger.info('Batch citation validation completed', {
      count: citations.length,
      valid: results.filter(r => r.status === 'valid').length,
      paywall: results.filter(r => r.status === 'paywall').length,
      errors: results.filter(r => r.status === 'error').length
    });

    return results;
  }
}
