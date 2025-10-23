# Quest Playwright Service - Deployment Checklist

## ✅ Pre-Deployment Checklist

### 1. Code is Ready
- [x] All files created and committed
- [x] Git repository initialized
- [x] .gitignore configured
- [x] Documentation complete

### 2. GitHub Setup
- [ ] Create GitHub repository at https://github.com/new
  - Name: `quest-playwright-service`
  - Visibility: Public
  - Don't initialize with README (we have it already)
- [ ] Push code to GitHub
  - Run: `./SETUP_GITHUB.sh`
  - Or manually: See commands below

### 3. Railway Deployment
- [ ] Sign in to https://railway.app
- [ ] Create new project from GitHub repo
- [ ] Configure environment variables
- [ ] Wait for deployment to complete
- [ ] Test health endpoint

### 4. Quest Dash Integration
- [ ] Add `PLAYWRIGHT_SERVICE_URL` to Quest Dash `.env`
- [ ] Run database migrations
- [ ] Test Python client
- [ ] Verify citation validation works

---

## 🔧 Manual GitHub Push (if script doesn't work)

```bash
cd /Users/dankeegan/quest-playwright-service

# Replace YOUR-USERNAME with your GitHub username
git remote add origin https://github.com/YOUR-USERNAME/quest-playwright-service.git
git branch -M main
git push -u origin main
```

---

## 🚀 Railway Deployment Steps

### Step 1: Create Railway Project

1. Go to https://railway.app
2. Click **"New Project"**
3. Click **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub (if first time)
5. Select repository: **`quest-playwright-service`**

### Step 2: Configure Environment Variables

In Railway project → **Variables** tab, add:

```bash
CLOUDINARY_CLOUD_NAME=dc7btom12
CLOUDINARY_API_KEY=653994623498835
CLOUDINARY_API_SECRET=MQQ61lBHOeaZsIopjOPlWX1ITBw
LOG_LEVEL=info
NODE_ENV=production
```

Click **"Add"** for each variable.

### Step 3: Deploy

Railway will automatically:
- Detect `Dockerfile`
- Build Docker image
- Deploy container
- Assign public URL

Wait 3-5 minutes for build to complete.

### Step 4: Get Service URL

1. Click on your deployment in Railway
2. Go to **"Settings"** tab
3. Click **"Generate Domain"** under "Networking"
4. Copy the URL (e.g., `https://quest-playwright-production.up.railway.app`)

### Step 5: Test Deployment

```bash
# Test health check
curl https://YOUR-RAILWAY-URL.up.railway.app/health

# Should return:
# {
#   "status": "ok",
#   "service": "quest-playwright-service",
#   "version": "1.0.0",
#   "browser_ready": true
# }
```

---

## 🔗 Quest Dash Integration

### Step 1: Add Environment Variable

```bash
cd /Users/dankeegan/quest-platform/backend

# Add to .env
echo "PLAYWRIGHT_SERVICE_URL=https://YOUR-RAILWAY-URL.up.railway.app" >> .env
```

### Step 2: Install Dependencies (if needed)

```bash
pip install httpx
```

### Step 3: Test Connection

```bash
python3 << 'EOF'
import asyncio
from app.core.playwright_client import PlaywrightClient

async def test():
    client = PlaywrightClient()

    print("🧪 Testing Playwright service connection...")
    health = await client.health_check()
    print(f"✅ Health check: {health}")

    print("\n🧪 Testing citation validation...")
    result = await client.validate_citation(
        url="https://example.com",
        expected_text="Example Domain",
        take_screenshot=True
    )
    print(f"✅ Validation result: {result['status']}")
    print(f"   Screenshot: {result.get('screenshot_url', 'N/A')}")

asyncio.run(test())
EOF
```

### Step 4: Run Database Migrations

```bash
cd /Users/dankeegan/quest-platform/backend

# Create migration file if not exists
cat > migrations/009_playwright_validation.sql << 'SQL'
-- Citation validations
CREATE TABLE IF NOT EXISTS citation_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    status TEXT NOT NULL,
    http_status INTEGER,
    paywall_detected BOOLEAN DEFAULT FALSE,
    text_found BOOLEAN,
    screenshot_url TEXT,
    validated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(article_id, url)
);

CREATE INDEX idx_citation_validations_article ON citation_validations(article_id);
CREATE INDEX idx_citation_validations_status ON citation_validations(status);

-- Deployment verifications
CREATE TABLE IF NOT EXISTS deployment_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    status TEXT NOT NULL,
    checks JSONB NOT NULL,
    performance JSONB,
    verified_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deployment_verifications_article ON deployment_verifications(article_id);
CREATE INDEX idx_deployment_verifications_status ON deployment_verifications(status);

-- Visual regression tests
CREATE TABLE IF NOT EXISTS visual_regression_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    passed BOOLEAN NOT NULL,
    pixel_difference FLOAT,
    threshold FLOAT,
    diff_image_url TEXT,
    tested_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_visual_regression_article ON visual_regression_tests(article_id);
SQL

# Run migration
python run_migrations.py
```

---

## ✅ Verification Checklist

### Playwright Service
- [ ] Health endpoint returns status "ok"
- [ ] Browser is ready (browser_ready: true)
- [ ] Railway logs show no errors
- [ ] Service is using allocated resources (check Railway dashboard)

### Citation Validation
- [ ] Can validate a test URL
- [ ] Screenshot uploads to Cloudinary
- [ ] Paywall detection works
- [ ] Results save to database

### Deployment Verification
- [ ] Can verify a published article
- [ ] CSS checks pass
- [ ] Image checks pass
- [ ] Screenshots captured

---

## 🐛 Troubleshooting

### Issue: GitHub push fails with authentication error

**Solution 1: Configure credential helper**
```bash
git config --global credential.helper osxkeychain
git push -u origin main
```

**Solution 2: Use SSH instead**
```bash
git remote set-url origin git@github.com:YOUR-USERNAME/quest-playwright-service.git
git push -u origin main
```

**Solution 3: Use GitHub personal access token**
1. Go to https://github.com/settings/tokens
2. Generate new token (classic)
3. Select scopes: `repo`
4. Use token as password when pushing

### Issue: Railway build fails

**Check:**
1. Dockerfile syntax is correct
2. All source files are committed to GitHub
3. Railway environment variables are set
4. Check Railway build logs for specific errors

**Common fixes:**
- Rebuild: Click "Deploy" in Railway dashboard
- Check Node.js version in package.json (should be >=18)
- Verify Playwright image tag in Dockerfile

### Issue: Browser fails to launch

**Check Railway logs for:**
- Missing dependencies (Railway should auto-install)
- Memory issues (upgrade Railway instance)
- Timeout errors (increase timeout in code)

### Issue: Cloudinary uploads fail

**Check:**
1. Environment variables are correct
2. Cloudinary credentials are valid
3. Check Railway logs for specific error
4. Test Cloudinary manually:
```bash
curl -X POST "https://api.cloudinary.com/v1_1/dc7btom12/image/upload" \
  -F "file=@test-image.png" \
  -F "upload_preset=ml_default"
```

---

## 📊 Monitoring

### Railway Dashboard
- Check CPU/Memory usage
- Monitor build logs
- View deployment history
- Check bandwidth usage

### Quest Dash Logs
```bash
cd /Users/dankeegan/quest-platform/backend
tail -f logs/quest-platform.log | grep "playwright"
```

### Database Queries
```sql
-- Check citation validations
SELECT status, COUNT(*)
FROM citation_validations
GROUP BY status;

-- Check deployment verifications
SELECT status, COUNT(*)
FROM deployment_verifications
GROUP BY status;
```

---

## 💰 Cost Tracking

### Railway Costs (Monthly)
- Starter Plan: $5/month (500 hours)
- Hobby Plan: $0/month (500 hours free)
- Pro Plan: $20/month (unlimited)

Recommendation: Start with Hobby, upgrade if needed.

### Cloudinary Costs
- Free tier: 25 GB storage, 25 GB bandwidth
- Should be sufficient for Quest platform

### Total Estimated Cost
- Railway: $0-25/month
- Cloudinary: $0/month (free tier)
- **Total: $0-25/month**

---

## ✅ Final Checklist

- [ ] GitHub repository created and code pushed
- [ ] Railway deployment successful
- [ ] Health check passes
- [ ] Environment variables configured
- [ ] Quest Dash `.env` updated
- [ ] Database migrations run
- [ ] Test citation validation works
- [ ] Test deployment verification works
- [ ] Documentation reviewed
- [ ] Costs monitored

---

## 🎉 Success!

Once all checkboxes are complete, your Playwright microservice is fully deployed and integrated!

**Test with real article:**
1. Generate article in Quest Dash
2. Validate citations automatically
3. Verify deployment after publish
4. Check screenshots in Cloudinary

---

## 📞 Support

**Issues?**
- Check Railway logs first
- Review Quest Dash backend logs
- Verify environment variables
- Consult documentation:
  - `README.md` - Service documentation
  - `QUICK_START.md` - Quick deployment
  - `PLAYWRIGHT_DEPLOYMENT_GUIDE.md` - Full guide

**Still stuck?**
- Contact team lead
- Check Railway community: https://railway.app/discord
- Review Playwright docs: https://playwright.dev

---

**Last Updated:** October 23, 2025
**Version:** 1.0.0
**Status:** ✅ Ready for deployment
