# User Guide Portal - Documentation Index

Quick reference to all documentation files in this implementation.

---

## 📂 File Inventory

### Production Files
| File | Purpose | Access |
|------|---------|--------|
| [index.html](index.html) | Landing page with guide navigation | Public - deployed to web |
| settings-guide-en.html | Settings user guide (English) | Public - deployed to web |
| settings-guide-id.html | Settings user guide (Indonesian) | Coming soon |
| delivery-list-guide-en.html | Delivery list guide (English) | Public - deployed to web |
| delivery-list-guide-id.html | Delivery list guide (Indonesian) | Public - deployed to web |
| role-guide-en.html | Roles guide (English) | Public - deployed to web |
| role-guide-id.html | Roles guide (Indonesian) | Public - deployed to web |

### Scripts
| File | Purpose | When to Use |
|------|---------|-------------|
| [copy-guides.sh](copy-guides.sh) | Copy guides from source to docs | After updating any guide |
| [deploy-to-azure.sh](deploy-to-azure.sh) | Deploy to Azure Storage | When deploying/updating |

### Documentation
| File | Purpose | Target Audience |
|------|---------|-----------------|
| [README.md](README.md) | User-facing documentation | All users |
| [QUICKSTART.md](QUICKSTART.md) | Quick deployment guide | Developers (first-time setup) |
| [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) | Complete technical guide | Developers (detailed reference) |
| [DEVELOPER_CHECKLIST.md](DEVELOPER_CHECKLIST.md) | Task checklists | Developers (daily work) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture | Architects/Senior developers |
| [INDEX.md](INDEX.md) | This file - master index | Everyone (navigation) |

### Configuration
| File | Purpose |
|------|---------|
| [.gitignore](.gitignore) | Git ignore rules |

---

## 🗺️ Documentation Map

### For First-Time Users
```
START HERE
    ↓
README.md - Overview of what this is
    ↓
QUICKSTART.md - Get it deployed in 5 minutes
    ↓
Visit your deployed site!
```

### For Developers Adding New Guides
```
START HERE
    ↓
DEVELOPER_CHECKLIST.md - Step-by-step checklist
    ↓
Follow the checklist to add your guide
    ↓
Need more details? → IMPLEMENTATION_GUIDE.md
```

### For Developers Maintaining the System
```
START HERE
    ↓
IMPLEMENTATION_GUIDE.md - Complete technical reference
    ↓
Need quick tasks? → DEVELOPER_CHECKLIST.md
    ↓
Understanding architecture? → ARCHITECTURE.md
```

### For Architects/Team Leads
```
START HERE
    ↓
ARCHITECTURE.md - System design and architecture
    ↓
Implementation details? → IMPLEMENTATION_GUIDE.md
    ↓
Deployment options? → README.md (Deployment section)
```

---

## 📚 Documentation by Topic

### Getting Started
- **What is this?** → [README.md](README.md) - Overview section
- **How to deploy?** → [QUICKSTART.md](QUICKSTART.md)
- **File structure?** → [README.md](README.md) - File Structure section

### Development
- **Add new guide?** → [DEVELOPER_CHECKLIST.md](DEVELOPER_CHECKLIST.md) - "Adding a New User Guide"
- **Update existing guide?** → [DEVELOPER_CHECKLIST.md](DEVELOPER_CHECKLIST.md) - "Updating an Existing Guide"
- **How scripts work?** → [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) - "Script Reference"
- **Naming conventions?** → [ARCHITECTURE.md](ARCHITECTURE.md) - "Naming Convention"

### Deployment
- **Azure Static Web Apps?** → [README.md](README.md) - "Option 1: Azure Static Web Apps"
- **Azure Storage?** → [README.md](README.md) - "Option 2: Azure Storage Static Website"
- **Deployment process?** → [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) - "Deployment Process"
- **CI/CD setup?** → [README.md](README.md) - "Continuous Deployment"

### Architecture
- **System overview?** → [ARCHITECTURE.md](ARCHITECTURE.md) - "System Overview"
- **Data flow?** → [ARCHITECTURE.md](ARCHITECTURE.md) - "Data Flow"
- **Component structure?** → [ARCHITECTURE.md](ARCHITECTURE.md) - "Component Architecture"
- **Integration with app?** → [ARCHITECTURE.md](ARCHITECTURE.md) - "Integration with Flutter App"

### Troubleshooting
- **Common issues?** → [DEVELOPER_CHECKLIST.md](DEVELOPER_CHECKLIST.md) - "Troubleshooting Quick Fixes"
- **Detailed solutions?** → [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) - "Troubleshooting"
- **Deployment problems?** → [README.md](README.md) - Check relevant deployment section

### Maintenance
- **Regular tasks?** → [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) - "Maintenance"
- **Update scripts?** → [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) - "Script Reference"
- **Best practices?** → [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) - "Best Practices"

---

## 🎯 Common Tasks - Quick Links

### I want to...
| Task | Go to |
|------|-------|
| Deploy for the first time | [QUICKSTART.md](QUICKSTART.md) |
| Add a new user guide | [DEVELOPER_CHECKLIST.md](DEVELOPER_CHECKLIST.md) → "Adding a New User Guide" |
| Update an existing guide | [DEVELOPER_CHECKLIST.md](DEVELOPER_CHECKLIST.md) → "Updating an Existing Guide" |
| Understand how it works | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Fix a broken deployment | [DEVELOPER_CHECKLIST.md](DEVELOPER_CHECKLIST.md) → "Troubleshooting" |
| Link from Flutter app | [README.md](README.md) → "Linking from Your App" |
| Set up continuous deployment | [README.md](README.md) → "Continuous Deployment" |
| Understand naming conventions | [ARCHITECTURE.md](ARCHITECTURE.md) → "Naming Convention" |
| Review architecture | [ARCHITECTURE.md](ARCHITECTURE.md) → "System Overview" |
| Get quick command reference | [DEVELOPER_CHECKLIST.md](DEVELOPER_CHECKLIST.md) → "Quick Commands Reference" |

---

## 📖 Reading Order Recommendations

### For New Team Members
1. [README.md](README.md) - Understand what this is
2. [QUICKSTART.md](QUICKSTART.md) - Try deploying it
3. [DEVELOPER_CHECKLIST.md](DEVELOPER_CHECKLIST.md) - Learn daily workflows
4. [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) - Deep dive into details

### For Experienced Developers Joining Project
1. [ARCHITECTURE.md](ARCHITECTURE.md) - Understand the design
2. [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) - Implementation details
3. [DEVELOPER_CHECKLIST.md](DEVELOPER_CHECKLIST.md) - Bookmark for reference

### For Managers/Non-Technical Users
1. [README.md](README.md) - High-level overview
2. [QUICKSTART.md](QUICKSTART.md) - Understand deployment process
3. [ARCHITECTURE.md](ARCHITECTURE.md) - "Deployment Options Comparison"

---

## 🔧 Scripts Quick Reference

### copy-guides.sh
**Purpose:** Copy user guides from source folders to docs
```bash
cd docs
./copy-guides.sh
```
**Details:** [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) → "Script Reference" → "copy-guides.sh"

### deploy-to-azure.sh
**Purpose:** Deploy documentation to Azure Storage
```bash
cd docs
./deploy-to-azure.sh
```
**Details:** [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) → "Script Reference" → "deploy-to-azure.sh"

---

## 📊 Documentation Status

| Document | Status | Last Updated | Completeness |
|----------|--------|--------------|--------------|
| README.md | ✅ Complete | 2025-11-06 | 100% |
| QUICKSTART.md | ✅ Complete | 2025-11-06 | 100% |
| IMPLEMENTATION_GUIDE.md | ✅ Complete | 2025-11-06 | 100% |
| DEVELOPER_CHECKLIST.md | ✅ Complete | 2025-11-06 | 100% |
| ARCHITECTURE.md | ✅ Complete | 2025-11-06 | 100% |
| INDEX.md | ✅ Complete | 2025-11-06 | 100% |

---

## 🆘 Need Help?

### Quick Questions
Check [DEVELOPER_CHECKLIST.md](DEVELOPER_CHECKLIST.md) for quick answers

### Detailed Technical Questions
Check [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) for in-depth explanations

### Architecture Questions
Check [ARCHITECTURE.md](ARCHITECTURE.md) for system design

### Deployment Issues
Check [QUICKSTART.md](QUICKSTART.md) or [README.md](README.md) deployment sections

### Still Stuck?
1. Review troubleshooting sections in relevant docs
2. Check Azure documentation (links in README.md)
3. Contact the development team

---

## 🔄 Keeping Documentation Updated

### When to Update Documentation

| Change Type | Update These Files |
|-------------|-------------------|
| Add new guide | DEVELOPER_CHECKLIST.md (status table), copy-guides.sh (code), index.html (cards) |
| Change deployment process | QUICKSTART.md, README.md, IMPLEMENTATION_GUIDE.md |
| Update scripts | IMPLEMENTATION_GUIDE.md (Script Reference), copy-guides.sh or deploy-to-azure.sh |
| Architecture changes | ARCHITECTURE.md, IMPLEMENTATION_GUIDE.md |
| New best practices | IMPLEMENTATION_GUIDE.md (Best Practices) |

### Documentation Review Schedule
- **After each guide addition:** Update status tables
- **Monthly:** Review for accuracy
- **Quarterly:** Major review and updates
- **When onboarding:** Get feedback and improve

---

## 📝 Documentation Principles

### What We Document
✅ How to use the system
✅ How to add/update guides
✅ How to deploy
✅ How the system works
✅ Common problems and solutions
✅ Best practices

### What We Don't Document
❌ Basic Git commands (assume knowledge)
❌ Flutter development (out of scope)
❌ Azure fundamentals (link to Azure docs)
❌ HTML/CSS basics (assume knowledge)

### Documentation Standards
- **Clear:** Easy to understand
- **Concise:** No unnecessary details
- **Complete:** All necessary information
- **Current:** Kept up to date
- **Accessible:** Easy to find

---

## 🌟 Key Concepts

### Source Files
Location where guides are originally created
- Path: `lib/screens/responsive/{feature}/`
- Format: `{FEATURE}_USER_GUIDE_{LANG}.html`

### Compiled Files
Location where guides are prepared for deployment
- Path: `docs/`
- Format: `{feature}-guide-{lang}.html`

### Deployment
Process of publishing guides to Azure
- Method 1: Azure Static Web Apps (automatic via GitHub)
- Method 2: Azure Storage (manual via script)

### Portal
The main website (index.html) that links to all guides
- Includes language switcher
- Card-based navigation
- Responsive design

---

## 🎓 Learning Path

### Level 1: User
**Goal:** Access and use the documentation portal
**Start:** Deployed website URL
**Duration:** 5 minutes
**Reading:** None needed

### Level 2: Contributor
**Goal:** Add or update user guides
**Start:** [DEVELOPER_CHECKLIST.md](DEVELOPER_CHECKLIST.md)
**Duration:** 30 minutes
**Reading:** DEVELOPER_CHECKLIST.md

### Level 3: Developer
**Goal:** Maintain and troubleshoot the system
**Start:** [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)
**Duration:** 2 hours
**Reading:** IMPLEMENTATION_GUIDE.md, DEVELOPER_CHECKLIST.md

### Level 4: Architect
**Goal:** Understand and modify the architecture
**Start:** [ARCHITECTURE.md](ARCHITECTURE.md)
**Duration:** 3 hours
**Reading:** All documentation files

---

## 📦 What's Included

### Production Code
- ✅ Landing page (index.html)
- ✅ 5 user guide HTML files (compiled from source)
- ✅ Responsive CSS (inline)
- ✅ Minimal JavaScript (language toggle)

### Automation Scripts
- ✅ File copying script (copy-guides.sh)
- ✅ Azure deployment script (deploy-to-azure.sh)

### Documentation
- ✅ 6 comprehensive documentation files
- ✅ Step-by-step guides
- ✅ Checklists
- ✅ Architecture diagrams
- ✅ Troubleshooting guides

### Configuration
- ✅ Git ignore rules
- ✅ Script configurations

### Total Package
- **HTML files:** 6
- **Scripts:** 2
- **Documentation:** 6
- **Total files:** 15

---

## ✅ Implementation Checklist

Verify your setup is complete:

- [ ] All HTML files present in docs/
- [ ] Scripts are executable (chmod +x *.sh)
- [ ] index.html loads locally
- [ ] All guide links work
- [ ] Language toggle works
- [ ] copy-guides.sh runs without errors
- [ ] Azure deployment chosen (Static Web Apps OR Storage)
- [ ] Deployment successful
- [ ] Production site accessible
- [ ] All documentation read

---

## 🚀 Next Steps

After reviewing this index:

1. **If deploying for first time:**
   → Go to [QUICKSTART.md](QUICKSTART.md)

2. **If adding a new guide:**
   → Go to [DEVELOPER_CHECKLIST.md](DEVELOPER_CHECKLIST.md) → "Adding a New User Guide"

3. **If troubleshooting:**
   → Go to [DEVELOPER_CHECKLIST.md](DEVELOPER_CHECKLIST.md) → "Troubleshooting"

4. **If learning the system:**
   → Go to [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)

5. **If reviewing architecture:**
   → Go to [ARCHITECTURE.md](ARCHITECTURE.md)

---

**Welcome to the User Guide Portal! 🎉**

This documentation will help you understand, use, and maintain the system.
Start with the relevant document for your role and needs.

---

**Document Version:** 1.0
**Last Updated:** November 6, 2025
**Maintained By:** Development Team
