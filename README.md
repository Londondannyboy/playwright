# Playwright Browser Automation Service

Standalone microservice for browser automation tasks using Playwright.

## Purpose

Provides browser automation capabilities as a REST API for:
- **Screenshots**: Capture page visuals (PNG/JPEG)
- **PDF Generation**: Convert pages to PDF
- **Page Interactions**: Click, fill, select elements
- **Front-end Testing**: Automated UI tests
- **HTML Extraction**: Get rendered page HTML

## Why Separate Service?

- **Isolation**: Heavy browser processes don't impact main worker
- **Scalability**: Scale browser automation independently
- **Reusability**: Multiple services can call this API
- **Maintenance**: Update browser/Playwright without touching main apps

## API Endpoints

### 1. Screenshot

Capture page screenshot (full or viewport).

```bash
POST /screenshot
{
  "url": "https://example.com",
  "viewport": {"width": 1920, "height": 1080},
  "full_page": true,
  "format": "png",  # or "jpeg"
  "wait_until": "networkidle"  # or "load", "domcontentloaded"
}

# Response
{
  "success": true,
  "screenshot": "<base64-encoded-image>",
  "size_bytes": 245678,
  "timestamp": "2025-11-13T12:00:00"
}
```

**Use Cases:**
- Visual regression testing
- Page previews/thumbnails
- Design validation
- Documentation screenshots

### 2. PDF Generation

Generate PDF from webpage.

```bash
POST /pdf
{
  "url": "https://example.com",
  "format": "A4",  # or "Letter", "Legal", "Tabloid"
  "print_background": true,
  "wait_until": "networkidle"
}

# Response
{
  "success": true,
  "pdf": "<base64-encoded-pdf>",
  "size_bytes": 456789
}
```

**Use Cases:**
- Report generation
- Page archiving
- Print-friendly versions
- Documentation export

### 3. Page Interactions

Perform actions on a page (clicks, form fills, etc.).

```bash
POST /interact
{
  "url": "https://example.com",
  "actions": [
    {"type": "click", "selector": "#button"},
    {"type": "fill", "selector": "#email", "value": "test@example.com"},
    {"type": "select", "selector": "#country", "value": "US"},
    {"type": "wait", "value": "1000"}
  ],
  "screenshot_after": true
}

# Response
{
  "success": true,
  "actions_executed": 4,
  "results": [...],
  "screenshot": "<base64>" // if requested
}
```

**Use Cases:**
- Form submission testing
- Authentication flows
- Multi-step interactions
- Dynamic content loading

### 4. Front-end Testing

Run automated UI tests.

```bash
POST /test
{
  "url": "https://example.com",
  "tests": [
    {"type": "exists", "selector": "#header"},
    {"type": "visible", "selector": ".button"},
    {"type": "text", "selector": "h1", "expected": "Welcome"}
  ]
}

# Response
{
  "success": true,
  "total_tests": 3,
  "passed": 3,
  "failed": 0,
  "results": [...]
}
```

**Use Cases:**
- Smoke tests
- UI regression tests
- Accessibility checks
- Layout validation

### 5. HTML Extraction

Get rendered page HTML (after JavaScript execution).

```bash
POST /html
{
  "url": "https://example.com"
}

# Response
{
  "success": true,
  "html": "<html>...</html>",
  "title": "Example Domain",
  "html_length": 12345
}
```

**Use Cases:**
- Debugging
- Content extraction
- SEO analysis
- DOM inspection

### 6. Health Check

```bash
GET /health

# Response
{
  "status": "healthy",
  "browser": "ready",
  "timestamp": "2025-11-13T12:00:00"
}
```

## Deployment

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium

# Run service
python main.py
```

Access at: http://localhost:8000

### Docker

```bash
# Build
docker build -t playwright-service .

# Run
docker run -p 8000:8000 playwright-service
```

### Railway

1. Create new Railway project
2. Connect GitHub repo
3. Railway auto-detects Dockerfile
4. Deploy (build takes ~3-5 mins for browser setup)

**Environment:** No environment variables needed for basic operation

**Resources:**
- Memory: 512MB-1GB recommended
- CPU: Shared/1 CPU
- Storage: ~500MB (Chromium browser)

## Integration Examples

### From Quest Worker (Python)

```python
import httpx

async def screenshot_url(url: str) -> bytes:
    """Capture screenshot via Playwright service"""

    response = await httpx.post(
        "https://playwright-service.railway.app/screenshot",
        json={
            "url": url,
            "full_page": True,
            "format": "png"
        },
        timeout=60.0
    )

    result = response.json()
    screenshot_b64 = result["screenshot"]

    # Decode base64
    import base64
    return base64.b64decode(screenshot_b64)


async def test_page_elements(url: str, tests: list) -> dict:
    """Run front-end tests via Playwright service"""

    response = await httpx.post(
        "https://playwright-service.railway.app/test",
        json={
            "url": url,
            "tests": tests
        },
        timeout=60.0
    )

    return response.json()
```

### From Frontend (JavaScript)

```javascript
// Screenshot
const response = await fetch('https://playwright-service.railway.app/screenshot', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    url: 'https://example.com',
    full_page: true
  })
});

const {screenshot} = await response.json();
// screenshot is base64-encoded image

// Display as image
const img = document.createElement('img');
img.src = `data:image/png;base64,${screenshot}`;
```

### cURL Examples

```bash
# Screenshot
curl -X POST https://playwright-service.railway.app/screenshot \
  -H "Content-Type: application/json" \
  -d '{"url": "https://evercore.com", "format": "png"}'

# PDF
curl -X POST https://playwright-service.railway.app/pdf \
  -H "Content-Type: application/json" \
  -d '{"url": "https://evercore.com", "format": "A4"}'

# Interaction
curl -X POST https://playwright-service.railway.app/interact \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "actions": [
      {"type": "click", "selector": "#button"}
    ]
  }'

# Test
curl -X POST https://playwright-service.railway.app/test \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://evercore.com",
    "tests": [
      {"type": "exists", "selector": "h1"}
    ]
  }'
```

## Architecture

```
┌──────────────────┐
│  Quest Worker    │
│  (Python)        │
└────────┬─────────┘
         │ HTTP POST
         ↓
┌──────────────────┐
│  Playwright      │
│  Service         │
│  (Railway)       │
└────────┬─────────┘
         │ Browser automation
         ↓
┌──────────────────┐
│  Chromium        │
│  Browser         │
└──────────────────┘
```

**Benefits:**
- Worker doesn't need browser dependencies
- Browser processes isolated
- Independent scaling
- Failure isolation

## Performance

**Typical Response Times:**
- Screenshot: 2-5 seconds
- PDF: 3-7 seconds
- Interaction: 3-10 seconds (depends on actions)
- Test: 5-15 seconds (depends on test count)
- HTML: 2-5 seconds

**Concurrency:**
- Each request gets a new browser context
- Browser instance shared across requests
- Can handle ~5-10 concurrent requests (depends on Railway resources)

## Error Handling

All endpoints return standardized errors:

```json
{
  "detail": "Error message",
  "status_code": 500
}
```

**Common Errors:**
- 503: Browser not initialized (retry)
- 500: Page load timeout, selector not found, interaction failed
- 422: Invalid request parameters

## Monitoring

Check health endpoint regularly:

```bash
# Every 30 seconds
watch -n 30 'curl https://playwright-service.railway.app/health'
```

## Security Considerations

⚠️ **Important:**
- This service executes browser actions on user-provided URLs
- Consider implementing:
  - Authentication (API keys)
  - Rate limiting
  - URL allowlist/blocklist
  - Request timeouts
  - Resource limits

**Production Recommendations:**
- Add authentication middleware
- Implement request logging
- Set up monitoring/alerts
- Configure Railway autoscaling

## Use Cases in Quest Project

### 1. Company Profile Screenshots
```python
# Capture company homepage for visual previews
screenshot = await capture_screenshot("https://evercore.com")
```

### 2. Front-end Design Testing
```python
# Test responsive design at different viewports
tests = [
    {"type": "exists", "selector": ".hero"},
    {"type": "visible", "selector": ".cta-button"}
]
results = await run_tests("https://placement.quest/companies/evercore", tests)
```

### 3. PDF Reports
```python
# Generate PDF reports from rendered pages
pdf = await generate_pdf("https://placement.quest/reports/monthly")
```

### 4. Form Testing
```python
# Test contact forms
actions = [
    {"type": "fill", "selector": "#email", "value": "test@test.com"},
    {"type": "fill", "selector": "#message", "value": "Hello"},
    {"type": "click", "selector": "#submit"}
]
result = await interact("https://placement.quest/contact", actions)
```

## Future Enhancements

- [ ] Video recording
- [ ] Network request interception
- [ ] Performance metrics (Lighthouse)
- [ ] Mobile device emulation
- [ ] Geolocation spoofing
- [ ] Cookie management
- [ ] localStorage manipulation
- [ ] Multi-browser support (Firefox, WebKit)

## License

Part of Quest project. For internal use.

---

**Created:** 2025-11-13
**Status:** Production Ready
**Maintainer:** Quest Team
