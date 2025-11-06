#!/bin/bash
################################################################################
# deploy-to-azure.sh
#
# Purpose: Deploy user guide documentation to Azure Storage Static Website
#
# Usage: ./deploy-to-azure.sh
#
# Prerequisites:
#   - Azure CLI installed (https://aka.ms/azure-cli)
#   - Logged in to Azure (az login)
#   - Proper permissions on Azure subscription
#
# This script provides two modes:
#   1. Create new Azure resources and deploy
#   2. Deploy to existing Azure resources
#
# Configuration: Edit the variables below before first run
#
# For detailed documentation, see: IMPLEMENTATION_GUIDE.md
################################################################################

# Configuration - CHANGE THESE VALUES BEFORE FIRST RUN
STORAGE_ACCOUNT="userguidedocs"  # Your Azure Storage account name (must be globally unique)
RESOURCE_GROUP="user-guide-rg"   # Your Azure resource group name
LOCATION="southeastasia"         # Azure region (southeastasia for Singapore, eastasia for Hong Kong)

echo "🚀 Deploying User Guide Documentation to Azure"
echo "================================================"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed!"
    echo "📥 Please install from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

echo "✅ Azure CLI found"
echo ""

# Check if logged in to Azure
echo "🔐 Checking Azure login status..."
az account show &> /dev/null
if [ $? -ne 0 ]; then
    echo "🔑 Please login to Azure:"
    az login
    if [ $? -ne 0 ]; then
        echo "❌ Azure login failed"
        exit 1
    fi
fi
echo "✅ Logged in to Azure"
echo ""

# Ask user if they want to create resources or just deploy
echo "What would you like to do?"
echo "1) Create new Azure Storage account and deploy"
echo "2) Deploy to existing Azure Storage account"
read -p "Enter choice (1 or 2): " choice
echo ""

if [ "$choice" == "1" ]; then
    # Create resource group
    echo "📦 Creating resource group: $RESOURCE_GROUP in $LOCATION..."
    az group create --name $RESOURCE_GROUP --location $LOCATION
    if [ $? -ne 0 ]; then
        echo "⚠️  Resource group might already exist, continuing..."
    fi
    echo ""

    # Create storage account
    echo "💾 Creating storage account: $STORAGE_ACCOUNT..."
    az storage account create \
        --name $STORAGE_ACCOUNT \
        --resource-group $RESOURCE_GROUP \
        --location $LOCATION \
        --sku Standard_LRS \
        --kind StorageV2

    if [ $? -ne 0 ]; then
        echo "❌ Failed to create storage account"
        echo "💡 Tip: Storage account name must be globally unique, 3-24 characters, lowercase letters and numbers only"
        exit 1
    fi
    echo ""

    # Enable static website
    echo "🌐 Enabling static website hosting..."
    az storage blob service-properties update \
        --account-name $STORAGE_ACCOUNT \
        --static-website \
        --index-document index.html \
        --auth-mode login

    if [ $? -ne 0 ]; then
        echo "❌ Failed to enable static website"
        exit 1
    fi
    echo ""
fi

# Copy files first (if script exists)
if [ -f "copy-guides.sh" ]; then
    echo "📋 Copying latest guide files..."
    bash copy-guides.sh
    echo ""
fi

# Upload files
echo "📤 Uploading files to Azure Storage..."
az storage blob upload-batch \
    --account-name $STORAGE_ACCOUNT \
    --source . \
    --destination '$web' \
    --overwrite \
    --auth-mode login \
    --pattern "*.html"

if [ $? -ne 0 ]; then
    echo "❌ Failed to upload files"
    exit 1
fi
echo ""

# Get the website URL
echo "🎉 Deployment complete!"
echo ""
echo "🌐 Your documentation is now live at:"
WEBSITE_URL=$(az storage account show \
    --name $STORAGE_ACCOUNT \
    --resource-group $RESOURCE_GROUP \
    --query "primaryEndpoints.web" \
    --output tsv)

echo "   $WEBSITE_URL"
echo ""
echo "📝 Next steps:"
echo "   1. Visit the URL above to view your documentation"
echo "   2. (Optional) Configure a custom domain in Azure Portal"
echo "   3. (Optional) Add Azure CDN for better global performance"
echo ""
echo "💡 To update documentation in the future, just run this script again!"
