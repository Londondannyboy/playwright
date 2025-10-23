/**
 * Quest Playwright Microservice
 *
 * Provides browser automation for:
 * 1. Citation validation (check sources exist, detect paywalls)
 * 2. Deployment verification (CSS validation, visual testing)
 * 3. Screenshot generation (social media, evidence)
 */

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { chromium, Browser, Page } from 'playwright';
import { logger } from './utils/logger';
import { CitationValidator } from './services/citation-validator';
import { DeploymentVerifier } from './services/deployment-verifier';
import { ScreenshotService } from './services/screenshot-service';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Global browser instance
let browser: Browser | null = null;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'quest-playwright-service',
    version: '1.0.0',
    browser_ready: browser !== null,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Citation validation endpoint
app.post('/api/validate-citation', async (req: Request, res: Response) => {
  try {
    const { url, expected_text, take_screenshot, check_paywall } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!browser) {
      throw new Error('Browser not initialized');
    }

    const validator = new CitationValidator(browser);
    const result = await validator.validate({
      url,
      expectedText: expected_text,
      takeScreenshot: take_screenshot ?? true,
      checkPaywall: check_paywall ?? true
    });

    logger.info('Citation validated', { url, status: result.status });

    res.json(result);
  } catch (error: any) {
    logger.error('Citation validation failed', { error: error.message });
    res.status(500).json({
      error: 'Citation validation failed',
      message: error.message
    });
  }
});

// Deployment verification endpoint
app.post('/api/verify-deployment', async (req: Request, res: Response) => {
  try {
    const { url, checks, compare_to } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!browser) {
      throw new Error('Browser not initialized');
    }

    const verifier = new DeploymentVerifier(browser);
    const result = await verifier.verify({
      url,
      checks: checks || [],
      compareTo: compare_to
    });

    logger.info('Deployment verified', { url, status: result.status });

    res.json(result);
  } catch (error: any) {
    logger.error('Deployment verification failed', { error: error.message });
    res.status(500).json({
      error: 'Deployment verification failed',
      message: error.message
    });
  }
});

// Screenshot endpoint
app.post('/api/screenshot', async (req: Request, res: Response) => {
  try {
    const { url, viewport, selector, full_page } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!browser) {
      throw new Error('Browser not initialized');
    }

    const screenshotService = new ScreenshotService(browser);
    const result = await screenshotService.capture({
      url,
      viewport: viewport || { width: 1920, height: 1080 },
      selector,
      fullPage: full_page ?? false
    });

    logger.info('Screenshot captured', { url });

    res.json(result);
  } catch (error: any) {
    logger.error('Screenshot capture failed', { error: error.message });
    res.status(500).json({
      error: 'Screenshot capture failed',
      message: error.message
    });
  }
});

// Visual regression endpoint
app.post('/api/visual-regression', async (req: Request, res: Response) => {
  try {
    const { url, baseline_screenshot, threshold, viewport } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!browser) {
      throw new Error('Browser not initialized');
    }

    const verifier = new DeploymentVerifier(browser);
    const result = await verifier.visualRegression({
      url,
      baselineScreenshot: baseline_screenshot,
      threshold: threshold ?? 0.1,
      viewport: viewport || { width: 1920, height: 1080 }
    });

    logger.info('Visual regression test completed', { url, passed: result.passed });

    res.json(result);
  } catch (error: any) {
    logger.error('Visual regression test failed', { error: error.message });
    res.status(500).json({
      error: 'Visual regression test failed',
      message: error.message
    });
  }
});

// Batch citation validation
app.post('/api/batch-validate-citations', async (req: Request, res: Response) => {
  try {
    const { citations } = req.body;

    if (!citations || !Array.isArray(citations)) {
      return res.status(400).json({ error: 'Citations array is required' });
    }

    if (!browser) {
      throw new Error('Browser not initialized');
    }

    const validator = new CitationValidator(browser);
    const results = await validator.batchValidate(citations);

    logger.info('Batch citation validation completed', {
      total: citations.length,
      valid: results.filter(r => r.status === 'valid').length
    });

    res.json({
      total: citations.length,
      results
    });
  } catch (error: any) {
    logger.error('Batch citation validation failed', { error: error.message });
    res.status(500).json({
      error: 'Batch citation validation failed',
      message: error.message
    });
  }
});

// Error handling
app.use(errorHandler);

// Initialize browser and start server
async function startServer() {
  try {
    logger.info('Initializing browser...');

    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    logger.info('Browser initialized successfully');

    app.listen(PORT, () => {
      logger.info(`Quest Playwright Service running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error: any) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');

  if (browser) {
    await browser.close();
    logger.info('Browser closed');
  }

  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');

  if (browser) {
    await browser.close();
    logger.info('Browser closed');
  }

  process.exit(0);
});

// Start the server
startServer();
