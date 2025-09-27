/**
 * Polling Handler
 * 
 * Long-polling handler for traditional server deployments.
 * Provides health check server and proper polling management.
 * 
 * @module handlers/polling
 */

const express = require('express');
const cors = require('cors');
const logger = require('../utils/logger');
const { config } = require('../utils/config');

/**
 * Polling Handler class
 */
class PollingHandler {
    constructor() {
        this.app = express();
        this.server = null;
        this.bot = null;
        this.pollingInterval = null;
        this.setupMiddleware();
        this.setupRoutes();
    }

    /**
     * Setup Express middleware for health check server
     */
    setupMiddleware() {
        // Enable CORS for all origins
        this.app.use(cors({
            origin: '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));

        // Parse JSON bodies
        this.app.use(express.json({ limit: '1mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));

        // Request logging middleware
        this.app.use((req, res, next) => {
            logger.logBotActivity('Health check request', {
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
                context: 'Health check server',
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
     * Setup Express routes for health checks
     */
    setupRoutes() {
        // Root health check
        this.app.get('/', (req, res) => {
            res.json({
                status: 'ok',
                message: 'Modular Telegram Bot Polling Server',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: '1.0.0',
                mode: 'polling'
            });
        });

        // Detailed health check
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
                mode: 'polling',
                bot: {
                    running: stats ? stats.isRunning : false,
                    uptime: stats ? stats.uptime : 0,
                    messagesProcessed: stats ? stats.messagesProcessed : 0,
                    commandsExecuted: stats ? stats.commandsExecuted : 0,
                    errorsOccurred: stats ? stats.errorsOccurred : 0,
                    loadedModules: stats ? stats.loadedModules : 0,
                    registeredCommands: stats ? stats.registeredCommands : 0
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

        // Bot information endpoint
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

        // Bot statistics endpoint
        this.app.get('/bot/stats', (req, res) => {
            try {
                if (!this.bot) {
                    return res.status(503).json({ error: 'Bot not initialized' });
                }

                const stats = this.bot.getStats();
                res.json(stats);

            } catch (error) {
                logger.logError(error, { context: 'Bot stats endpoint' });
                res.status(500).json({ error: 'Failed to get bot stats' });
            }
        });

        // Module management endpoints (admin only)
        this.app.get('/bot/modules', (req, res) => {
            try {
                if (!this.bot) {
                    return res.status(503).json({ error: 'Bot not initialized' });
                }

                const modules = this.bot.getModules();
                res.json(modules);

            } catch (error) {
                logger.logError(error, { context: 'Modules endpoint' });
                res.status(500).json({ error: 'Failed to get modules' });
            }
        });

        // Graceful shutdown endpoint
        this.app.post('/shutdown', (req, res) => {
            const token = req.body.token || req.headers['x-shutdown-token'];
            
            if (!token || token !== config.HEALTH_CHECK_TOKEN) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Invalid shutdown token'
                });
            }

            res.json({
                message: 'Shutdown initiated',
                timestamp: new Date().toISOString()
            });

            // Graceful shutdown after response
            setTimeout(async () => {
                logger.logBotActivity('Graceful shutdown initiated via API');
                await this.stop();
                process.exit(0);
            }, 1000);
        });

        // Catch-all route
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Not found',
                message: 'Endpoint not found',
                availableEndpoints: [
                    'GET /',
                    'GET /health',
                    'GET /bot/info',
                    'GET /bot/stats',
                    'GET /bot/modules',
                    'POST /shutdown'
                ]
            });
        });
    }

    /**
     * Start the polling handler
     * @param {Bot} bot - Bot instance
     * @param {Object} options - Handler options
     */
    async start(bot, options = {}) {
        try {
            this.bot = bot;
            
            const {
                port = config.PORT || 3000,
                host = config.HOST || '0.0.0.0',
                healthCheckOnly = false
            } = options;

            // Clear any existing webhook
            try {
                await bot.deleteWebhook();
                logger.logBotActivity('Webhook cleared for polling mode');
            } catch (error) {
                // Ignore webhook deletion errors
                logger.warn('Failed to clear webhook (may not exist):', error.message);
            }

            // Start the bot with polling
            await bot.start();
            logger.logBotActivity('Bot started in polling mode');

            // Start health check server if not disabled
            if (!healthCheckOnly) {
                this.server = this.app.listen(port, host, () => {
                    logger.logBotActivity('Health check server started', {
                        host,
                        port,
                        mode: 'polling'
                    });
                });

                // Handle server errors
                this.server.on('error', (error) => {
                    logger.logError(error, { context: 'Health check server' });
                    throw error;
                });
            }

            // Setup polling monitoring
            this.setupPollingMonitoring();

            return this.server;

        } catch (error) {
            logger.logError(error, { context: 'Polling handler startup' });
            throw error;
        }
    }

    /**
     * Setup polling monitoring and health checks
     */
    setupPollingMonitoring() {
        // Monitor polling health every 30 seconds
        this.pollingInterval = setInterval(() => {
            try {
                const stats = this.bot.getStats();
                
                logger.logBotActivity('Polling health check', {
                    isRunning: stats.isRunning,
                    uptime: stats.uptime,
                    messagesProcessed: stats.messagesProcessed,
                    errorsOccurred: stats.errorsOccurred
                });

                // Log warning if too many errors
                if (stats.errorsOccurred > 100) {
                    logger.warn('High error count detected', {
                        errorsOccurred: stats.errorsOccurred,
                        messagesProcessed: stats.messagesProcessed
                    });
                }

            } catch (error) {
                logger.logError(error, { context: 'Polling monitoring' });
            }
        }, 30000);

        // Log memory usage every 5 minutes
        setInterval(() => {
            const memUsage = process.memoryUsage();
            logger.logBotActivity('Memory usage', {
                rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
                external: Math.round(memUsage.external / 1024 / 1024) + ' MB'
            });
        }, 300000);
    }

    /**
     * Stop the polling handler
     */
    async stop() {
        try {
            // Clear monitoring interval
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
            }

            // Stop health check server
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
                logger.logBotActivity('Health check server stopped');
            }

            // Stop the bot
            if (this.bot) {
                await this.bot.stop();
                logger.logBotActivity('Bot stopped');
            }

        } catch (error) {
            logger.logError(error, { context: 'Polling handler shutdown' });
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

    /**
     * Check if polling is healthy
     * @returns {boolean} Whether polling is healthy
     */
    isHealthy() {
        return this.bot && this.bot.getStats().isRunning;
    }
}

// Export singleton instance
const pollingHandler = new PollingHandler();

module.exports = {
    start: (bot, options) => pollingHandler.start(bot, options),
    stop: () => pollingHandler.stop(),
    getServer: () => pollingHandler.getServer(),
    getApp: () => pollingHandler.getApp(),
    isHealthy: () => pollingHandler.isHealthy(),
    PollingHandler
};

