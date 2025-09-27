/**
 * Webhook Handler
 * 
 * Express server for handling Telegram webhooks in serverless environments.
 * Provides health checks, webhook endpoint, and proper error handling.
 * 
 * @module handlers/webhook
 */

const express = require('express');
const cors = require('cors');
const logger = require('../utils/logger');
const { config } = require('../utils/config');

/**
 * Webhook Handler class
 */
class WebhookHandler {
    constructor() {
        this.app = express();
        this.server = null;
        this.bot = null;
        this.setupMiddleware();
        this.setupRoutes();
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        // Enable CORS for all origins
        this.app.use(cors({
            origin: '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));

        // Parse JSON bodies
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Request logging middleware
        this.app.use((req, res, next) => {
            logger.logWebhook('Request received', {
                method: req.method,
                url: req.url,
                userAgent: req.get('User-Agent'),
                ip: req.ip || req.connection.remoteAddress
            });
            next();
        });

        // Error handling middleware
        this.app.use((error, req, res, next) => {
            logger.logError(error, { 
                context: 'Express middleware',
                method: req.method,
                url: req.url
            });
            
            res.status(500).json({
                error: 'Internal server error',
                message: config.IS_DEVELOPMENT ? error.message : 'Something went wrong'
            });
        });
    }

    /**
     * Setup Express routes
     */
    setupRoutes() {
        // Health check endpoint
        this.app.get('/', (req, res) => {
            res.json({
                status: 'ok',
                message: 'Modular Telegram Bot Webhook Server',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: '1.0.0'
            });
        });

        // Health check endpoint with token
        this.app.get('/health', (req, res) => {
            const token = req.query.token || req.headers['x-health-token'];
            
            if (config.HEALTH_CHECK_TOKEN && token !== config.HEALTH_CHECK_TOKEN) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Invalid health check token'
                });
            }

            const stats = this.bot ? this.bot.getStats() : null;
            
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                bot: {
                    running: stats ? stats.isRunning : false,
                    uptime: stats ? stats.uptime : 0,
                    messagesProcessed: stats ? stats.messagesProcessed : 0,
                    commandsExecuted: stats ? stats.commandsExecuted : 0,
                    errorsOccurred: stats ? stats.errorsOccurred : 0
                },
                system: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    arch: process.arch,
                    memory: process.memoryUsage(),
                    environment: config.NODE_ENV
                }
            });
        });

        // Webhook endpoint
        this.app.post('/webhook', async (req, res) => {
            try {
                // Verify webhook secret if configured
                if (config.WEBHOOK_SECRET) {
                    const providedSecret = req.headers['x-telegram-bot-api-secret-token'];
                    if (providedSecret !== config.WEBHOOK_SECRET) {
                        logger.logWebhook('Webhook authentication failed', {
                            providedSecret: providedSecret ? 'provided' : 'missing',
                            ip: req.ip
                        });
                        return res.status(401).json({ error: 'Unauthorized' });
                    }
                }

                // Validate request body
                if (!req.body || typeof req.body !== 'object') {
                    logger.logWebhook('Invalid webhook payload', { body: req.body });
                    return res.status(400).json({ error: 'Invalid payload' });
                }

                // Process the update
                if (this.bot) {
                    await this.bot.processUpdate(req.body);
                    logger.logWebhook('Update processed', {
                        updateId: req.body.update_id,
                        type: this.getUpdateType(req.body)
                    });
                } else {
                    logger.logWebhook('Bot not initialized', { updateId: req.body.update_id });
                    return res.status(503).json({ error: 'Bot not ready' });
                }

                res.json({ ok: true });

            } catch (error) {
                logger.logError(error, { 
                    context: 'Webhook processing',
                    updateId: req.body?.update_id
                });
                res.status(500).json({ error: 'Processing failed' });
            }
        });

        // Bot info endpoint
        this.app.get('/bot/info', async (req, res) => {
            try {
                if (!this.bot) {
                    return res.status(503).json({ error: 'Bot not initialized' });
                }

                const botInfo = await this.bot.getBotInfo();
                const stats = this.bot.getStats();
                const modules = this.bot.getModules();
                const commands = this.bot.getCommands();

                res.json({
                    bot: botInfo,
                    stats,
                    modules: modules.map(m => ({
                        name: m.name,
                        version: m.version,
                        description: m.description,
                        enabled: m.enabled,
                        commands: m.commands
                    })),
                    commands: commands.map(c => ({
                        command: c.command,
                        description: c.description,
                        usage: c.usage,
                        permission: c.permission,
                        module: c.module
                    }))
                });

            } catch (error) {
                logger.logError(error, { context: 'Bot info endpoint' });
                res.status(500).json({ error: 'Failed to get bot info' });
            }
        });

        // Catch-all route for undefined endpoints
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Not found',
                message: 'Endpoint not found',
                availableEndpoints: [
                    'GET /',
                    'GET /health',
                    'POST /webhook',
                    'GET /bot/info'
                ]
            });
        });
    }

    /**
     * Get update type from Telegram update object
     * @param {Object} update - Telegram update object
     * @returns {string} Update type
     */
    getUpdateType(update) {
        if (update.message) return 'message';
        if (update.edited_message) return 'edited_message';
        if (update.channel_post) return 'channel_post';
        if (update.edited_channel_post) return 'edited_channel_post';
        if (update.inline_query) return 'inline_query';
        if (update.chosen_inline_result) return 'chosen_inline_result';
        if (update.callback_query) return 'callback_query';
        if (update.shipping_query) return 'shipping_query';
        if (update.pre_checkout_query) return 'pre_checkout_query';
        if (update.poll) return 'poll';
        if (update.poll_answer) return 'poll_answer';
        if (update.my_chat_member) return 'my_chat_member';
        if (update.chat_member) return 'chat_member';
        if (update.chat_join_request) return 'chat_join_request';
        return 'unknown';
    }

    /**
     * Start the webhook server
     * @param {Bot} bot - Bot instance
     * @param {Object} options - Server options
     */
    async start(bot, options = {}) {
        try {
            this.bot = bot;
            
            const {
                port = config.PORT || 3000,
                host = config.HOST || '0.0.0.0',
                webhookUrl = config.WEBHOOK_URL,
                webhookSecret = config.WEBHOOK_SECRET
            } = options;

            // Start the bot
            await bot.start();

            // Set webhook if URL is provided
            if (webhookUrl) {
                const webhookOptions = {};
                if (webhookSecret) {
                    webhookOptions.secret_token = webhookSecret;
                }
                
                await bot.setWebhook(`${webhookUrl}/webhook`, webhookOptions);
                logger.logWebhook('Webhook set', { url: `${webhookUrl}/webhook` });
            } else {
                logger.warn('No webhook URL provided - webhook not set');
            }

            // Start Express server
            this.server = this.app.listen(port, host, () => {
                logger.logBotActivity('Webhook server started', {
                    host,
                    port,
                    webhookUrl: webhookUrl ? `${webhookUrl}/webhook` : null
                });
            });

            // Handle server errors
            this.server.on('error', (error) => {
                logger.logError(error, { context: 'Webhook server' });
                throw error;
            });

            return this.server;

        } catch (error) {
            logger.logError(error, { context: 'Webhook server startup' });
            throw error;
        }
    }

    /**
     * Stop the webhook server
     */
    async stop() {
        try {
            if (this.server) {
                await new Promise((resolve, reject) => {
                    this.server.close((error) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve();
                        }
                    });
                });
                
                this.server = null;
                logger.logBotActivity('Webhook server stopped');
            }

            if (this.bot) {
                await this.bot.deleteWebhook();
                await this.bot.stop();
                logger.logWebhook('Webhook deleted');
            }

        } catch (error) {
            logger.logError(error, { context: 'Webhook server shutdown' });
            throw error;
        }
    }

    /**
     * Get server instance
     * @returns {Object|null} Express server instance
     */
    getServer() {
        return this.server;
    }

    /**
     * Get Express app instance
     * @returns {Object} Express app instance
     */
    getApp() {
        return this.app;
    }
}

// Export singleton instance
const webhookHandler = new WebhookHandler();

module.exports = {
    start: (bot, options) => webhookHandler.start(bot, options),
    stop: () => webhookHandler.stop(),
    getServer: () => webhookHandler.getServer(),
    getApp: () => webhookHandler.getApp(),
    WebhookHandler
};

