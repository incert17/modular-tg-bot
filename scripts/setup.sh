#!/bin/bash

# Modular Telegram Bot - Setup Script
# This script helps initialize the project and configure environment variables

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}🤖 Modular Telegram Bot - Setup Script${NC}"
echo -e "${BLUE}======================================${NC}"
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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get user input with default value
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

# Function to get sensitive input (hidden)
get_secret_input() {
    local prompt="$1"
    local var_name="$2"
    
    read -s -p "$prompt: " input
    echo ""  # New line after hidden input
    eval "$var_name='$input'"
}

# Check prerequisites
print_info "Checking prerequisites..."

if ! command_exists node; then
    print_error "Node.js is not installed. Please install Node.js 16+ and try again."
    exit 1
fi

if ! command_exists npm; then
    print_error "npm is not installed. Please install npm and try again."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    print_error "Node.js version 16+ is required. Current version: $(node --version)"
    exit 1
fi

print_success "Prerequisites check passed"

# Change to project directory
cd "$PROJECT_DIR"

# Install dependencies
print_info "Installing dependencies..."
if npm install; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Create .env file if it doesn't exist
ENV_FILE="$PROJECT_DIR/.env"

if [ -f "$ENV_FILE" ]; then
    print_warning ".env file already exists"
    get_input "Do you want to overwrite it? (y/N)" "N" overwrite
    if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
        print_info "Keeping existing .env file"
        ENV_EXISTS=true
    else
        ENV_EXISTS=false
    fi
else
    ENV_EXISTS=false
fi

if [ "$ENV_EXISTS" != true ]; then
    print_info "Creating .env file..."
    
    # Copy from example
    cp .env.example .env
    
    echo ""
    print_info "Please provide the following configuration:"
    echo ""
    
    # Get Telegram Bot Token
    print_info "🤖 Telegram Bot Configuration"
    echo "To create a Telegram bot:"
    echo "1. Message @BotFather on Telegram"
    echo "2. Send /newbot command"
    echo "3. Follow the instructions to get your bot token"
    echo ""
    
    get_secret_input "Enter your Telegram Bot Token" TELEGRAM_BOT_TOKEN
    
    if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
        print_error "Telegram Bot Token is required"
        exit 1
    fi
    
    # Get deployment mode
    echo ""
    print_info "🚀 Deployment Configuration"
    echo "Choose deployment mode:"
    echo "1. polling - For traditional servers (Railway, Render, VPS)"
    echo "2. webhook - For serverless platforms (Vercel, Cloudflare Workers)"
    echo ""
    
    get_input "Deployment mode (polling/webhook)" "polling" DEPLOYMENT_MODE
    
    # Get webhook URL if webhook mode
    if [ "$DEPLOYMENT_MODE" = "webhook" ]; then
        echo ""
        get_input "Enter your webhook URL (e.g., https://your-domain.com)" "" WEBHOOK_URL
        get_input "Enter webhook secret (leave empty to generate)" "" WEBHOOK_SECRET
        
        if [ -z "$WEBHOOK_SECRET" ]; then
            WEBHOOK_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "$(date +%s)-$(shuf -i 1000-9999 -n 1)")
            print_info "Generated webhook secret: $WEBHOOK_SECRET"
        fi
    fi
    
    # Get admin user IDs
    echo ""
    print_info "👤 Admin Configuration"
    echo "To get your Telegram user ID:"
    echo "1. Message @userinfobot on Telegram"
    echo "2. It will reply with your user ID"
    echo ""
    
    get_input "Enter admin user IDs (comma-separated)" "" ADMIN_USER_IDS
    
    # Get optional API keys
    echo ""
    print_info "🌤️  Optional: Weather Module Configuration"
    echo "To enable weather commands:"
    echo "1. Visit https://openweathermap.org/api"
    echo "2. Sign up for a free account"
    echo "3. Get your API key"
    echo ""
    
    get_input "Enter OpenWeather API key (optional)" "" OPENWEATHER_API_KEY
    
    # Get environment
    echo ""
    get_input "Environment (development/production)" "development" NODE_ENV
    
    # Get port
    get_input "Server port" "3000" PORT
    
    # Update .env file
    print_info "Writing configuration to .env file..."
    
    # Use sed to replace values in .env file
    sed -i.bak "s/your_bot_token_here/$TELEGRAM_BOT_TOKEN/" .env
    sed -i.bak "s/development/$NODE_ENV/" .env
    sed -i.bak "s/polling/$DEPLOYMENT_MODE/" .env
    sed -i.bak "s/3000/$PORT/" .env
    
    if [ -n "$WEBHOOK_URL" ]; then
        sed -i.bak "s|https://your-domain.com/webhook|$WEBHOOK_URL|" .env
    fi
    
    if [ -n "$WEBHOOK_SECRET" ]; then
        sed -i.bak "s/your_webhook_secret_key/$WEBHOOK_SECRET/" .env
    fi
    
    if [ -n "$ADMIN_USER_IDS" ]; then
        sed -i.bak "s/123456789,987654321/$ADMIN_USER_IDS/" .env
    fi
    
    if [ -n "$OPENWEATHER_API_KEY" ]; then
        sed -i.bak "s/your_openweather_api_key/$OPENWEATHER_API_KEY/" .env
    fi
    
    # Remove backup file
    rm -f .env.bak
    
    print_success ".env file created successfully"
fi

# Create logs directory
print_info "Creating logs directory..."
mkdir -p logs
print_success "Logs directory created"

# Set up git hooks (if git repository)
if [ -d ".git" ]; then
    print_info "Setting up git hooks..."
    
    # Create pre-commit hook
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Pre-commit hook to check for sensitive data

# Check for potential secrets in staged files
if git diff --cached --name-only | xargs grep -l "TELEGRAM_BOT_TOKEN\|API_KEY\|SECRET" 2>/dev/null; then
    echo "⚠️  Warning: Potential secrets found in staged files"
    echo "Please make sure you're not committing sensitive data"
    echo "Use .env files for secrets and add them to .gitignore"
    exit 1
fi

# Check if .env is being committed
if git diff --cached --name-only | grep -q "^\.env$"; then
    echo "❌ Error: .env file should not be committed"
    echo "Please remove .env from staging: git reset HEAD .env"
    exit 1
fi
EOF
    
    chmod +x .git/hooks/pre-commit
    print_success "Git hooks set up"
fi

# Test bot configuration
print_info "Testing bot configuration..."

if [ -f ".env" ]; then
    # Source the .env file
    export $(cat .env | grep -v '^#' | xargs)
    
    if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
        # Test bot token by getting bot info
        BOT_INFO=$(curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe")
        
        if echo "$BOT_INFO" | grep -q '"ok":true'; then
            BOT_USERNAME=$(echo "$BOT_INFO" | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
            print_success "Bot token is valid! Bot username: @$BOT_USERNAME"
        else
            print_error "Bot token appears to be invalid"
            echo "Response: $BOT_INFO"
        fi
    else
        print_warning "No bot token found in .env file"
    fi
else
    print_warning "No .env file found"
fi

# Show next steps
echo ""
print_info "🎉 Setup completed successfully!"
echo ""
print_info "Next steps:"
echo "1. Review your .env file and adjust settings if needed"
echo "2. Start the bot in development mode: npm run dev"
echo "3. Test the bot by sending /start to your bot on Telegram"
echo "4. Add new modules to the src/modules/ directory"
echo ""

if [ "$DEPLOYMENT_MODE" = "webhook" ]; then
    print_info "For webhook deployment:"
    echo "• Deploy to your chosen platform (Vercel, Cloudflare Workers, etc.)"
    echo "• Make sure WEBHOOK_URL points to your deployed bot"
    echo "• The webhook will be set automatically when the bot starts"
    echo ""
fi

if [ "$DEPLOYMENT_MODE" = "polling" ]; then
    print_info "For polling deployment:"
    echo "• You can deploy to any server or container platform"
    echo "• The bot will use long-polling to receive updates"
    echo "• No webhook configuration needed"
    echo ""
fi

print_info "Available commands:"
echo "• npm start          - Start the bot"
echo "• npm run dev        - Start in development mode"
echo "• npm run webhook    - Start in webhook mode"
echo "• npm run polling    - Start in polling mode"
echo "• npm run health     - Check bot health"
echo ""

print_info "For deployment help, run: bash scripts/deploy.sh"
echo ""

print_success "Happy botting! 🤖"

