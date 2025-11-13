#!/usr/bin/env python3
"""
Playwright Browser Automation Service

Microservice for browser automation tasks:
- Screenshots
- PDF generation
- Page interactions
- Front-end testing
- Visual regression
"""
import asyncio
import base64
from datetime import datetime
from typing import Optional, List, Dict
from enum import Enum

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, HttpUrl
import uvicorn

try:
    from playwright.async_api import async_playwright, Browser, BrowserContext, Page
except ImportError:
    print("❌ playwright not installed")
    import sys
    sys.exit(1)


app = FastAPI(
    title="Playwright Browser Automation Service",
    description="Browser automation microservice for screenshots, PDFs, testing, and interactions",
    version="1.0.0"
)


class ViewportSize(BaseModel):
    """Viewport dimensions"""
    width: int = 1920
    height: int = 1080


class ScreenshotFormat(str, Enum):
    """Screenshot format options"""
    PNG = "png"
    JPEG = "jpeg"


class ScreenshotRequest(BaseModel):
    """Request model for screenshots"""
    url: HttpUrl
    viewport: Optional[ViewportSize] = ViewportSize()
    full_page: bool = True
    format: ScreenshotFormat = ScreenshotFormat.PNG
    wait_until: str = "networkidle"  # domcontentloaded, load, networkidle


class PDFRequest(BaseModel):
    """Request model for PDF generation"""
    url: HttpUrl
    viewport: Optional[ViewportSize] = ViewportSize()
    format: str = "A4"  # A4, Letter, Legal, Tabloid
    print_background: bool = True
    wait_until: str = "networkidle"


class InteractionRequest(BaseModel):
    """Request model for page interactions"""
    url: HttpUrl
    actions: List[Dict]  # List of {type: "click"|"fill"|"select", selector: str, value: str}
    viewport: Optional[ViewportSize] = ViewportSize()
    screenshot_after: bool = True
    wait_until: str = "networkidle"


class TestRequest(BaseModel):
    """Request model for front-end testing"""
    url: HttpUrl
    tests: List[Dict]  # List of {type: "exists"|"visible"|"text", selector: str, expected: str}
    viewport: Optional[ViewportSize] = ViewportSize()


# Global browser instance (initialized on startup)
browser: Optional[Browser] = None


@app.on_event("startup")
async def startup():
    """Initialize browser on startup"""
    global browser
    print("🚀 Initializing Playwright browser...")
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(
        headless=True,
        args=['--no-sandbox', '--disable-setuid-sandbox']  # Railway compatibility
    )
    print("✅ Browser ready")


@app.on_event("shutdown")
async def shutdown():
    """Close browser on shutdown"""
    global browser
    if browser:
        await browser.close()
        print("👋 Browser closed")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Playwright Browser Automation",
        "version": "1.0.0",
        "endpoints": {
            "/screenshot": "POST - Capture page screenshot",
            "/pdf": "POST - Generate PDF",
            "/interact": "POST - Perform page interactions",
            "/test": "POST - Run front-end tests",
            "/html": "POST - Get page HTML",
            "/health": "GET - Health check"
        }
    }


@app.get("/health")
async def health():
    """Health check"""
    return {
        "status": "healthy",
        "browser": "ready" if browser else "not_initialized",
        "timestamp": datetime.now().isoformat()
    }


@app.post("/screenshot")
async def capture_screenshot(request: ScreenshotRequest):
    """
    Capture a screenshot of a webpage

    Returns base64-encoded image
    """
    if not browser:
        raise HTTPException(status_code=503, detail="Browser not initialized")

    print(f"📸 Screenshot: {request.url}")

    try:
        context = await browser.new_context(
            viewport={"width": request.viewport.width, "height": request.viewport.height}
        )
        page = await context.new_page()

        await page.goto(str(request.url), wait_until=request.wait_until, timeout=30000)

        screenshot_bytes = await page.screenshot(
            full_page=request.full_page,
            type=request.format.value
        )

        await context.close()

        # Return as base64
        screenshot_b64 = base64.b64encode(screenshot_bytes).decode('utf-8')

        return {
            "success": True,
            "url": str(request.url),
            "format": request.format.value,
            "size_bytes": len(screenshot_bytes),
            "screenshot": screenshot_b64,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        print(f"❌ Screenshot error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/pdf")
async def generate_pdf(request: PDFRequest):
    """
    Generate PDF from webpage

    Returns base64-encoded PDF
    """
    if not browser:
        raise HTTPException(status_code=503, detail="Browser not initialized")

    print(f"📄 PDF: {request.url}")

    try:
        context = await browser.new_context(
            viewport={"width": request.viewport.width, "height": request.viewport.height}
        )
        page = await context.new_page()

        await page.goto(str(request.url), wait_until=request.wait_until, timeout=30000)

        pdf_bytes = await page.pdf(
            format=request.format,
            print_background=request.print_background
        )

        await context.close()

        # Return as base64
        pdf_b64 = base64.b64encode(pdf_bytes).decode('utf-8')

        return {
            "success": True,
            "url": str(request.url),
            "format": request.format,
            "size_bytes": len(pdf_bytes),
            "pdf": pdf_b64,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        print(f"❌ PDF error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/interact")
async def perform_interactions(request: InteractionRequest):
    """
    Perform interactions on a webpage (click, fill, select)

    Actions format:
    [
        {"type": "click", "selector": "#button"},
        {"type": "fill", "selector": "#input", "value": "text"},
        {"type": "select", "selector": "#dropdown", "value": "option"}
    ]
    """
    if not browser:
        raise HTTPException(status_code=503, detail="Browser not initialized")

    print(f"🖱️  Interact: {request.url}")

    try:
        context = await browser.new_context(
            viewport={"width": request.viewport.width, "height": request.viewport.height}
        )
        page = await context.new_page()

        await page.goto(str(request.url), wait_until=request.wait_until, timeout=30000)

        results = []
        for action in request.actions:
            action_type = action.get("type")
            selector = action.get("selector")
            value = action.get("value")

            if action_type == "click":
                await page.click(selector)
                results.append({"action": "click", "selector": selector, "success": True})

            elif action_type == "fill":
                await page.fill(selector, value)
                results.append({"action": "fill", "selector": selector, "value": value, "success": True})

            elif action_type == "select":
                await page.select_option(selector, value)
                results.append({"action": "select", "selector": selector, "value": value, "success": True})

            elif action_type == "wait":
                await page.wait_for_timeout(int(value))
                results.append({"action": "wait", "duration_ms": value, "success": True})

            else:
                results.append({"action": action_type, "success": False, "error": "Unknown action type"})

        # Optional screenshot after interactions
        screenshot_b64 = None
        if request.screenshot_after:
            screenshot_bytes = await page.screenshot(full_page=True)
            screenshot_b64 = base64.b64encode(screenshot_bytes).decode('utf-8')

        await context.close()

        return {
            "success": True,
            "url": str(request.url),
            "actions_executed": len(results),
            "results": results,
            "screenshot": screenshot_b64,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        print(f"❌ Interaction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/test")
async def run_frontend_tests(request: TestRequest):
    """
    Run front-end tests on a webpage

    Tests format:
    [
        {"type": "exists", "selector": "#element"},
        {"type": "visible", "selector": ".button"},
        {"type": "text", "selector": "h1", "expected": "Welcome"}
    ]
    """
    if not browser:
        raise HTTPException(status_code=503, detail="Browser not initialized")

    print(f"🧪 Test: {request.url}")

    try:
        context = await browser.new_context(
            viewport={"width": request.viewport.width, "height": request.viewport.height}
        )
        page = await context.new_page()

        await page.goto(str(request.url), wait_until="networkidle", timeout=30000)

        results = []
        passed = 0
        failed = 0

        for test in request.tests:
            test_type = test.get("type")
            selector = test.get("selector")
            expected = test.get("expected")

            try:
                if test_type == "exists":
                    element = await page.query_selector(selector)
                    success = element is not None
                    results.append({"test": "exists", "selector": selector, "passed": success})

                elif test_type == "visible":
                    element = await page.query_selector(selector)
                    success = element is not None and await element.is_visible()
                    results.append({"test": "visible", "selector": selector, "passed": success})

                elif test_type == "text":
                    element = await page.query_selector(selector)
                    if element:
                        text = await element.inner_text()
                        success = expected in text
                        results.append({"test": "text", "selector": selector, "expected": expected, "actual": text, "passed": success})
                    else:
                        results.append({"test": "text", "selector": selector, "passed": False, "error": "Element not found"})
                        success = False

                if success:
                    passed += 1
                else:
                    failed += 1

            except Exception as e:
                results.append({"test": test_type, "selector": selector, "passed": False, "error": str(e)})
                failed += 1

        await context.close()

        return {
            "success": failed == 0,
            "url": str(request.url),
            "total_tests": len(results),
            "passed": passed,
            "failed": failed,
            "results": results,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        print(f"❌ Test error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/html")
async def get_html(request: ScreenshotRequest):
    """
    Get page HTML content (useful for debugging)
    """
    if not browser:
        raise HTTPException(status_code=503, detail="Browser not initialized")

    print(f"📝 HTML: {request.url}")

    try:
        context = await browser.new_context(
            viewport={"width": request.viewport.width, "height": request.viewport.height}
        )
        page = await context.new_page()

        await page.goto(str(request.url), wait_until=request.wait_until, timeout=30000)

        html = await page.content()
        title = await page.title()

        await context.close()

        return {
            "success": True,
            "url": str(request.url),
            "title": title,
            "html": html,
            "html_length": len(html),
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        print(f"❌ HTML error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    print("🚀 Starting Playwright Browser Automation Service...")
    print("   Port: 8000")
    print("   Endpoints: /screenshot, /pdf, /interact, /test, /html, /health")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
