# User Guide Documentation Portal

This folder contains all user guide documentation that can be deployed as a static website to Azure.

## 📚 Documentation

- **[README.md](README.md)** (this file) - User-facing documentation and deployment guide
- **[QUICKSTART.md](QUICKSTART.md)** - Quick start guide for deploying to Azure
- **[IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)** - Technical implementation documentation for developers
- **[DEVELOPER_CHECKLIST.md](DEVELOPER_CHECKLIST.md)** - Quick reference checklist for common tasks

## 📁 File Structure

```
docs/
├── index.html                          # Landing page with guide links
├── settings-guide-en.html             # Settings guide (English)
├── settings-guide-id.html             # Settings guide (Indonesian)
├── delivery-list-guide-en.html        # Delivery List guide (English)
├── delivery-list-guide-id.html        # Delivery List guide (Indonesian)
├── role-guide-en.html                 # Role guide (English)
├── role-guide-id.html                 # Role guide (Indonesian)
└── README.md                          # This file
```

## 🚀 Setup Instructions

### Step 1: Copy Your Existing HTML Files

Copy your existing user guide HTML files to this folder with standardized names:

```bash
# From the flutter-front-end root directory:

# Settings guide
cp lib/screens/responsive/settings/SETTINGS_USER_GUIDE_EN.html docs/settings-guide-en.html

# Delivery List guides
cp lib/screens/responsive/delivery_list/DELIVERY_LIST_USER_GUIDE.html docs/delivery-list-guide-en.html
cp lib/screens/responsive/delivery_list/DELIVERY_LIST_USER_GUIDE_ID.html docs/delivery-list-guide-id.html

# Role guides
cp lib/screens/responsive/role/ROLE_USER_GUIDE_EN.html docs/role-guide-en.html
cp lib/screens/responsive/role/ROLE_USER_GUIDE_ID.html docs/role-guide-id.html
```

### Step 2: Test Locally

Open `index.html` in your browser to test the portal locally.

---

## 🌐 Azure Deployment Options

You have **two main options** for deploying static HTML files to Azure:

### Option 1: Azure Static Web Apps (Recommended for CI/CD)

**Pros:**
- Free tier available
- Automatic CI/CD with GitHub
- Custom domains included
- Global CDN
- HTTPS by default

**Cons:**
- Requires GitHub/Azure DevOps/Bitbucket

**Deployment Steps:**

1. **Push your code to GitHub** (if not already there)
   ```bash
   git add docs/
   git commit -m "Add user guide documentation portal"
   git push
   ```

2. **Create Static Web App via Azure Portal:**
   - Go to [Azure Portal](https://portal.azure.com)
   - Click "Create a resource"
   - Search for "Static Web Apps"
   - Click "Create"
   - Fill in:
     - **Subscription**: Your Azure subscription
     - **Resource Group**: Create new or use existing
     - **Name**: `user-guide-portal` (or your preferred name)
     - **Plan type**: Free
     - **Region**: Choose closest to your users
     - **Source**: GitHub
     - **Organization**: Your GitHub username/org
     - **Repository**: Your repo name
     - **Branch**: main (or your branch)
     - **Build Details**:
       - Build Presets: Custom
       - App location: `/docs`
       - Api location: (leave empty)
       - Output location: (leave empty)
   - Click "Review + create"
   - Click "Create"

3. **Access your site:**
   - Azure will provide a URL like: `https://your-app-name.azurestaticapps.net`
   - Any future commits to your branch will auto-deploy!

4. **Optional: Add custom domain**
   - In the Static Web App resource, go to "Custom domains"
   - Add your domain and configure DNS

---

### Option 2: Azure Storage Static Website (Simple, No CI/CD)

**Pros:**
- Very cheap (pennies per month)
- Simple setup
- No GitHub integration needed
- Fast global CDN with Azure CDN

**Cons:**
- Manual deployment (or need to set up your own CI/CD)
- Requires Azure CLI or Storage Explorer for uploads

**Deployment Steps:**

#### A. Via Azure Portal:

1. **Create Storage Account:**
   - Go to [Azure Portal](https://portal.azure.com)
   - Create a resource → "Storage account"
   - Fill in:
     - **Storage account name**: `userguidedocs` (must be globally unique, lowercase, no special chars)
     - **Region**: Choose closest to users
     - **Performance**: Standard
     - **Redundancy**: LRS (cheapest) or GRS
   - Click "Review + create" → "Create"

2. **Enable Static Website:**
   - Open your storage account
   - In left menu, under "Data management", click "Static website"
   - Click "Enabled"
   - Set **Index document name**: `index.html`
   - Set **Error document path**: `index.html` (optional)
   - Click "Save"
   - Note the **Primary endpoint** URL (e.g., `https://userguidedocs.z13.web.core.windows.net/`)

3. **Upload Files:**
   - Click on the `$web` container link
   - Click "Upload"
   - Select all HTML files from your `docs/` folder
   - Click "Upload"

4. **Access your site:**
   - Visit the primary endpoint URL
   - Your documentation portal is now live!

#### B. Via Azure CLI (Automated):

```bash
# Install Azure CLI if needed: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli

# Login to Azure
az login

# Set variables
RESOURCE_GROUP="user-guide-rg"
STORAGE_ACCOUNT="userguidedocs"  # Change to unique name
LOCATION="eastus"  # Change to your preferred region

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create storage account
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2

# Enable static website
az storage blob service-properties update \
  --account-name $STORAGE_ACCOUNT \
  --static-website \
  --index-document index.html

# Upload files
az storage blob upload-batch \
  --account-name $STORAGE_ACCOUNT \
  --source ./docs \
  --destination '$web' \
  --overwrite

# Get the website URL
az storage account show \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query "primaryEndpoints.web" \
  --output tsv
```

#### C. Update/Deploy Script:

Create a deployment script for easy updates:

**File: `deploy-docs.sh`** (in your project root)
```bash
#!/bin/bash
STORAGE_ACCOUNT="userguidedocs"  # Change to your storage account name

echo "Deploying user guides to Azure Storage..."

az storage blob upload-batch \
  --account-name $STORAGE_ACCOUNT \
  --source ./docs \
  --destination '$web' \
  --overwrite \
  --auth-mode login

echo "✅ Deployment complete!"
echo "🌐 Visit: https://${STORAGE_ACCOUNT}.z13.web.core.windows.net/"
```

Make it executable and run:
```bash
chmod +x deploy-docs.sh
./deploy-docs.sh
```

---

## 🔗 Linking from Your App

Once deployed, you can reference the documentation in your Flutter app:

### Method 1: Open in WebView
```dart
import 'package:url_launcher/url_launcher.dart';

Future<void> openUserGuide(String guideName) async {
  final url = Uri.parse('https://your-docs-url.azurestaticapps.net/${guideName}-guide-en.html');
  if (await canLaunchUrl(url)) {
    await launchUrl(url, mode: LaunchMode.inAppWebView);
  }
}
```

### Method 2: Open in External Browser
```dart
Future<void> openUserGuide(String guideName) async {
  final url = Uri.parse('https://your-docs-url.azurestaticapps.net/${guideName}-guide-en.html');
  if (await canLaunchUrl(url)) {
    await launchUrl(url, mode: LaunchMode.externalApplication);
  }
}
```

---

## 💰 Cost Estimates

### Azure Static Web Apps
- **Free tier**: Unlimited bandwidth, 100 GB storage
- Perfect for documentation sites

### Azure Storage Static Website
- **Storage**: ~$0.018 per GB/month
- **Bandwidth**: First 100 GB/month free, then ~$0.08 per GB
- **Estimated monthly cost**: < $1 for typical documentation site

---

## 🔄 Continuous Deployment

### For Azure Static Web Apps:
Automatically deploys when you push to GitHub - **no extra setup needed!**

### For Azure Storage:
Add to your CI/CD pipeline (GitHub Actions example):

**.github/workflows/deploy-docs.yml:**
```yaml
name: Deploy Documentation

on:
  push:
    branches: [main]
    paths:
      - 'docs/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Upload to Azure Storage
        uses: azure/CLI@v1
        with:
          inlineScript: |
            az storage blob upload-batch \
              --account-name userguidedocs \
              --source ./docs \
              --destination '$web' \
              --overwrite
```

---

## 📝 Maintenance

### Adding New Guides:
1. Create the HTML file in `lib/screens/responsive/[feature]/`
2. Copy it to `docs/` with standardized naming
3. Update `index.html` to add a new card for the guide
4. Deploy (automatically with Static Web Apps, or run deploy script for Storage)

### Updating Existing Guides:
1. Update the HTML file
2. Copy to `docs/` folder
3. Deploy (automatic or run deploy script)

---

## 🛠️ Recommendations

**For your use case** (Node.js backend already on Azure):
- ✅ **Recommended: Azure Static Web Apps** (Option 1)
  - Easiest setup
  - Free
  - Automatic deployments
  - Same Azure subscription as your backend

**Alternative if you prefer simplicity:**
- ✅ **Azure Storage Static Website** (Option 2)
  - Slightly cheaper (but both are very cheap)
  - More control
  - Good if you already use Azure Storage

---

## 🔗 Useful Links

- [Azure Static Web Apps Documentation](https://docs.microsoft.com/en-us/azure/static-web-apps/)
- [Azure Storage Static Website Documentation](https://docs.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website)
- [Azure CLI Documentation](https://docs.microsoft.com/en-us/cli/azure/)

---

## ❓ Questions?

If you need help:
1. Check Azure documentation links above
2. Review this README
3. Check Azure Portal for deployment status
4. Review deployment logs in GitHub Actions (if using Static Web Apps)
