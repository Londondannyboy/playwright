# Quest Playwright Service - Quick Start

## 🚀 Deploy in 10 Minutes

### Step 1: Push to GitHub (2 minutes)

```bash
cd /Users/dankeegan/quest-playwright-service

# Initialize and push
git init
git add .
git commit -m "Initial commit: Quest Playwright microservice"

# Create GitHub repo
gh repo create quest-playwright-service --public --source=. --remote=origin --push
```

### Step 2: Deploy to Railway (5 minutes)

1. Go to https://railway.app
2. Click **"New Project"**
3. Click **"Deploy from GitHub repo"**
4. Select **`quest-playwright-service`**
5. Railway auto-detects Dockerfile and deploys ✅

### Step 3: Add Environment Variables (2 minutes)

In Railway dashboard → **Variables** tab:

```bash
CLOUDINARY_CLOUD_NAME=dc7btom12
CLOUDINARY_API_KEY=653994623498835
CLOUDINARY_API_SECRET=MQQ61lBHOeaZsIopjOPlWX1ITBw
LOG_LEVEL=info
NODE_ENV=production
```

Click **"Deploy"**

### Step 4: Get URL and Test (1 minute)

Railway provides URL like:
```
https://quest-playwright-production.up.railway.app
```

Test it:
```bash
curl https://quest-playwright-production.up.railway.app/health
```

Should return:
```json
{
  "status": "ok",
  "service": "quest-playwright-service",
  "version": "1.0.0",
  "browser_ready": true
}
```

---

## ✅ Done!

Your Playwright service is live. Now integrate with Quest Dash:

```bash
cd /Users/dankeegan/quest-platform/backend

# Add to .env
echo "PLAYWRIGHT_SERVICE_URL=https://quest-playwright-production.up.railway.app" >> .env

# Test integration
python3 << 'EOF'
import asyncio
from app.core.playwright_client import PlaywrightClient

async def test():
    client = PlaywrightClient()
    health = await client.health_check()
    print("✅ Connected:", health)

asyncio.run(test())
EOF
```

---

## 📝 Next Steps

1. Read full deployment guide: `PLAYWRIGHT_DEPLOYMENT_GUIDE.md`
2. Test citation validation with real URLs
3. Enable deployment verification
4. Monitor Railway logs

---

## 💰 Cost

**Railway:** ~$25-30/month (1GB RAM, always-on)

Start with Railway's free trial, then upgrade when ready.

---

## 🆘 Troubleshooting

**Service not starting?**
- Check Railway logs for errors
- Verify environment variables are set
- Ensure Cloudinary credentials are correct

**Timeouts?**
- Increase timeout in `quest-platform/backend/app/core/playwright_client.py`
- Check Railway instance size (upgrade if needed)

**Questions?**
- Check `README.md` for full documentation
- Review Railway logs
- Contact team lead

---

**Ready to deploy? Let's go! 🚀**
