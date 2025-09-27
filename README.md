# 🤖 Modular Telegram Bot Framework

A highly modular, production-ready Telegram bot framework that allows developers to easily add new features as separate modules without modifying the core bot code. Designed for seamless deployment across serverless platforms (Vercel, Cloudflare Workers) and traditional servers (Railway, Render, Docker).

## ✨ Features

### 🏗️ **Modular Architecture**
- **Zero-Config Module Loading**: Automatically discovers and loads modules from the `/modules` directory
- **Hot-Swappable Modules**: Add, remove, or update modules without touching core code
- **Isolated Module Execution**: Module failures don't crash the entire bot
- **Rich Base Module Class**: Comprehensive helper methods and utilities for rapid development

### 🚀 **Deployment Flexibility**
- **Serverless Ready**: Native support for Vercel, Cloudflare Workers, and other serverless platforms
- **Traditional Server Support**: Works perfectly on Railway, Render, VPS, and Docker containers
- **Auto-Detection**: Automatically switches between webhook and polling modes based on environment
- **Zero-Config Deployment**: Deploy anywhere with minimal configuration changes

### 🛡️ **Production Features**
- **Comprehensive Logging**: Winston-based logging with multiple transports and log levels
- **Error Handling**: Robust error handling with graceful degradation
- **Rate Limiting**: Built-in rate limiting to prevent abuse
- **Health Monitoring**: Health check endpoints for monitoring and container orchestration
- **Security**: Input validation, webhook secret verification, and admin controls

### 🔧 **Developer Experience**
- **TypeScript-Ready**: Full TypeScript support (optional)
- **Environment-Driven**: All configuration via environment variables
- **Rich CLI Tools**: Setup, deployment, and health check scripts
- **Comprehensive Documentation**: Detailed guides and examples
- **Hot Reload**: Development mode with automatic restarts

## 📦 Built-in Modules

### 🔊 **Echo Module**
Text manipulation and utility commands:
- `/echo <text>` - Echo back the provided text
- `/reverse <text>` - Reverse the text
- `/uppercase <text>` - Convert to uppercase
- `/lowercase <text>` - Convert to lowercase
- `/count <text>` - Count characters, words, and lines

### 🎲 **Random Module**
Random generation utilities:
- `/random [max]` or `/random [min] [max]` - Generate random numbers
- `/flip` - Coin flip
- `/dice [sides] [count]` - Roll dice
- `/choose option1 option2...` - Choose randomly from options
- `/shuffle item1 item2...` - Shuffle a list
- `/password [length] [complexity]` - Generate secure passwords

### 👤 **Admin Module**
Bot management and information:
- `/start` - Welcome message and bot introduction
- `/help [command]` - Show available commands or detailed help
- `/modules` - List loaded modules (admin only)
- `/status` - Bot status and statistics (admin only)
- `/info` - Bot information
- `/ping` - Check bot responsiveness

### 🌤️ **Weather Module**
Weather information (requires OpenWeather API key):
- `/weather <city>` - Current weather conditions
- `/forecast <city>` - 5-day weather forecast

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))

### 1. Clone and Setup
```bash
git clone <repository-url>
cd modular-telegram-bot
npm install
bash scripts/setup.sh
```

The setup script will guide you through:
- Installing dependencies
- Creating `.env` configuration
- Setting up your Telegram bot token
- Configuring deployment mode
- Setting admin users
- Optional API keys setup

### 2. Start Development
```bash
npm run dev
```

### 3. Test Your Bot
Send `/start` to your bot on Telegram to verify it's working!

## 📁 Project Structure

```
telegram-bot/
├── .env.example              # Environment variables template
├── .gitignore               # Git ignore rules
├── package.json             # Dependencies and scripts
├── bot.js                   # Main entry point
├── src/
│   ├── core/                # Core framework files
│   │   ├── Bot.js          # Main bot class
│   │   ├── ModuleLoader.js # Module loading system
│   │   └── BaseModule.js   # Base class for modules
│   ├── modules/             # Bot modules
│   │   ├── echo.js         # Text manipulation commands
│   │   ├── random.js       # Random generation utilities
│   │   ├── admin.js        # Admin and help commands
│   │   └── weather.js      # Weather information
│   ├── utils/               # Utility functions
│   │   ├── config.js       # Configuration loader
│   │   ├── logger.js       # Logging system
│   │   └── validators.js   # Input validation
│   └── handlers/            # Deployment handlers
│       ├── webhook.js      # Webhook handler (serverless)
│       └── polling.js      # Polling handler (servers)
├── config/                  # Environment-specific configs
│   ├── development.json    # Development settings
│   ├── production.json     # Production settings
│   └── test.json          # Test settings
├── scripts/                 # Utility scripts
│   ├── setup.sh           # Project setup script
│   ├── deploy.sh          # Deployment helper
│   └── health-check.js    # Health monitoring
├── vercel.json             # Vercel deployment config
├── render.yaml             # Render deployment config
├── wrangler.toml           # Cloudflare Workers config
├── Dockerfile              # Docker container config
└── .dockerignore           # Docker ignore rules
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file (or use the setup script):

```bash
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Basic Configuration
NODE_ENV=development
DEPLOYMENT_MODE=polling
PORT=3000

# Admin Configuration
ADMIN_USER_IDS=123456789,987654321

# Webhook Configuration (for serverless)
WEBHOOK_URL=https://your-domain.com
WEBHOOK_SECRET=your_webhook_secret

# Optional API Keys
OPENWEATHER_API_KEY=your_openweather_api_key

# Logging
LOG_LEVEL=info
LOG_FILE=bot.log

# Security
RATE_LIMIT=30
HEALTH_CHECK_TOKEN=your_health_check_token
```

### Deployment Modes

#### 🌐 **Webhook Mode** (Serverless)
- Used for: Vercel, Cloudflare Workers, serverless platforms
- Set: `DEPLOYMENT_MODE=webhook`
- Requires: `WEBHOOK_URL` pointing to your deployed bot
- Benefits: Instant response, no polling overhead, scales automatically

#### 📡 **Polling Mode** (Traditional Servers)
- Used for: Railway, Render, VPS, Docker containers
- Set: `DEPLOYMENT_MODE=polling`
- Benefits: Simpler setup, works behind firewalls, no webhook configuration needed

## 🚀 Deployment

### 🆓 Free Hosting Options

#### Vercel (Serverless)
```bash
npm install -g vercel
vercel --confirm
# Set environment variables in Vercel dashboard
vercel --prod
```

#### Railway (Container)
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

#### Render (Web Service/Worker)
1. Connect your GitHub repository
2. Choose "Web Service" (webhook) or "Background Worker" (polling)
3. Use the included `render.yaml` configuration
4. Set environment variables in dashboard

#### Cloudflare Workers (Serverless)
```bash
npm install -g wrangler
wrangler login
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler publish
```

### 🐳 Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t telegram-bot .
docker run -d --env-file .env -p 3000:3000 telegram-bot
```

### 🖥️ Manual Server Deployment
```bash
# Install PM2 for process management
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🔧 Development

### Creating New Modules

1. Create a new file in `src/modules/`:

```javascript
// src/modules/mymodule.js
const BaseModule = require('../core/BaseModule');

class MyModule extends BaseModule {
    constructor(bot) {
        super(bot);
        this.name = 'MyModule';
        this.version = '1.0.0';
        this.description = 'My custom module';
    }

    async init() {
        await super.init();
        
        this.registerCommand('hello', this.handleHello, {
            description: 'Say hello',
            usage: '/hello [name]',
            permission: 'public'
        });
    }

    async handleHello(msg, args) {
        const name = args.join(' ') || 'World';
        await this.reply(msg, `Hello, ${name}! 👋`);
    }
}

module.exports = MyModule;
```

2. Restart the bot - your module will be automatically loaded!

### Module Development Guidelines

- **Extend BaseModule**: Always extend the `BaseModule` class
- **Unique Names**: Each module must have a unique name
- **Error Handling**: Use try-catch blocks and the `logError` method
- **Input Validation**: Use `validateArgs` and `validateInput` helpers
- **Permissions**: Set appropriate permission levels for commands
- **Documentation**: Provide clear descriptions and usage examples

### Available Helper Methods

```javascript
// Messaging
await this.sendMessage(chatId, text, options);
await this.reply(msg, text, options);
await this.sendPhoto(chatId, photo, options);

// Validation
const validation = this.validateArgs(args, schema);
const inputCheck = this.validateInput(userInput);

// Utilities
this.log('Action performed', { data });
this.logError(error, { context });
const keyboard = this.createInlineKeyboard(buttons);
const formatted = this.formatText('Bold text', 'bold');
```

## 📊 Monitoring and Health Checks

### Health Check Endpoints

- `GET /` - Basic status
- `GET /health` - Detailed health information
- `GET /bot/info` - Bot and module information

### Health Check Script

```bash
# Basic health check
node scripts/health-check.js

# Verbose output
node scripts/health-check.js --verbose

# JSON format for monitoring tools
node scripts/health-check.js --json --exit-code
```

### Logging

Logs are written to:
- Console (development)
- `logs/bot.log` (combined logs)
- `logs/error.log` (errors only)

Log levels: `error`, `warn`, `info`, `debug`

## 🔒 Security

### Built-in Security Features

- **Input Validation**: All user inputs are validated and sanitized
- **Rate Limiting**: Configurable rate limiting per user
- **Admin Controls**: Admin-only commands with user ID verification
- **Webhook Security**: Secret token verification for webhooks
- **Error Isolation**: Module errors don't crash the bot

### Security Best Practices

- Keep your bot token secret and never commit it to version control
- Use environment variables for all sensitive configuration
- Regularly update dependencies
- Monitor logs for suspicious activity
- Use HTTPS for webhook URLs
- Set up proper firewall rules for server deployments

## 🧪 Testing

### Manual Testing
```bash
# Start in development mode
npm run dev

# Test specific functionality
node scripts/health-check.js --verbose
```

### Automated Testing
The framework is designed to be testable. You can add tests using your preferred testing framework (Jest, Mocha, etc.).

## 📈 Performance

### Optimization Tips

- **Module Loading**: Modules are loaded once at startup for optimal performance
- **Memory Management**: Built-in memory monitoring and cleanup
- **Rate Limiting**: Prevents abuse and reduces server load
- **Efficient Logging**: Configurable log levels to reduce I/O in production
- **Connection Pooling**: Reuses HTTP connections for external API calls

### Scaling Considerations

- **Serverless**: Automatically scales with demand, no configuration needed
- **Traditional Servers**: Use PM2 cluster mode for multi-core utilization
- **Database**: Add database support for persistent data across restarts
- **Caching**: Implement Redis caching for frequently accessed data

## 🤝 Contributing

### Adding New Modules

1. Fork the repository
2. Create a new module in `src/modules/`
3. Follow the module development guidelines
4. Test thoroughly
5. Submit a pull request

### Core Framework Changes

1. Discuss major changes in issues first
2. Maintain backward compatibility
3. Add comprehensive tests
4. Update documentation

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

### Getting Help

1. **Documentation**: Check this README and inline code comments
2. **Issues**: Open a GitHub issue for bugs or feature requests
3. **Discussions**: Use GitHub Discussions for questions and ideas

### Common Issues

#### Bot Not Responding
- Check your bot token is correct
- Verify the bot is started (`/start` command)
- Check logs for errors
- Ensure webhook URL is accessible (webhook mode)

#### Module Not Loading
- Check module syntax and exports
- Verify module extends BaseModule
- Check logs for loading errors
- Ensure unique module names

#### Deployment Issues
- Verify environment variables are set
- Check platform-specific requirements
- Review deployment logs
- Test locally first

### Troubleshooting Commands

```bash
# Check bot health
npm run health

# View logs
tail -f logs/bot.log

# Test configuration
node -e "console.log(require('./src/utils/config').config)"

# Validate modules
node -e "require('./src/core/ModuleLoader')"
```

## 🗺️ Roadmap

### Planned Features

- **Database Integration**: Built-in support for PostgreSQL, MongoDB
- **Plugin Marketplace**: Community module repository
- **Web Dashboard**: Web interface for bot management
- **Analytics**: Built-in usage analytics and metrics
- **Multi-language**: Internationalization support
- **Inline Queries**: Support for inline query handling
- **File Handling**: Enhanced file upload/download capabilities

### Version History

- **v1.0.0**: Initial release with core framework and basic modules
- **v1.1.0**: Enhanced error handling and logging (planned)
- **v1.2.0**: Database integration (planned)
- **v2.0.0**: Web dashboard and analytics (planned)

---

**Built with ❤️ by the Modular Bot Framework Team**

*Happy botting! 🤖*

