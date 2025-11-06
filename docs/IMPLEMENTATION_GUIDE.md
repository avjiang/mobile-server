# User Guide Portal - Implementation Documentation

## 📋 Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [Implementation Steps](#implementation-steps)
5. [Adding New Guides](#adding-new-guides)
6. [Updating Existing Guides](#updating-existing-guides)
7. [Deployment Process](#deployment-process)
8. [Maintenance](#maintenance)
9. [Troubleshooting](#troubleshooting)

---

## Overview

### Purpose
This implementation consolidates all user guide HTML files (`XXX_USER_GUIDE_EN.html` and `XXX_USER_GUIDE_ID.html`) from various feature folders into a centralized documentation portal that can be deployed as a static website to Azure.

### Key Features
- Single landing page with language switcher
- Centralized location for all user guides
- Automated copying and deployment scripts
- Support for both English (EN) and Indonesian (ID) languages
- Deployable to Azure Static Web Apps or Azure Storage

---

## Architecture

### Design Pattern
**Source → Compilation → Deployment**

```
Feature Folders (Source)
    ↓ (copy-guides.sh)
Docs Folder (Compilation)
    ↓ (deploy-to-azure.sh or Git Push)
Azure (Deployment)
```

### File Flow Diagram
```
lib/screens/responsive/
├── settings/
│   ├── SETTINGS_USER_GUIDE_EN.html  ──┐
│   └── SETTINGS_USER_GUIDE_ID.html  ──┤
├── delivery_list/                     │
│   ├── DELIVERY_LIST_USER_GUIDE.html ─┤
│   └── DELIVERY_LIST_USER_GUIDE_ID.html ┤
└── role/                              │
    ├── ROLE_USER_GUIDE_EN.html  ──────┤
    └── ROLE_USER_GUIDE_ID.html  ──────┤
                                       │
                        (copy-guides.sh)
                                       ↓
                            docs/
                        ├── index.html
                        ├── settings-guide-en.html
                        ├── settings-guide-id.html
                        ├── delivery-list-guide-en.html
                        ├── delivery-list-guide-id.html
                        ├── role-guide-en.html
                        └── role-guide-id.html
                                       ↓
                            (Deploy to Azure)
                                       ↓
                    https://your-site.azure.com
```

---

## File Structure

### Documentation Portal Structure
```
docs/
├── index.html                      # Landing page with navigation
├── {feature}-guide-{lang}.html    # Individual guide files
├── copy-guides.sh                 # Script to copy guides from source
├── deploy-to-azure.sh             # Script to deploy to Azure Storage
├── README.md                      # User-facing documentation
├── QUICKSTART.md                  # Quick start guide for deployment
├── IMPLEMENTATION_GUIDE.md        # This file (technical documentation)
└── .gitignore                     # Git ignore rules
```

### Naming Convention
**Source Files (in feature folders):**
- Pattern: `{FEATURE}_USER_GUIDE_EN.html` or `{FEATURE}_USER_GUIDE_ID.html`
- Examples:
  - `SETTINGS_USER_GUIDE_EN.html`
  - `DELIVERY_LIST_USER_GUIDE_ID.html`
  - `ROLE_USER_GUIDE_EN.html`

**Compiled Files (in docs folder):**
- Pattern: `{feature}-guide-{lang}.html`
- Examples:
  - `settings-guide-en.html`
  - `delivery-list-guide-id.html`
  - `role-guide-en.html`

**Naming Rules:**
- Feature name: lowercase, hyphen-separated
- Language code: lowercase (en or id)
- Always use hyphen (-) not underscore (_)

---

## Implementation Steps

### Initial Setup (Already Completed)

#### Step 1: Create docs/ Directory
```bash
mkdir -p docs
```

#### Step 2: Create Landing Page
Created `docs/index.html` with:
- Language switcher (English/Indonesian)
- Grid layout for guide cards
- Responsive design
- Links to individual guides

**Key Features:**
- JavaScript-based language toggle
- Card-based navigation
- Consistent styling with guide pages
- Handles missing guides gracefully (shows "Coming Soon")

#### Step 3: Create Copy Script
Created `docs/copy-guides.sh` to automate file copying.

**Script Logic:**
```bash
# For each guide:
1. Check if source file exists
2. Copy to docs/ with standardized name
3. Report success or warning
```

#### Step 4: Create Deployment Script
Created `docs/deploy-to-azure.sh` for Azure Storage deployment.

**Script Features:**
- Interactive prompts
- Creates Azure resources if needed
- Uploads all HTML files
- Returns deployment URL

#### Step 5: Create Documentation
Created three documentation files:
- `README.md` - Comprehensive user guide
- `QUICKSTART.md` - Quick deployment guide
- `IMPLEMENTATION_GUIDE.md` - This technical guide

#### Step 6: Make Scripts Executable
```bash
chmod +x docs/copy-guides.sh docs/deploy-to-azure.sh
```

#### Step 7: Initial Compilation
```bash
cd docs
./copy-guides.sh
```

---

## Adding New Guides

### Complete Process for Adding a New Feature Guide

#### Step 1: Create Source HTML Files
In your feature folder (e.g., `lib/screens/responsive/inventory/`):

```bash
# Create English version
lib/screens/responsive/inventory/INVENTORY_USER_GUIDE_EN.html

# Create Indonesian version
lib/screens/responsive/inventory/INVENTORY_USER_GUIDE_ID.html
```

**Requirements:**
- Use consistent HTML structure
- Include proper metadata (title, charset, viewport)
- Match existing styling or use similar gradient theme
- Ensure mobile responsiveness

#### Step 2: Update copy-guides.sh
Add copying logic for new guide:

**File:** `docs/copy-guides.sh`

```bash
# Inventory guides (ADD THIS SECTION)
if [ -f "lib/screens/responsive/inventory/INVENTORY_USER_GUIDE_EN.html" ]; then
    cp lib/screens/responsive/inventory/INVENTORY_USER_GUIDE_EN.html docs/inventory-guide-en.html
    echo "✅ Copied inventory-guide-en.html"
else
    echo "⚠️  Inventory English guide not found"
fi

if [ -f "lib/screens/responsive/inventory/INVENTORY_USER_GUIDE_ID.html" ]; then
    cp lib/screens/responsive/inventory/INVENTORY_USER_GUIDE_ID.html docs/inventory-guide-id.html
    echo "✅ Copied inventory-guide-id.html"
else
    echo "⚠️  Inventory Indonesian guide not found"
fi
```

#### Step 3: Update index.html
Add navigation cards for the new guide:

**File:** `docs/index.html`

**In English section:**
```html
<!-- Inside <div id="guides-en" class="guides-grid"> -->
<a href="inventory-guide-en.html" class="guide-card">
    <div class="icon">📦</div>
    <h2>Inventory Management</h2>
    <p>Learn how to manage stock, track inventory levels, and handle stock adjustments.</p>
    <span class="badge">English</span>
</a>
```

**In Indonesian section:**
```html
<!-- Inside <div id="guides-id" class="guides-grid hidden"> -->
<a href="inventory-guide-id.html" class="guide-card">
    <div class="icon">📦</div>
    <h2>Manajemen Inventaris</h2>
    <p>Pelajari cara mengelola stok, melacak tingkat inventaris, dan menangani penyesuaian stok.</p>
    <span class="badge">Bahasa Indonesia</span>
</a>
```

**If only one language is available:**
```html
<!-- For missing guide, use disabled card -->
<div class="guide-card" style="opacity: 0.6; cursor: not-allowed;">
    <div class="icon">📦</div>
    <h2>Manajemen Inventaris</h2>
    <p>Pelajari cara mengelola stok, melacak tingkat inventaris, dan menangani penyesuaian stok.</p>
    <span class="badge" style="background: #999;">Coming Soon</span>
</div>
```

#### Step 4: Test Locally
```bash
# Copy files
cd docs
./copy-guides.sh

# Verify files exist
ls -la *guide*.html

# Test in browser
open index.html
# Or
python3 -m http.server 8000
# Then visit http://localhost:8000
```

#### Step 5: Commit Changes
```bash
git add docs/
git add lib/screens/responsive/inventory/
git commit -m "Add inventory management user guide"
git push
```

#### Step 6: Deploy
**If using Azure Static Web Apps:**
- Deployment happens automatically on push

**If using Azure Storage:**
```bash
cd docs
./deploy-to-azure.sh
# Choose option 2 (deploy to existing)
```

---

## Updating Existing Guides

### Process for Updating User Guide Content

#### Step 1: Edit Source File
Edit the HTML file in the feature folder:
```bash
# Example: Update settings guide
vim lib/screens/responsive/settings/SETTINGS_USER_GUIDE_EN.html
```

#### Step 2: Recompile
```bash
cd docs
./copy-guides.sh
```

This overwrites the compiled version in `docs/` with the updated source.

#### Step 3: Test Changes
```bash
# View locally
open docs/settings-guide-en.html
```

#### Step 4: Commit and Deploy
```bash
git add lib/screens/responsive/settings/SETTINGS_USER_GUIDE_EN.html
git add docs/settings-guide-en.html
git commit -m "Update settings user guide - add new section on XYZ"
git push
```

**Important:** Always commit both:
1. Source file (in `lib/screens/responsive/*/`)
2. Compiled file (in `docs/`)

This ensures version consistency.

---

## Deployment Process

### Option 1: Azure Static Web Apps (Recommended)

#### Initial Setup
1. Push code to GitHub
2. Create Static Web App in Azure Portal
3. Configure:
   - Source: GitHub
   - Repository: Your repo
   - Branch: main
   - App location: `/docs`
   - Build preset: Custom (no build needed)

#### Subsequent Deployments
```bash
# Just push to GitHub
git add docs/
git commit -m "Update documentation"
git push
```

**Automatic Actions:**
- GitHub Action triggers automatically
- Files deployed to Azure
- Live in ~1-2 minutes
- No manual intervention needed

#### Monitoring
- View deployment status: GitHub Actions tab
- View logs: Azure Portal → Static Web App → Environment
- Access URL: Shown in Azure Portal overview

---

### Option 2: Azure Storage Static Website

#### Initial Setup
```bash
cd docs

# Edit deploy-to-azure.sh first
# Set STORAGE_ACCOUNT to unique name
# Set RESOURCE_GROUP name
# Set LOCATION (e.g., southeastasia)

# Run deployment
./deploy-to-azure.sh
# Choose option 1 (create new)
```

This creates:
- Resource group
- Storage account
- Enables static website hosting
- Uploads all HTML files

#### Subsequent Deployments
```bash
cd docs
./copy-guides.sh      # Copy latest guides
./deploy-to-azure.sh  # Upload to Azure
# Choose option 2 (deploy to existing)
```

#### Manual Azure CLI Deployment
```bash
# If you prefer manual control
az storage blob upload-batch \
  --account-name YOUR_STORAGE_ACCOUNT \
  --source ./docs \
  --destination '$web' \
  --overwrite \
  --pattern "*.html" \
  --auth-mode login
```

---

## Maintenance

### Regular Tasks

#### 1. Update Guides
**Frequency:** As needed when features change

**Process:**
```bash
# 1. Update source HTML
vim lib/screens/responsive/{feature}/{FEATURE}_USER_GUIDE_EN.html

# 2. Recompile
cd docs && ./copy-guides.sh

# 3. Test locally
open docs/{feature}-guide-en.html

# 4. Deploy
git add . && git commit -m "Update {feature} guide" && git push
```

#### 2. Add New Guides
**Frequency:** When new features are added

**Process:** Follow [Adding New Guides](#adding-new-guides) section

#### 3. Update Scripts
**Frequency:** Rarely (only when structure changes)

**When to update copy-guides.sh:**
- New feature added
- Feature renamed
- File structure changed

**When to update deploy-to-azure.sh:**
- Azure configuration changes
- Deployment process changes

#### 4. Update index.html
**Frequency:** When guides are added/removed

**What to update:**
- Guide cards
- Navigation links
- Language sections
- Footer version/date

---

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: Guide Not Showing on Portal
**Symptoms:** New guide exists but not visible on index page

**Solutions:**
1. **Check if compiled:**
   ```bash
   ls docs/{feature}-guide-{lang}.html
   ```
   If missing, run `./copy-guides.sh`

2. **Check index.html:**
   - Verify card exists in index.html
   - Check href matches filename exactly
   - Check if hidden by language toggle

3. **Check browser cache:**
   - Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
   - Or open in incognito mode

#### Issue 2: copy-guides.sh Not Finding Source Files
**Symptoms:** Script shows "⚠️ {feature} guide not found"

**Solutions:**
1. **Verify source file exists:**
   ```bash
   ls lib/screens/responsive/{feature}/{FEATURE}_USER_GUIDE_EN.html
   ```

2. **Check file path in script:**
   - Open `copy-guides.sh`
   - Verify path matches actual location
   - Check for typos in filename

3. **Check file naming:**
   - Must match pattern: `{FEATURE}_USER_GUIDE_EN.html`
   - Feature name in UPPERCASE
   - Underscore not hyphen

#### Issue 3: Deployment Fails
**For Azure Static Web Apps:**
```bash
# Check GitHub Actions
# Go to: GitHub repo → Actions tab
# View latest workflow run
# Check logs for errors
```

**For Azure Storage:**
```bash
# Check Azure CLI login
az account show

# Re-login if needed
az login

# Verify storage account exists
az storage account show --name YOUR_ACCOUNT --resource-group YOUR_RG

# Check permissions
az role assignment list --assignee YOUR_EMAIL --resource-group YOUR_RG
```

#### Issue 4: Links Broken After Deployment
**Symptoms:** Links work locally but 404 on Azure

**Solutions:**
1. **Check filename case:**
   - Azure Storage is case-sensitive
   - Ensure filenames match exactly
   - Use lowercase consistently

2. **Verify files uploaded:**
   ```bash
   az storage blob list \
     --account-name YOUR_ACCOUNT \
     --container-name '$web' \
     --output table
   ```

3. **Check index.html links:**
   - Verify href attributes
   - No leading slashes for relative paths
   - Example: `href="settings-guide-en.html"` ✅
   - Not: `href="/settings-guide-en.html"` ❌

#### Issue 5: Style Broken After Deployment
**Symptoms:** Pages look unstyled on Azure

**Solutions:**
1. **Check CSS in HTML:**
   - Verify `<style>` tags are present
   - Check inline styles not removed

2. **Check Content-Type:**
   ```bash
   # HTML should be served as text/html
   curl -I https://your-site.azure.com/index.html
   # Look for: Content-Type: text/html
   ```

3. **Re-upload files:**
   ```bash
   cd docs
   ./deploy-to-azure.sh
   ```

---

## Script Reference

### copy-guides.sh

**Purpose:** Copy user guide HTML files from feature folders to docs folder with standardized naming

**Location:** `docs/copy-guides.sh`

**Usage:**
```bash
cd docs
./copy-guides.sh
```

**Logic Flow:**
```
For each feature guide:
  1. Check if source file exists at lib/screens/responsive/{feature}/{FILE}.html
  2. If exists: Copy to docs/{feature}-guide-{lang}.html
  3. Print success message
  4. If not exists: Print warning (not error)
End for
```

**Exit Codes:**
- Always exits with 0 (success)
- Warnings don't stop execution
- Allows partial updates

**Adding New Feature:**
```bash
# Template to add to copy-guides.sh:
if [ -f "lib/screens/responsive/{FEATURE}/{FEATURE}_USER_GUIDE_EN.html" ]; then
    cp lib/screens/responsive/{FEATURE}/{FEATURE}_USER_GUIDE_EN.html docs/{feature}-guide-en.html
    echo "✅ Copied {feature}-guide-en.html"
else
    echo "⚠️  {Feature} English guide not found"
fi
```

---

### deploy-to-azure.sh

**Purpose:** Deploy documentation to Azure Storage Static Website

**Location:** `docs/deploy-to-azure.sh`

**Prerequisites:**
- Azure CLI installed
- Logged in to Azure (`az login`)
- Proper permissions on subscription

**Configuration Variables:**
```bash
STORAGE_ACCOUNT="userguidedocs"    # Must be globally unique
RESOURCE_GROUP="user-guide-rg"     # Resource group name
LOCATION="southeastasia"           # Azure region
```

**Usage:**
```bash
cd docs
./deploy-to-azure.sh
```

**Interactive Prompts:**
- Option 1: Create new resources + deploy
- Option 2: Deploy to existing resources

**Logic Flow:**
```
1. Check Azure CLI installed
2. Check Azure login status
3. Prompt user for action
4. If creating new:
   a. Create resource group
   b. Create storage account
   c. Enable static website
5. Run copy-guides.sh (if exists)
6. Upload HTML files to $web container
7. Display website URL
```

**Exit Codes:**
- 0: Success
- 1: Error (CLI not found, login failed, creation failed, upload failed)

---

## Best Practices

### 1. Source Control
**Always commit both source and compiled files:**
```bash
git add lib/screens/responsive/{feature}/
git add docs/
git commit -m "Update {feature} user guide"
```

**Why:** Keeps documentation in sync across environments

### 2. Naming Consistency
**Follow strict naming conventions:**
- Source: `{FEATURE}_USER_GUIDE_{LANG}.html`
- Compiled: `{feature}-guide-{lang}.html`
- Feature: lowercase-with-hyphens

**Why:** Scripts depend on predictable naming

### 3. Testing
**Always test locally before deploying:**
```bash
cd docs
python3 -m http.server 8000
# Visit http://localhost:8000
```

**Why:** Catches broken links, styling issues, missing files

### 4. Documentation
**Update this guide when:**
- Adding new scripts
- Changing deployment process
- Modifying file structure
- Adding new features

**Why:** Keeps implementation documentation current

### 5. Incremental Updates
**Update guides incrementally:**
- Don't accumulate changes
- Deploy small updates frequently
- Test each change

**Why:** Easier to track issues and rollback if needed

---

## Quick Reference

### File Locations
```
Source:     lib/screens/responsive/{feature}/{FEATURE}_USER_GUIDE_{LANG}.html
Compiled:   docs/{feature}-guide-{lang}.html
Index:      docs/index.html
Scripts:    docs/copy-guides.sh, docs/deploy-to-azure.sh
Docs:       docs/README.md, docs/QUICKSTART.md, docs/IMPLEMENTATION_GUIDE.md
```

### Common Commands
```bash
# Copy guides
cd docs && ./copy-guides.sh

# Test locally
open docs/index.html

# Deploy to Azure Storage
cd docs && ./deploy-to-azure.sh

# Deploy to Azure Static Web Apps
git push  # (automatic)

# List compiled guides
ls docs/*guide*.html

# Check Azure deployment
az storage blob list --account-name NAME --container-name '$web' --output table
```

### Checklist: Adding New Guide
- [ ] Create `{FEATURE}_USER_GUIDE_EN.html` in feature folder
- [ ] Create `{FEATURE}_USER_GUIDE_ID.html` in feature folder (or mark as coming soon)
- [ ] Update `copy-guides.sh` with new feature
- [ ] Update `index.html` with new cards (EN and ID sections)
- [ ] Run `./copy-guides.sh` to compile
- [ ] Test locally with `open index.html`
- [ ] Commit all changes (source + compiled)
- [ ] Push to deploy

### Checklist: Updating Existing Guide
- [ ] Edit source HTML in `lib/screens/responsive/{feature}/`
- [ ] Run `./copy-guides.sh` to recompile
- [ ] Test locally
- [ ] Commit source + compiled files
- [ ] Push to deploy

---

## Contact & Support

### When to Update This Guide
- New deployment method added
- Script logic changes
- File structure changes
- New best practices identified

### Questions?
Refer to:
- [README.md](README.md) - User documentation
- [QUICKSTART.md](QUICKSTART.md) - Quick deployment guide
- Azure documentation (links in README.md)

---

**Last Updated:** November 6, 2025
**Version:** 1.0
**Maintained by:** Development Team
