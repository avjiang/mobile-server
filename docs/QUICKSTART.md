# Quick Start Guide - Deploy User Guides to Azure

## 🎯 Choose Your Path

### Path A: Azure Static Web Apps (Recommended)

**Best for:** Automatic deployments from GitHub, free tier, zero maintenance

### Path B: Azure Storage Static Website

**Best for:** Simple manual deployments, full control

---

## 🚀 Path A: Azure Static Web Apps (5 minutes)

### Step 1: Copy your guide files

```bash
cd docs
./copy-guides.sh
```

### Step 2: Push to GitHub

```bash
git add .
git commit -m "Add user documentation portal"
git push
```

### Step 3: Create Static Web App

1. Go to [Azure Portal](https://portal.azure.com)
2. Click **"Create a resource"** → Search **"Static Web Apps"**
3. Fill in:
   - **Name:** `user-guide-portal`
   - **Plan:** Free
   - **Region:** Southeast Asia (or your preferred region)
   - **Source:** GitHub
   - **Repository:** Your repo
   - **Branch:** main
   - **App location:** `/docs`
4. Click **"Review + create"** → **"Create"**

### Step 4: Done!

- Azure will give you a URL like: `https://user-guide-portal-xxx.azurestaticapps.net`
- Every push to GitHub auto-deploys!
- Free SSL, global CDN included

---

## 🚀 Path B: Azure Storage Static Website (10 minutes)

### Prerequisites:

- Install Azure CLI: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli

### Step 1: Edit configuration

Open `deploy-to-azure.sh` and change these values:

```bash
STORAGE_ACCOUNT="youruniquename"  # Must be globally unique!
RESOURCE_GROUP="user-guide-rg"
LOCATION="southeastasia"          # Singapore region
```

### Step 2: Run deployment script

```bash
cd docs
./deploy-to-azure.sh
```

Follow the prompts:

- Choose option 1 for first-time setup
- Choose option 2 for subsequent deployments

### Step 3: Done!

- Script will output your website URL
- Example: `https://youruniquename.z23.web.core.windows.net/`

---

## 🔄 Future Updates

### For Static Web Apps:

```bash
# Just commit and push - automatic deployment!
git add docs/
git commit -m "Update guides"
git push
```

### For Azure Storage:

```bash
cd docs
./copy-guides.sh      # Copy latest guides
./deploy-to-azure.sh  # Choose option 2 (deploy to existing)
```

---

## 🔗 Connect to Your Flutter App

Once deployed, add links in your Flutter app:

```dart
import 'package:url_launcher/url_launcher.dart';

// Your documentation URL
const String DOCS_BASE_URL = 'https://your-url-here.azurestaticapps.net';

Future<void> openGuide(String guideName, String lang) async {
  final url = Uri.parse('$DOCS_BASE_URL/${guideName}-guide-${lang}.html');
  if (await canLaunchUrl(url)) {
    await launchUrl(url, mode: LaunchMode.inAppWebView);
  }
}

// Usage:
// openGuide('settings', 'en')  -> Opens settings guide in English
// openGuide('delivery-list', 'id') -> Opens delivery list guide in Indonesian
```

Add to `pubspec.yaml`:

```yaml
dependencies:
  url_launcher: ^6.2.0
```

---

## 💰 Costs

| Option          | Monthly Cost | Notes                          |
| --------------- | ------------ | ------------------------------ |
| Static Web Apps | **FREE**     | 100GB bandwidth included       |
| Azure Storage   | **< $1**     | ~$0.018/GB storage + bandwidth |

---

## ❓ Troubleshooting

### "Storage account name already exists"

→ Change `STORAGE_ACCOUNT` in `deploy-to-azure.sh` to something unique

### "Azure CLI not found"

→ Install from: https://aka.ms/azure-cli

### "Not logged in to Azure"

→ Run: `az login`

### "Files not found"

→ Run `./copy-guides.sh` first

### Guide links not working on deployed site

→ Make sure file names match in `index.html`:

- `settings-guide-en.html`
- `delivery-list-guide-en.html`
- `role-guide-en.html`
- etc.

---

## 📞 Need Help?

1. Read the full [README.md](README.md)
2. Check [Azure Static Web Apps docs](https://docs.microsoft.com/azure/static-web-apps/)
3. Check [Azure Storage docs](https://docs.microsoft.com/azure/storage/blobs/storage-blob-static-website)

---

**Happy deploying! 🚀**
