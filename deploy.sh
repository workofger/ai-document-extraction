#!/bin/bash

# ===========================================
# Deploy Script - SFTP to PartRunner Products
# DocVal AI (/doc_demo)
# ===========================================

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  🚀 PartRunner DocVal AI - Deploy${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Configuración SFTP
PEM_PATH="/Users/aprendizia/Documents/_Partrunner/partrunner-products.pem"
HOST="sftp-products.partrunner.com"
USER="productsroot"
REMOTE_PATH="/products.partrunner.com/doc_demo"

# Validar PEM
if [ ! -f "$PEM_PATH" ]; then
    echo -e "${RED}❌ PEM file not found: $PEM_PATH${NC}"
    exit 1
fi

# Validar .env.local
if [ ! -f ".env.local" ]; then
    echo -e "${RED}❌ .env.local not found!${NC}"
    echo -e "${YELLOW}   Create .env.local with:${NC}"
    echo -e "${YELLOW}   OPENAI_API_KEY=sk-your-key-here${NC}"
    exit 1
fi

# Verificar API Key
if ! grep -q "OPENAI_API_KEY" .env.local; then
    echo -e "${RED}❌ OPENAI_API_KEY not found in .env.local${NC}"
    exit 1
fi
echo -e "${GREEN}✅ API Key configured${NC}"

# Fix permisos del .pem
chmod 400 "$PEM_PATH" 2>/dev/null || true

# Limpiar build anterior
echo -e "\n${YELLOW}🧹 Cleaning previous build...${NC}"
rm -rf dist

# Build
echo -e "\n${YELLOW}📦 Building production bundle...${NC}"
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Build failed - 'dist' directory not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Build completed${NC}"

# Mostrar contenido del build
echo -e "\n${YELLOW}📁 Build contents:${NC}"
ls -la dist/

# Deploy via SFTP
echo -e "\n${YELLOW}📤 Deploying to ${HOST}${REMOTE_PATH}...${NC}"

# Crear script SFTP batch
cat > /tmp/sftp_batch_docval.txt << SFTP_EOF
-mkdir ${REMOTE_PATH}
cd ${REMOTE_PATH}
lcd dist
put -r .
bye
SFTP_EOF

# Ejecutar SFTP
sftp -i "$PEM_PATH" -o StrictHostKeyChecking=no -b /tmp/sftp_batch_docval.txt "$USER@$HOST"

# Limpiar
rm -f /tmp/sftp_batch_docval.txt

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  ✅ Deploy successful!${NC}"
    echo -e "${GREEN}  🌐 https://products.partrunner.com/doc_demo/${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
else
    echo -e "${RED}❌ Deploy failed${NC}"
    exit 1
fi

