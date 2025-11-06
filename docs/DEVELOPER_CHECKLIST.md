# Developer Quick Reference Checklist

Quick reference for common documentation portal tasks. For detailed instructions, see [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md).

---

## 📝 Adding a New User Guide

### Preparation
- [ ] Feature name decided: `_____________`
- [ ] Icon emoji selected: `_____________`
- [ ] English guide ready: ☐ Yes ☐ No
- [ ] Indonesian guide ready: ☐ Yes ☐ No

### Step-by-Step

#### 1. Create Source Files
**Location:** `lib/screens/responsive/{feature}/`

- [ ] Create `{FEATURE}_USER_GUIDE_EN.html`
- [ ] Create `{FEATURE}_USER_GUIDE_ID.html` (or skip if not ready)
- [ ] Verify files follow existing HTML structure
- [ ] Test styling and responsiveness

#### 2. Update copy-guides.sh
**File:** `docs/copy-guides.sh`

Add this code block:
```bash
# {Feature} guides
if [ -f "lib/screens/responsive/{feature}/{FEATURE}_USER_GUIDE_EN.html" ]; then
    cp lib/screens/responsive/{feature}/{FEATURE}_USER_GUIDE_EN.html docs/{feature}-guide-en.html
    echo "✅ Copied {feature}-guide-en.html"
else
    echo "⚠️  {Feature} English guide not found"
fi

if [ -f "lib/screens/responsive/{feature}/{FEATURE}_USER_GUIDE_ID.html" ]; then
    cp lib/screens/responsive/{feature}/{FEATURE}_USER_GUIDE_ID.html docs/{feature}-guide-id.html
    echo "✅ Copied {feature}-guide-id.html"
else
    echo "⚠️  {Feature} Indonesian guide not found"
fi
```

- [ ] Code added to `copy-guides.sh`
- [ ] File paths verified
- [ ] Script tested: `./copy-guides.sh`

#### 3. Update index.html - English Section
**File:** `docs/index.html`
**Location:** Inside `<div id="guides-en" class="guides-grid">`

```html
<a href="{feature}-guide-en.html" class="guide-card">
    <div class="icon">{emoji}</div>
    <h2>{Feature Name}</h2>
    <p>{Brief description of what this guide covers.}</p>
    <span class="badge">English</span>
</a>
```

- [ ] Card added to English section
- [ ] Icon, title, description filled in
- [ ] href matches compiled filename

#### 4. Update index.html - Indonesian Section
**File:** `docs/index.html`
**Location:** Inside `<div id="guides-id" class="guides-grid hidden">`

**If guide exists:**
```html
<a href="{feature}-guide-id.html" class="guide-card">
    <div class="icon">{emoji}</div>
    <h2>{Nama Fitur}</h2>
    <p>{Deskripsi singkat tentang panduan ini.}</p>
    <span class="badge">Bahasa Indonesia</span>
</a>
```

**If guide NOT ready yet:**
```html
<div class="guide-card" style="opacity: 0.6; cursor: not-allowed;">
    <div class="icon">{emoji}</div>
    <h2>{Nama Fitur}</h2>
    <p>{Deskripsi singkat tentang panduan ini.}</p>
    <span class="badge" style="background: #999;">Coming Soon</span>
</div>
```

- [ ] Card added to Indonesian section
- [ ] Indonesian title and description added
- [ ] Correct template used (link vs coming soon)

#### 5. Compile and Test
```bash
cd docs
./copy-guides.sh
```

- [ ] Script ran without errors
- [ ] Files created in docs/:
  - [ ] `{feature}-guide-en.html`
  - [ ] `{feature}-guide-id.html` (if applicable)

**Test locally:**
```bash
open docs/index.html
# Or: python3 -m http.server 8000
```

- [ ] Index page loads correctly
- [ ] Language toggle works
- [ ] Both cards visible in correct sections
- [ ] Links work (no 404)
- [ ] Guide content displays properly

#### 6. Commit Changes
```bash
git add lib/screens/responsive/{feature}/
git add docs/
git commit -m "Add {feature} user guide"
git push
```

- [ ] Source files committed
- [ ] Compiled files committed
- [ ] Scripts committed
- [ ] Pushed to remote

#### 7. Deploy
**Azure Static Web Apps:**
- [ ] Push triggers automatic deployment
- [ ] Check GitHub Actions for success
- [ ] Visit deployed URL to verify

**Azure Storage:**
```bash
cd docs
./deploy-to-azure.sh
# Choose option 2
```
- [ ] Deployment script completed
- [ ] Visit deployed URL to verify

---

## 🔄 Updating an Existing Guide

### Quick Update Process

- [ ] Edit source file: `lib/screens/responsive/{feature}/{FEATURE}_USER_GUIDE_{LANG}.html`
- [ ] Run: `cd docs && ./copy-guides.sh`
- [ ] Test: `open docs/{feature}-guide-{lang}.html`
- [ ] Commit both files:
  ```bash
  git add lib/screens/responsive/{feature}/{FEATURE}_USER_GUIDE_{LANG}.html
  git add docs/{feature}-guide-{lang}.html
  git commit -m "Update {feature} guide - {what changed}"
  git push
  ```
- [ ] Verify deployment (automatic or run deploy script)

---

## 🚀 Deployment

### Azure Static Web Apps (Automatic)
- [ ] Commit and push changes
- [ ] Wait for GitHub Action to complete
- [ ] Visit site to verify: `https://your-app.azurestaticapps.net`

### Azure Storage (Manual)
- [ ] Ensure guides are copied: `./copy-guides.sh`
- [ ] Run deployment: `./deploy-to-azure.sh`
- [ ] Choose option 2 (deploy to existing)
- [ ] Visit site to verify: `https://your-account.z23.web.core.windows.net`

---

## 🔍 Testing Checklist

### Local Testing
- [ ] Run `./copy-guides.sh` - no errors
- [ ] Open `index.html` in browser
- [ ] Test language toggle
- [ ] Click each guide link
- [ ] Verify all guides load
- [ ] Check mobile responsiveness (resize browser)
- [ ] Test on actual mobile device (optional)

### Production Testing (After Deploy)
- [ ] Visit deployed URL
- [ ] Test all guide links
- [ ] Test language toggle
- [ ] Verify no 404 errors
- [ ] Check on mobile device
- [ ] Verify SSL certificate (https://)

---

## ⚠️ Troubleshooting Quick Fixes

### Problem: Guide not showing on index page
```bash
# 1. Check file exists
ls docs/{feature}-guide-{lang}.html

# 2. If missing, recompile
cd docs && ./copy-guides.sh

# 3. Hard refresh browser
# Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
```

### Problem: Link broken (404)
```bash
# 1. Verify filename matches
cat docs/index.html | grep "{feature}"

# 2. Check actual file
ls docs/{feature}-guide-*.html

# 3. Fix href in index.html if needed
# Edit docs/index.html, find the card, fix href attribute
```

### Problem: Deployment failed
```bash
# For Azure Storage:
# 1. Check login
az account show

# 2. Re-login if needed
az login

# 3. Try again
cd docs && ./deploy-to-azure.sh

# For Static Web Apps:
# 1. Check GitHub Actions
# Go to repo → Actions tab → Check latest run
# 2. Read error logs
# 3. Fix issue and push again
```

### Problem: Style broken
```bash
# 1. Verify source HTML has <style> tags
head -50 lib/screens/responsive/{feature}/{FEATURE}_USER_GUIDE_EN.html

# 2. Recompile
cd docs && ./copy-guides.sh

# 3. Redeploy
./deploy-to-azure.sh
```

---

## 📋 Pre-Release Checklist

Before deploying to production:

### Code Review
- [ ] All guide content is accurate
- [ ] No typos or grammar errors
- [ ] All links work
- [ ] Images (if any) load correctly
- [ ] Styling is consistent

### Files
- [ ] All source files in `lib/screens/responsive/*/`
- [ ] All compiled files in `docs/`
- [ ] Scripts updated (`copy-guides.sh`)
- [ ] Index page updated (`index.html`)
- [ ] Version number updated in footer (optional)

### Testing
- [ ] Local testing passed
- [ ] Mobile responsive
- [ ] Language toggle works
- [ ] All guides accessible

### Deployment
- [ ] Changes committed to git
- [ ] Pushed to remote
- [ ] Deployment successful
- [ ] Production site verified

---

## 📞 Need Help?

**Quick Links:**
- Detailed guide: [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)
- Deployment guide: [QUICKSTART.md](QUICKSTART.md)
- User documentation: [README.md](README.md)

**Common Issues:**
1. Script not executable: `chmod +x docs/*.sh`
2. Azure CLI needed: https://aka.ms/azure-cli
3. Git issues: Check branch and remote

---

## 📊 Current Status Tracking

### Available Guides

| Feature | English | Indonesian | Last Updated |
|---------|---------|------------|--------------|
| Settings | ✅ | ✅ | 2025-11-06 |
| Delivery List | ✅ | ✅ | 2025-11-06 |
| Roles | ✅ | ✅ | 2025-11-06 |
| __________ | ☐ | ☐ | __________ |
| __________ | ☐ | ☐ | __________ |

**Legend:**
- ✅ Complete
- ⏳ In progress / Coming soon
- ☐ Not started

---

## 🎯 Quick Commands Reference

```bash
# Navigate to docs
cd docs

# Copy all guides from source
./copy-guides.sh

# Test locally
open index.html
# Or:
python3 -m http.server 8000

# Deploy to Azure Storage
./deploy-to-azure.sh

# List compiled guides
ls -la *guide*.html

# Check git status
git status

# Commit and push
git add .
git commit -m "Your message"
git push

# Check Azure CLI login
az account show

# Login to Azure
az login
```

---

**Print this checklist and keep it handy! 📌**

Last Updated: November 6, 2025
