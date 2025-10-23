# Quest Playwright Microservice

Browser automation microservice for Quest Platform providing:

- **Citation Validation** - Verify sources exist and contain expected claims
- **Deployment Verification** - Check CSS, images, fonts, and layout after deploys
- **Visual Regression Testing** - Compare screenshots before/after changes
- **Screenshot Generation** - Capture evidence and social media images

## Features

### 1. Citation Validation

Validates citations by checking:
- URL accessibility (HTTP status)
- Paywall detection (subscription barriers)
- CAPTCHA detection (bot protection)
- Expected text verification (claim matches source)
- Screenshot evidence capture

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/validate-citation \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/article",
    "expected_text": "Chile requires $2000/month income",
    "take_screenshot": true,
    "check_paywall": true
  }'
```

**Response:**
```json
{
  "url": "https://example.com/article",
  "status": "valid",
  "http_status": 200,
  "text_found": true,
  "text_location": "paragraph 3",
  "paywall_detected": false,
  "screenshot_url": "https://cloudinary.com/...",
  "validation_timestamp": "2025-10-23T10:30:00Z"
}
```

### 2. Deployment Verification

Verifies deployments by checking:
- CSS loaded correctly
- Images display properly
- Fonts render as expected
- Layout stability (CLS)
- Performance metrics

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/verify-deployment \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://relocation.quest/news/article",
    "checks": [
      {"type": "screenshot", "viewport": {"width": 1920, "height": 1080}},
      {"type": "css_loaded", "selector": ".article-content"},
      {"type": "images_loaded", "min_count": 3},
      {"type": "fonts_loaded", "font_family": "Inter"}
    ]
  }'
```

### 3. Visual Regression Testing

Compare screenshots to detect visual changes:

```bash
curl -X POST http://localhost:3000/api/visual-regression \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://relocation.quest/news/article",
    "baseline_screenshot": "https://cloudinary.com/baseline.png",
    "threshold": 0.1,
    "viewport": {"width": 1920, "height": 1080}
  }'
```

### 4. Screenshot Generation

Capture screenshots for any use case:

```bash
curl -X POST http://localhost:3000/api/screenshot \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://relocation.quest",
    "viewport": {"width": 1200, "height": 630},
    "selector": ".hero-section"
  }'
```

## Deployment

### Railway (Recommended)

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/quest-playwright-service.git
   git push -u origin main
   ```

2. **Deploy to Railway:**
   - Go to https://railway.app
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Add environment variables:
     - `CLOUDINARY_CLOUD_NAME`
     - `CLOUDINARY_API_KEY`
     - `CLOUDINARY_API_SECRET`

3. **Get URL:**
   - Railway will provide: `https://your-app.up.railway.app`
   - Test health: `curl https://your-app.up.railway.app/health`

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Install Playwright browsers:**
   ```bash
   npx playwright install chromium
   ```

3. **Copy environment file:**
   ```bash
   cp .env.example .env
   # Edit .env with your Cloudinary credentials
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

5. **Test endpoints:**
   ```bash
   curl http://localhost:3000/health
   ```

## API Documentation

### Endpoints

#### `POST /api/validate-citation`
Validate a citation exists and contains expected text.

**Request Body:**
```typescript
{
  url: string;                 // URL to validate
  expected_text?: string;      // Text to find on page
  take_screenshot?: boolean;   // Capture evidence (default: true)
  check_paywall?: boolean;     // Detect paywalls (default: true)
}
```

#### `POST /api/verify-deployment`
Verify a deployment renders correctly.

**Request Body:**
```typescript
{
  url: string;                 // URL to verify
  checks: Array<{              // Checks to run
    type: 'screenshot' | 'css_loaded' | 'images_loaded' | 'fonts_loaded' | 'layout_stable';
    selector?: string;         // CSS selector (for css_loaded)
    viewport?: { width: number; height: number };
    min_count?: number;        // Min images (for images_loaded)
    font_family?: string;      // Font to check (for fonts_loaded)
  }>;
  compare_to?: string;         // Optional baseline URL
}
```

#### `POST /api/screenshot`
Capture a screenshot.

**Request Body:**
```typescript
{
  url: string;                           // URL to screenshot
  viewport: { width: number; height: number };
  selector?: string;                     // Optional element selector
  full_page?: boolean;                   // Full page scroll (default: false)
}
```

#### `POST /api/visual-regression`
Compare screenshot with baseline.

**Request Body:**
```typescript
{
  url: string;                           // URL to test
  baseline_screenshot?: string;          // Baseline image URL
  threshold: number;                     // Max allowed difference (0.0-1.0)
  viewport: { width: number; height: number };
}
```

#### `POST /api/batch-validate-citations`
Validate multiple citations in parallel.

**Request Body:**
```typescript
{
  citations: Array<{
    url: string;
    expected_text?: string;
    take_screenshot?: boolean;
    check_paywall?: boolean;
  }>;
}
```

## Architecture

```
quest-playwright-service/
├── src/
│   ├── index.ts                    # Express server
│   ├── services/
│   │   ├── citation-validator.ts   # Citation validation logic
│   │   ├── deployment-verifier.ts  # Deployment checks
│   │   └── screenshot-service.ts   # Screenshot capture
│   ├── utils/
│   │   ├── logger.ts               # Winston logger
│   │   ├── cloudinary.ts           # Image uploads
│   │   └── image-comparison.ts     # Visual regression
│   └── middleware/
│       ├── error-handler.ts        # Global error handling
│       └── request-logger.ts       # Request logging
├── Dockerfile                       # Container build
├── railway.json                     # Railway config
├── package.json
└── tsconfig.json
```

## Performance

- **Browser pool:** Single browser instance, multiple pages
- **Concurrent requests:** Handles multiple validations in parallel
- **Memory usage:** ~500MB-1GB (Chromium headless)
- **Response time:**
  - Citation validation: 2-5 seconds
  - Screenshot: 1-3 seconds
  - Deployment verification: 3-8 seconds

## Cost Estimation (Railway)

```
Compute: $20-25/month (1GB RAM, always-on)
Bandwidth: $3-5/month
Total: ~$25-30/month
```

## Troubleshooting

### Browser fails to launch
```bash
# Install system dependencies (Railway auto-handles)
npx playwright install-deps chromium
```

### Timeout errors
Increase timeout in requests:
```typescript
await page.goto(url, { timeout: 60000 }); // 60 seconds
```

### Memory issues
Railway automatically restarts if memory exceeds limits. Consider:
- Increasing Railway instance size
- Implementing browser restart logic
- Reducing concurrent requests

## Integration with Quest Platform

See Quest Platform backend integration:
- `quest-platform/backend/app/core/playwright_client.py`
- `quest-platform/backend/app/agents/citation_agent.py`
- `quest-platform/backend/app/workflows/deployment_verification.py`

## License

MIT

## Support

For issues, contact Quest Platform team or create GitHub issue.
