#!/bin/bash

# Partrunner DocVal AI - Deployment Script
# Usage: ./scripts/deploy.sh [dev|staging|prod]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-prod}
PROJECT_NAME="partrunner-docval-ai"
REMOTE_USER="${REMOTE_USER:-deploy}"
REMOTE_HOST="${REMOTE_HOST:-products.partrunner.com}"
REMOTE_PATH="${REMOTE_PATH:-/var/www/products.partrunner.com/doc_demo}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Partrunner DocVal AI - Deploy Script ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo -e "${RED}Error: .env.local not found!${NC}"
    echo "Please create .env.local with your GEMINI_API_KEY"
    exit 1
fi

# Load environment variables
source .env.local

if [ -z "$GEMINI_API_KEY" ]; then
    echo -e "${RED}Error: GEMINI_API_KEY not set in .env.local${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Environment variables loaded${NC}"

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm ci --silent

# Run type check
echo -e "${YELLOW}Running type check...${NC}"
npm run type-check || {
    echo -e "${RED}Type check failed!${NC}"
    exit 1
}
echo -e "${GREEN}✓ Type check passed${NC}"

# Build project
echo -e "${YELLOW}Building for production...${NC}"
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}Build failed - dist directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build completed${NC}"

# Deploy based on method
case $ENVIRONMENT in
    "docker")
        echo -e "${YELLOW}Deploying with Docker...${NC}"
        docker-compose down 2>/dev/null || true
        docker-compose build --build-arg GEMINI_API_KEY=$GEMINI_API_KEY
        docker-compose up -d
        echo -e "${GREEN}✓ Docker deployment completed${NC}"
        ;;
    
    "sftp"|"sft"|"prod")
        echo -e "${YELLOW}Deploying via SFTP to $REMOTE_HOST...${NC}"
        
        # Check if sftp is available
        if ! command -v sftp &> /dev/null; then
            echo -e "${RED}sftp command not found. Please install OpenSSH.${NC}"
            exit 1
        fi
        
        # Create remote directory if needed and upload files
        echo -e "${YELLOW}Uploading files...${NC}"
        
        # Using rsync for better file transfer (if available)
        if command -v rsync &> /dev/null; then
            rsync -avz --delete \
                -e "ssh -o StrictHostKeyChecking=no" \
                dist/ \
                ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/
        else
            # Fallback to scp
            scp -r dist/* ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/
        fi
        
        echo -e "${GREEN}✓ Files uploaded to $REMOTE_HOST${NC}"
        ;;
    
    "local"|"dev")
        echo -e "${YELLOW}Starting local preview server...${NC}"
        npm run preview
        ;;
    
    *)
        echo -e "${RED}Unknown environment: $ENVIRONMENT${NC}"
        echo "Usage: ./scripts/deploy.sh [docker|sftp|local]"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment completed successfully!   ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "URL: ${BLUE}https://products.partrunner.com/doc_demo${NC}"
echo ""

