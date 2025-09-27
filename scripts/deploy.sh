#!/bin/bash

# Modular Telegram Bot - Deployment Script
# This script helps deploy the bot to various platforms

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}🚀 Modular Telegram Bot - Deployment Script${NC}"
echo -e "${BLUE}===========================================${NC}"
echo ""

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_step() {
    echo -e "${PURPLE}🔧 $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get user input
get_input() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " input
        if [ -z "$input" ]; then
            input="$default"
        fi
    else
        read -p "$prompt: " input
    fi
    
    eval "$var_name='$input'"
}

# Change to project directory
cd "$PROJECT_DIR"

# Check if .env exists
if [ ! -f ".env" ]; then
    print_error ".env file not found. Please run setup script first: bash scripts/setup.sh"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Show deployment options
echo -e "${BLUE}Available deployment platforms:${NC}"
echo ""
echo "1. 🆓 Vercel (Serverless, Free tier available)"
echo "2. 🆓 Railway (Container, Free tier available)"
echo "3. 🆓 Render (Web Service/Worker, Free tier available)"
echo "4. ☁️  Cloudflare Workers (Serverless, Free tier available)"
echo "5. 🐳 Docker (Container, Self-hosted)"
echo "6. 🖥️  Manual Server (VPS/Dedicated)"
echo "7. 📋 Show deployment checklist"
echo ""

get_input "Choose deployment platform (1-7)" "1" PLATFORM

case $PLATFORM in
    1)
        # Vercel deployment
        print_step "Deploying to Vercel..."
        
        if ! command_exists vercel; then
            print_info "Installing Vercel CLI..."
            npm install -g vercel
        fi
        
        # Check if already configured
        if [ ! -f ".vercel/project.json" ]; then
            print_info "Configuring Vercel project..."
            vercel --confirm
        fi
        
        # Set environment variables
        print_info "Setting environment variables..."
        vercel env add TELEGRAM_BOT_TOKEN production
        vercel env add NODE_ENV production
        vercel env add DEPLOYMENT_MODE webhook
        
        if [ -n "$WEBHOOK_SECRET" ]; then
            vercel env add WEBHOOK_SECRET production
        fi
        
        if [ -n "$ADMIN_USER_IDS" ]; then
            vercel env add ADMIN_USER_IDS production
        fi
        
        if [ -n "$OPENWEATHER_API_KEY" ]; then
            vercel env add OPENWEATHER_API_KEY production
        fi
        
        # Deploy
        print_info "Deploying to Vercel..."
        vercel --prod
        
        print_success "Deployed to Vercel successfully!"
        print_info "Don't forget to update WEBHOOK_URL in your environment variables with the deployed URL"
        ;;
        
    2)
        # Railway deployment
        print_step "Deploying to Railway..."
        
        if ! command_exists railway; then
            print_error "Railway CLI not found. Please install it from https://railway.app/cli"
            exit 1
        fi
        
        # Login check
        if ! railway whoami >/dev/null 2>&1; then
            print_info "Please login to Railway..."
            railway login
        fi
        
        # Initialize project
        if [ ! -f "railway.toml" ]; then
            print_info "Initializing Railway project..."
            railway init
        fi
        
        # Set environment variables
        print_info "Setting environment variables..."
        railway variables set TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN"
        railway variables set NODE_ENV=production
        railway variables set DEPLOYMENT_MODE=polling
        
        if [ -n "$ADMIN_USER_IDS" ]; then
            railway variables set ADMIN_USER_IDS="$ADMIN_USER_IDS"
        fi
        
        if [ -n "$OPENWEATHER_API_KEY" ]; then
            railway variables set OPENWEATHER_API_KEY="$OPENWEATHER_API_KEY"
        fi
        
        # Deploy
        print_info "Deploying to Railway..."
        railway up
        
        print_success "Deployed to Railway successfully!"
        ;;
        
    3)
        # Render deployment
        print_step "Deploying to Render..."
        
        print_info "For Render deployment:"
        echo "1. Push your code to GitHub"
        echo "2. Go to https://render.com and create a new account"
        echo "3. Connect your GitHub repository"
        echo "4. Choose 'Web Service' for webhook mode or 'Background Worker' for polling mode"
        echo "5. Use the render.yaml file for configuration"
        echo ""
        
        print_info "Environment variables to set in Render dashboard:"
        echo "• TELEGRAM_BOT_TOKEN: $TELEGRAM_BOT_TOKEN"
        echo "• NODE_ENV: production"
        echo "• DEPLOYMENT_MODE: webhook (for web service) or polling (for worker)"
        
        if [ -n "$ADMIN_USER_IDS" ]; then
            echo "• ADMIN_USER_IDS: $ADMIN_USER_IDS"
        fi
        
        if [ -n "$OPENWEATHER_API_KEY" ]; then
            echo "• OPENWEATHER_API_KEY: $OPENWEATHER_API_KEY"
        fi
        
        echo ""
        print_info "The render.yaml file is already configured for both webhook and polling modes."
        ;;
        
    4)
        # Cloudflare Workers deployment
        print_step "Deploying to Cloudflare Workers..."
        
        if ! command_exists wrangler; then
            print_info "Installing Wrangler CLI..."
            npm install -g wrangler
        fi
        
        # Login check
        if ! wrangler whoami >/dev/null 2>&1; then
            print_info "Please login to Cloudflare..."
            wrangler login
        fi
        
        # Set secrets
        print_info "Setting secrets..."
        echo "$TELEGRAM_BOT_TOKEN" | wrangler secret put TELEGRAM_BOT_TOKEN
        
        if [ -n "$WEBHOOK_SECRET" ]; then
            echo "$WEBHOOK_SECRET" | wrangler secret put WEBHOOK_SECRET
        fi
        
        if [ -n "$ADMIN_USER_IDS" ]; then
            echo "$ADMIN_USER_IDS" | wrangler secret put ADMIN_USER_IDS
        fi
        
        if [ -n "$OPENWEATHER_API_KEY" ]; then
            echo "$OPENWEATHER_API_KEY" | wrangler secret put OPENWEATHER_API_KEY
        fi
        
        # Deploy
        print_info "Deploying to Cloudflare Workers..."
        wrangler publish
        
        print_success "Deployed to Cloudflare Workers successfully!"
        ;;
        
    5)
        # Docker deployment
        print_step "Building Docker image..."
        
        if ! command_exists docker; then
            print_error "Docker not found. Please install Docker and try again."
            exit 1
        fi
        
        # Build image
        print_info "Building Docker image..."
        docker build -t modular-telegram-bot .
        
        # Create docker-compose.yml if it doesn't exist
        if [ ! -f "docker-compose.yml" ]; then
            print_info "Creating docker-compose.yml..."
            cat > docker-compose.yml << EOF
version: '3.8'

services:
  telegram-bot:
    build: .
    container_name: modular-telegram-bot
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DEPLOYMENT_MODE=polling
    env_file:
      - .env
    ports:
      - "3000:3000"
    volumes:
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "node", "scripts/health-check.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

# Optional: Add database service
# services:
#   postgres:
#     image: postgres:15-alpine
#     container_name: telegram-bot-db
#     restart: unless-stopped
#     environment:
#       POSTGRES_DB: telegram_bot
#       POSTGRES_USER: bot_user
#       POSTGRES_PASSWORD: bot_password
#     volumes:
#       - postgres_data:/var/lib/postgresql/data
#     ports:
#       - "5432:5432"

# volumes:
#   postgres_data:
EOF
        fi
        
        print_success "Docker image built successfully!"
        print_info "To run the bot: docker-compose up -d"
        print_info "To view logs: docker-compose logs -f"
        print_info "To stop the bot: docker-compose down"
        ;;
        
    6)
        # Manual server deployment
        print_step "Manual server deployment guide..."
        
        print_info "For manual server deployment:"
        echo ""
        echo "1. Prerequisites:"
        echo "   • Node.js 16+ installed"
        echo "   • PM2 for process management (optional but recommended)"
        echo "   • Nginx for reverse proxy (optional)"
        echo ""
        
        echo "2. Install PM2 (recommended):"
        echo "   npm install -g pm2"
        echo ""
        
        echo "3. Create PM2 ecosystem file:"
        cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'telegram-bot',
    script: 'bot.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      DEPLOYMENT_MODE: 'polling'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF
        
        echo "4. Start with PM2:"
        echo "   pm2 start ecosystem.config.js"
        echo "   pm2 save"
        echo "   pm2 startup"
        echo ""
        
        echo "5. For webhook mode, set up Nginx reverse proxy:"
        echo "   • Install Nginx"
        echo "   • Configure SSL certificate (Let's Encrypt recommended)"
        echo "   • Proxy requests to your bot's port"
        echo ""
        
        print_success "Manual deployment guide created!"
        ;;
        
    7)
        # Deployment checklist
        print_step "Deployment Checklist..."
        
        echo ""
        echo "📋 Pre-deployment checklist:"
        echo ""
        echo "✅ Environment Configuration:"
        echo "   • TELEGRAM_BOT_TOKEN is set"
        echo "   • NODE_ENV is set to 'production'"
        echo "   • DEPLOYMENT_MODE matches your platform (webhook/polling)"
        echo "   • Admin user IDs are configured"
        echo "   • Optional API keys are set (weather, etc.)"
        echo ""
        
        echo "✅ Code Quality:"
        echo "   • All modules are tested locally"
        echo "   • No sensitive data in code"
        echo "   • .env file is not committed to git"
        echo "   • Dependencies are up to date"
        echo ""
        
        echo "✅ Platform-specific:"
        echo "   • Webhook URL is correct (for webhook mode)"
        echo "   • Health check endpoints are accessible"
        echo "   • Resource limits are appropriate"
        echo "   • Logging is configured"
        echo ""
        
        echo "✅ Post-deployment:"
        echo "   • Test bot with /start command"
        echo "   • Check logs for errors"
        echo "   • Verify all modules are loaded"
        echo "   • Test webhook/polling connectivity"
        echo "   • Set up monitoring/alerts"
        echo ""
        
        print_info "Platform-specific free tier limits:"
        echo ""
        echo "🆓 Vercel:"
        echo "   • 100GB bandwidth/month"
        echo "   • 10s execution time limit"
        echo "   • Serverless functions only"
        echo ""
        
        echo "🆓 Railway:"
        echo "   • $5 credit/month"
        echo "   • 500 hours execution time"
        echo "   • 1GB RAM, 1 vCPU"
        echo ""
        
        echo "🆓 Render:"
        echo "   • 750 hours/month"
        echo "   • 512MB RAM"
        echo "   • Sleeps after 15min inactivity"
        echo ""
        
        echo "🆓 Cloudflare Workers:"
        echo "   • 100,000 requests/day"
        echo "   • 10ms CPU time/request"
        echo "   • 128MB memory"
        echo ""
        ;;
        
    *)
        print_error "Invalid option selected"
        exit 1
        ;;
esac

echo ""
print_success "Deployment process completed!"
echo ""

# Final tips
print_info "💡 Post-deployment tips:"
echo "• Test your bot by sending /start on Telegram"
echo "• Monitor logs for any errors"
echo "• Set up health check monitoring"
echo "• Consider setting up a custom domain"
echo "• Enable analytics if needed"
echo ""

print_info "🔧 Useful commands:"
echo "• Check bot health: npm run health"
echo "• View logs: tail -f logs/bot.log"
echo "• Test locally: npm run dev"
echo ""

print_success "Happy deploying! 🚀"

