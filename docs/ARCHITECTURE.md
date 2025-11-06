# User Guide Portal - Architecture Documentation

## System Overview

The User Guide Portal is a static documentation website that consolidates all feature user guides from various locations in the Flutter app into a centralized, deployable website.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Flutter Application                         │
│                  lib/screens/responsive/                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
            ┌───────▼────┐ ┌───▼─────┐ ┌──▼──────┐
            │  settings/ │ │delivery_│ │  role/  │
            │            │ │  list/  │ │         │
            └───────┬────┘ └───┬─────┘ └──┬──────┘
                    │          │           │
        ┌───────────▼──────────▼───────────▼──────────┐
        │    *_USER_GUIDE_EN.html (Source Files)      │
        │    *_USER_GUIDE_ID.html (Source Files)      │
        └───────────┬──────────────────────────────────┘
                    │
                    │ (copy-guides.sh)
                    ▼
        ┌────────────────────────────────────────────┐
        │         docs/ (Compilation Folder)         │
        │  ┌──────────────────────────────────────┐  │
        │  │  index.html (Landing Page)           │  │
        │  ├──────────────────────────────────────┤  │
        │  │  {feature}-guide-en.html             │  │
        │  │  {feature}-guide-id.html             │  │
        │  └──────────────────────────────────────┘  │
        └────────────┬───────────────────────────────┘
                     │
        ┌────────────┴─────────────┐
        │                          │
        │ (Git Push)               │ (deploy-to-azure.sh)
        │                          │
        ▼                          ▼
┌──────────────────┐     ┌─────────────────────┐
│  Azure Static    │     │  Azure Storage      │
│  Web Apps        │     │  Static Website     │
│                  │     │                     │
│  (Automatic)     │     │  (Manual)           │
└────────┬─────────┘     └──────────┬──────────┘
         │                          │
         └────────────┬─────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │   Published Website    │
         │  https://your-site/    │
         └────────────────────────┘
                      │
                      │ (Accessed by users)
                      ▼
         ┌────────────────────────┐
         │   End Users            │
         │   (Web Browser)        │
         └────────────────────────┘
```

---

## Data Flow

### 1. Source Creation Flow
```
Developer creates guide
        │
        ▼
lib/screens/responsive/{feature}/{FEATURE}_USER_GUIDE_{LANG}.html
        │
        ▼
Committed to Git
```

### 2. Compilation Flow
```
Developer runs: ./copy-guides.sh
        │
        ▼
Script reads from: lib/screens/responsive/*/
        │
        ▼
Script copies to: docs/{feature}-guide-{lang}.html
        │
        ▼
Standardized filename format applied
```

### 3. Deployment Flow (Option A - Static Web Apps)
```
Developer: git push
        │
        ▼
GitHub receives push
        │
        ▼
GitHub Actions triggered
        │
        ▼
Build & deploy to Azure Static Web Apps
        │
        ▼
Website live at: https://*.azurestaticapps.net
```

### 4. Deployment Flow (Option B - Azure Storage)
```
Developer runs: ./deploy-to-azure.sh
        │
        ▼
Script authenticates with Azure CLI
        │
        ▼
Script uploads: docs/*.html → Azure Storage $web container
        │
        ▼
Website live at: https://*.z23.web.core.windows.net
```

### 5. User Access Flow
```
User visits website URL
        │
        ▼
index.html loads (Landing page)
        │
        ▼
User selects language (EN/ID)
        │
        ▼
User clicks guide card
        │
        ▼
{feature}-guide-{lang}.html loads
        │
        ▼
User reads documentation
```

---

## Component Architecture

### Frontend Components

```
┌─────────────────────────────────────────────────┐
│              index.html                         │
│  ┌───────────────────────────────────────────┐  │
│  │  Header (Title, Description)              │  │
│  ├───────────────────────────────────────────┤  │
│  │  Language Toggle (EN/ID)                  │  │
│  │  - JavaScript-based switcher              │  │
│  ├───────────────────────────────────────────┤  │
│  │  English Guides Grid                      │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │  │Guide Card│ │Guide Card│ │Guide Card│  │  │
│  │  │  (Link)  │ │  (Link)  │ │  (Link)  │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘  │  │
│  ├───────────────────────────────────────────┤  │
│  │  Indonesian Guides Grid (Hidden)          │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │  │Guide Card│ │Guide Card│ │Coming Soon│ │  │
│  │  │  (Link)  │ │  (Link)  │ │ (Disabled)│  │  │
│  │  └──────────┘ └──────────┘ └──────────┘  │  │
│  ├───────────────────────────────────────────┤  │
│  │  Footer (Version, Contact)                │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Individual Guide Structure

```
┌─────────────────────────────────────────────────┐
│         {feature}-guide-{lang}.html             │
│  ┌───────────────────────────────────────────┐  │
│  │  Header (Feature name, icon)              │  │
│  ├───────────────────────────────────────────┤  │
│  │  Table of Contents (Internal links)       │  │
│  ├───────────────────────────────────────────┤  │
│  │  Section 1: What is {Feature}?           │  │
│  ├───────────────────────────────────────────┤  │
│  │  Section 2: How to access                │  │
│  ├───────────────────────────────────────────┤  │
│  │  Section 3: Feature details               │  │
│  ├───────────────────────────────────────────┤  │
│  │  Section 4: Step-by-step guides          │  │
│  ├───────────────────────────────────────────┤  │
│  │  Section 5: Tips & Best Practices        │  │
│  ├───────────────────────────────────────────┤  │
│  │  Section 6: Troubleshooting               │  │
│  ├───────────────────────────────────────────┤  │
│  │  Section 7: FAQ                           │  │
│  ├───────────────────────────────────────────┤  │
│  │  Footer (Version, Last updated)          │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## Naming Convention

### Source Files (in feature folders)
```
Pattern: {FEATURE}_USER_GUIDE_{LANG}.html

Where:
  - {FEATURE} = Feature name in UPPERCASE with underscores
  - {LANG}    = Language code (EN or ID)

Examples:
  ✅ SETTINGS_USER_GUIDE_EN.html
  ✅ DELIVERY_LIST_USER_GUIDE_ID.html
  ✅ ROLE_USER_GUIDE_EN.html

  ❌ settings-user-guide-en.html  (wrong: lowercase)
  ❌ SETTINGS_GUIDE_EN.html       (wrong: missing USER_GUIDE)
  ❌ SETTINGS_USER_GUIDE_en.html  (wrong: mixed case)
```

### Compiled Files (in docs/)
```
Pattern: {feature}-guide-{lang}.html

Where:
  - {feature} = Feature name in lowercase with hyphens
  - {lang}    = Language code (en or id, lowercase)

Examples:
  ✅ settings-guide-en.html
  ✅ delivery-list-guide-id.html
  ✅ role-guide-en.html

  ❌ settings_guide_en.html       (wrong: underscores)
  ❌ SETTINGS-GUIDE-EN.html       (wrong: uppercase)
  ❌ settingsGuideEn.html         (wrong: camelCase)
```

### URL Pattern (after deployment)
```
Pattern: https://your-site.azure.com/{feature}-guide-{lang}.html

Examples:
  https://your-site.azure.com/settings-guide-en.html
  https://your-site.azure.com/delivery-list-guide-id.html
  https://your-site.azure.com/role-guide-en.html
```

---

## Deployment Options Comparison

### Azure Static Web Apps

```
┌────────────────────────────────────────────────┐
│         Azure Static Web Apps                  │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  GitHub Repository                       │ │
│  │  ↓                                       │ │
│  │  GitHub Actions (Auto-triggered)        │ │
│  │  ↓                                       │ │
│  │  Build & Deploy Pipeline                │ │
│  │  ↓                                       │ │
│  │  Azure Static Web Apps Service          │ │
│  │  ↓                                       │ │
│  │  Global CDN                              │ │
│  │  ↓                                       │ │
│  │  HTTPS Endpoint                          │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Features:                                     │
│  ✅ Free tier (100GB bandwidth)               │
│  ✅ Automatic CI/CD                           │
│  ✅ Custom domains included                   │
│  ✅ SSL certificates automatic                │
│  ✅ Global CDN included                       │
│  ✅ Zero maintenance                          │
│                                                │
│  Best for:                                     │
│  - Teams using GitHub                         │
│  - Need automatic deployments                 │
│  - Want zero maintenance                      │
└────────────────────────────────────────────────┘
```

### Azure Storage Static Website

```
┌────────────────────────────────────────────────┐
│         Azure Storage Static Website           │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  Local Machine                           │ │
│  │  ↓                                       │ │
│  │  Azure CLI (deploy-to-azure.sh)         │ │
│  │  ↓                                       │ │
│  │  Azure Storage Account                   │ │
│  │  ↓                                       │ │
│  │  $web Container (Static Website)         │ │
│  │  ↓                                       │ │
│  │  HTTPS Endpoint                          │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Features:                                     │
│  ✅ Very low cost (<$1/month)                 │
│  ✅ Simple architecture                       │
│  ✅ Full control                              │
│  ⚠️  Manual deployment                        │
│  ⚠️  Optional CDN (extra setup)               │
│  ⚠️  Custom domain (extra setup)              │
│                                                │
│  Best for:                                     │
│  - Simple deployments                         │
│  - Manual control preferred                   │
│  - Cost optimization                          │
└────────────────────────────────────────────────┘
```

---

## Script Architecture

### copy-guides.sh

```
┌─────────────────────────────────────────────────┐
│              copy-guides.sh                     │
│                                                 │
│  Input: lib/screens/responsive/*/               │
│  Output: docs/*.html                            │
│                                                 │
│  Process:                                       │
│  ┌───────────────────────────────────────────┐ │
│  │  1. Check if source file exists           │ │
│  │     ↓                                      │ │
│  │  2. If yes: Copy to docs/ with new name   │ │
│  │     ↓                                      │ │
│  │  3. Print success message                 │ │
│  │     ↓                                      │ │
│  │  4. If no: Print warning (continue)       │ │
│  │     ↓                                      │ │
│  │  5. Repeat for all guides                 │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  Exit: Always 0 (success)                       │
│  - Warnings don't stop execution               │
│  - Allows partial updates                      │
└─────────────────────────────────────────────────┘
```

### deploy-to-azure.sh

```
┌─────────────────────────────────────────────────┐
│            deploy-to-azure.sh                   │
│                                                 │
│  Input: docs/*.html                             │
│  Output: Azure Storage $web container           │
│                                                 │
│  Process:                                       │
│  ┌───────────────────────────────────────────┐ │
│  │  1. Check Azure CLI installed             │ │
│  │     ↓                                      │ │
│  │  2. Check Azure login status              │ │
│  │     ↓                                      │ │
│  │  3. Prompt: Create new or use existing?   │ │
│  │     ↓                                      │ │
│  │  4a. If create new:                       │ │
│  │      - Create resource group              │ │
│  │      - Create storage account             │ │
│  │      - Enable static website              │ │
│  │     ↓                                      │ │
│  │  4b. If use existing: Skip to step 5      │ │
│  │     ↓                                      │ │
│  │  5. Run copy-guides.sh (if exists)        │ │
│  │     ↓                                      │ │
│  │  6. Upload all *.html to $web             │ │
│  │     ↓                                      │ │
│  │  7. Display website URL                   │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  Exit: 0 (success) or 1 (error)                 │
└─────────────────────────────────────────────────┘
```

---

## Integration with Flutter App

### Current State
```
┌─────────────────────────────────────────────────┐
│         Flutter App                             │
│                                                 │
│  User guides embedded in:                       │
│  lib/screens/responsive/{feature}/              │
│                                                 │
│  (No connection to portal yet)                  │
└─────────────────────────────────────────────────┘
```

### Future Integration (Recommended)
```
┌─────────────────────────────────────────────────┐
│         Flutter App                             │
│  ┌───────────────────────────────────────────┐ │
│  │  Feature Screen                           │ │
│  │  ┌─────────────────────────────────────┐  │ │
│  │  │  "Help" or "?" button               │  │ │
│  │  └──────────────┬──────────────────────┘  │ │
│  │                 │                          │ │
│  │                 ▼                          │ │
│  │  ┌─────────────────────────────────────┐  │ │
│  │  │  url_launcher package               │  │ │
│  │  └──────────────┬──────────────────────┘  │ │
│  └─────────────────┼──────────────────────────┘ │
└────────────────────┼─────────────────────────────┘
                     │
                     ▼
   ┌─────────────────────────────────────────┐
   │  Browser / WebView                      │
   │  https://your-site.azure.com/           │
   │        {feature}-guide-{lang}.html      │
   └─────────────────────────────────────────┘

Code example:
────────────────────────────────────────────────
import 'package:url_launcher/url_launcher.dart';

const DOCS_URL = 'https://your-site.azure.com';

Future<void> openHelp(String feature, String lang) async {
  final url = Uri.parse('$DOCS_URL/$feature-guide-$lang.html');
  await launchUrl(url, mode: LaunchMode.inAppWebView);
}
────────────────────────────────────────────────
```

---

## Security Considerations

### Authentication
- **Current:** None (public access)
- **Future Options:**
  - Azure AD integration
  - Private endpoints
  - VPN access
  - IP restrictions

### Data Sensitivity
- **Current:** User guides contain no sensitive data
- **Best Practice:** Review guides before publishing
- **Avoid:** API keys, passwords, internal system details

### SSL/HTTPS
- **Azure Static Web Apps:** Automatic SSL
- **Azure Storage:** Automatic SSL
- **Custom Domains:** Free SSL certificates via Azure

---

## Performance Optimization

### Current Implementation
- Static HTML files (fast loading)
- Inline CSS (no external requests)
- No JavaScript dependencies
- Minimal images

### CDN Coverage
- **Static Web Apps:** Global CDN included
- **Azure Storage:** Optional Azure CDN

### Caching Strategy
- HTML files: Client-side caching enabled
- No dynamic content
- No backend API calls

---

## Scalability

### Current Capacity
- Unlimited page views (static content)
- Azure Static Web Apps: 100GB bandwidth/month free
- Azure Storage: Pay per GB (very cheap)

### Growth Handling
- Add more guides: Just add HTML files
- More languages: Add language code
- Traffic increase: Handled by Azure CDN

---

## Monitoring & Analytics

### Available Options
1. **Azure Portal Metrics**
   - Bandwidth usage
   - Request count
   - Error rates

2. **Azure Application Insights** (optional)
   - Page views
   - User behavior
   - Performance metrics

3. **Google Analytics** (optional)
   - Add to HTML files
   - Track user engagement

---

## Backup & Recovery

### Source Control
- All source files in Git
- Version history maintained
- Easy rollback capability

### Deployment Recovery
```
# Rollback process
1. Revert Git commit
2. Run ./copy-guides.sh
3. Run ./deploy-to-azure.sh

# Or restore specific file
git checkout HEAD~1 -- lib/screens/responsive/{feature}/{FILE}.html
./copy-guides.sh
./deploy-to-azure.sh
```

---

## Cost Structure

### Azure Static Web Apps (Free Tier)
```
Resource                 Free Tier Limits           Cost if Exceeded
─────────────────────────────────────────────────────────────────
Bandwidth                100 GB/month              $0.20/GB
Storage                  Unlimited                 $0
Build minutes            Unlimited                 $0
Custom domains           Unlimited                 $0
SSL certificates         Unlimited                 $0
─────────────────────────────────────────────────────────────────
Typical monthly cost: $0 (for documentation site)
```

### Azure Storage Static Website
```
Resource                 Usage                     Cost
─────────────────────────────────────────────────────────────────
Storage (LRS)            ~10 MB                    ~$0.001/month
Bandwidth                First 100 GB              Free
Bandwidth                Additional                $0.08/GB
Operations               Reads                     $0.004/10k ops
─────────────────────────────────────────────────────────────────
Typical monthly cost: <$1 (for documentation site)
```

---

## Maintenance Schedule

### Weekly
- ⚠️ None required (static site)

### Monthly
- ✓ Review Azure costs
- ✓ Check for broken links
- ✓ Review analytics (if enabled)

### Quarterly
- ✓ Update outdated content
- ✓ Review user feedback
- ✓ Consider new features

### Annually
- ✓ Security review
- ✓ Performance optimization
- ✓ Architecture review

---

## Future Enhancements

### Potential Features
1. **Search Functionality**
   - Add client-side search
   - Index all guide content
   - Quick navigation

2. **Dark Mode**
   - Toggle between light/dark themes
   - Save user preference

3. **PDF Export**
   - Generate PDF versions
   - Allow offline viewing

4. **Version History**
   - Show changelog
   - Link to previous versions

5. **Feedback System**
   - "Was this helpful?" buttons
   - Submit feedback form
   - Analytics integration

6. **Mobile App**
   - Dedicated mobile app
   - Offline access
   - Push notifications for updates

---

## Technical Specifications

### Browser Compatibility
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers: iOS Safari 14+, Chrome Android 90+

### HTML/CSS Standards
- HTML5
- CSS3
- Responsive design (mobile-first)
- No framework dependencies

### JavaScript Requirements
- Minimal JavaScript (language toggle only)
- No external libraries
- Vanilla JS

### File Sizes
- index.html: ~10 KB
- Average guide: ~50-100 KB
- Total portal size: ~500 KB

---

**Document Version:** 1.0
**Last Updated:** November 6, 2025
**Maintained By:** Development Team
