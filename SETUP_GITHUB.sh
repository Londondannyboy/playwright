#!/bin/bash

# Quest Playwright Service - GitHub Setup Script
# This script will help you push the code to GitHub and deploy to Railway

set -e  # Exit on error

echo "🚀 Quest Playwright Service - GitHub Setup"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the quest-playwright-service directory"
    exit 1
fi

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Error: Git not initialized. Run: git init"
    exit 1
fi

echo "✅ Git repository initialized"
echo ""

# Ask for GitHub username
echo "📝 Enter your GitHub username:"
read -p "Username: " GITHUB_USERNAME

if [ -z "$GITHUB_USERNAME" ]; then
    echo "❌ Error: GitHub username required"
    exit 1
fi

echo ""
echo "🔗 Setting up GitHub remote..."

# Check if remote already exists
if git remote | grep -q "origin"; then
    echo "⚠️  Remote 'origin' already exists. Removing..."
    git remote remove origin
fi

# Add GitHub remote (HTTPS)
REPO_URL="https://github.com/$GITHUB_USERNAME/quest-playwright-service.git"
git remote add origin "$REPO_URL"

echo "✅ Remote added: $REPO_URL"
echo ""

# Verify commit exists
if ! git log -1 &> /dev/null; then
    echo "❌ Error: No commits found. Run: git commit -m 'Initial commit'"
    exit 1
fi

echo "📤 Pushing to GitHub..."
echo ""
echo "⚠️  If this is your first push, you may need to:"
echo "   1. Go to https://github.com/new"
echo "   2. Create repository: quest-playwright-service"
echo "   3. Leave it empty (don't initialize with README)"
echo "   4. Then come back and press Enter to continue"
echo ""
read -p "Press Enter when repository is created on GitHub..."

# Push to GitHub
echo ""
echo "🚀 Pushing to main branch..."
git branch -M main

if git push -u origin main; then
    echo ""
    echo "✅ Successfully pushed to GitHub!"
    echo ""
    echo "🎉 Next Steps:"
    echo "=============="
    echo ""
    echo "1. ✅ Code is now on GitHub: https://github.com/$GITHUB_USERNAME/quest-playwright-service"
    echo ""
    echo "2. 🚀 Deploy to Railway:"
    echo "   - Go to: https://railway.app"
    echo "   - Click: 'New Project' → 'Deploy from GitHub repo'"
    echo "   - Select: quest-playwright-service"
    echo "   - Add environment variables:"
    echo "     CLOUDINARY_CLOUD_NAME=dc7btom12"
    echo "     CLOUDINARY_API_KEY=653994623498835"
    echo "     CLOUDINARY_API_SECRET=MQQ61lBHOeaZsIopjOPlWX1ITBw"
    echo "   - Click: 'Deploy'"
    echo ""
    echo "3. 🧪 Test deployment:"
    echo "   - Get URL from Railway (e.g., https://quest-playwright-production.up.railway.app)"
    echo "   - Test: curl <URL>/health"
    echo ""
    echo "4. 🔗 Configure Quest Dash:"
    echo "   - Add to backend/.env:"
    echo "     PLAYWRIGHT_SERVICE_URL=<your-railway-url>"
    echo ""
    echo "📚 Full guide: See QUICK_START.md or PLAYWRIGHT_DEPLOYMENT_GUIDE.md"
    echo ""
else
    echo ""
    echo "❌ Push failed. Common issues:"
    echo ""
    echo "1. Repository doesn't exist on GitHub"
    echo "   → Go to https://github.com/new and create 'quest-playwright-service'"
    echo ""
    echo "2. Authentication failed"
    echo "   → Run: git config --global credential.helper osxkeychain"
    echo "   → Or use SSH instead: git remote set-url origin git@github.com:$GITHUB_USERNAME/quest-playwright-service.git"
    echo ""
    echo "3. Permission denied"
    echo "   → Make sure you own the repository or have write access"
    echo ""
    exit 1
fi
