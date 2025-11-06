#!/bin/bash
################################################################################
# copy-guides.sh
#
# Purpose: Copy user guide HTML files from feature folders to docs folder
#          with standardized naming convention
#
# Usage: ./docs/copy-guides.sh (from project root)
#        OR
#        cd .. && ./docs/copy-guides.sh (if in docs folder)
#
# Source pattern:  lib/screens/responsive/{feature}/{FEATURE}_USER_GUIDE_{LANG}.html
# Output pattern:  docs/{feature}-guide-{lang}.html
#
# Note: This script always exits with success (0) even if some files are missing.
#       Missing files generate warnings but don't stop the process.
#       Script must be run from project root directory!
#
# For detailed documentation, see: IMPLEMENTATION_GUIDE.md
################################################################################

echo "📚 Copying user guide files to docs folder..."

# Create docs directory if it doesn't exist
mkdir -p docs

# Settings guides
if [ -f "lib/screens/responsive/settings/SETTINGS_USER_GUIDE_EN.html" ]; then
    cp lib/screens/responsive/settings/SETTINGS_USER_GUIDE_EN.html docs/settings-guide-en.html
    echo "✅ Copied settings-guide-en.html"
else
    echo "⚠️  Settings English guide not found"
fi

if [ -f "lib/screens/responsive/settings/SETTINGS_USER_GUIDE_ID.html" ]; then
    cp lib/screens/responsive/settings/SETTINGS_USER_GUIDE_ID.html docs/settings-guide-id.html
    echo "✅ Copied settings-guide-id.html"
else
    echo "⚠️  Settings Indonesian guide not found"
fi

# Delivery List guides
if [ -f "lib/screens/responsive/delivery_list/DELIVERY_LIST_USER_GUIDE.html" ]; then
    cp lib/screens/responsive/delivery_list/DELIVERY_LIST_USER_GUIDE.html docs/delivery-list-guide-en.html
    echo "✅ Copied delivery-list-guide-en.html"
else
    echo "⚠️  Delivery List English guide not found"
fi

if [ -f "lib/screens/responsive/delivery_list/DELIVERY_LIST_USER_GUIDE_ID.html" ]; then
    cp lib/screens/responsive/delivery_list/DELIVERY_LIST_USER_GUIDE_ID.html docs/delivery-list-guide-id.html
    echo "✅ Copied delivery-list-guide-id.html"
else
    echo "⚠️  Delivery List Indonesian guide not found"
fi

# Role guides
if [ -f "lib/screens/responsive/role/ROLE_USER_GUIDE_EN.html" ]; then
    cp lib/screens/responsive/role/ROLE_USER_GUIDE_EN.html docs/role-guide-en.html
    echo "✅ Copied role-guide-en.html"
else
    echo "⚠️  Role English guide not found"
fi

if [ -f "lib/screens/responsive/role/ROLE_USER_GUIDE_ID.html" ]; then
    cp lib/screens/responsive/role/ROLE_USER_GUIDE_ID.html docs/role-guide-id.html
    echo "✅ Copied role-guide-id.html"
else
    echo "⚠️  Role Indonesian guide not found"
fi

echo ""
echo "✨ Done! Files copied to docs/ folder"
echo "📂 You can now deploy the docs/ folder to Azure"
