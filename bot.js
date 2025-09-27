#!/usr/bin/env node

/**
 * Modular Telegram Bot - Main Entry Point
 * 
 * This is the main entry point for the modular Telegram bot.
 * It handles initialization, deployment mode detection, and starts the appropriate handler.
 * 
 * @author Modular Bot Framework
 * @version 1.0.0
 */

const path = require('path');
const { config } = require('./src/utils/config');
const logger = require('./src/utils/logger');
const Bot = require('./src/core/Bot');

/**
 * Main application entry point
 */
async function main() {
    try {
        logger.info('🚀 Starting Modular Telegram Bot...');
        logger.info(`Environment: ${config.NODE_ENV}`);
        logger.info(`Deployment Mode: ${config.DEPLOYMENT_MODE}`);

        // Validate required configuration
        if (!config.TELEGRAM_BOT_TOKEN) {
            throw new Error('TELEGRAM_BOT_TOKEN is required');
        }

        // Initialize the bot
        const bot = new Bot(config.TELEGRAM_BOT_TOKEN, {
            polling: config.DEPLOYMENT_MODE === 'polling',
            webhook: config.DEPLOYMENT_MODE === 'webhook'
        });

        // Load modules
        await bot.loadModules();

        // Start the bot based on deployment mode
        if (config.DEPLOYMENT_MODE === 'webhook') {
            logger.info('Starting in webhook mode...');
            const webhookHandler = require('./src/handlers/webhook');
            await webhookHandler.start(bot, {
                port: config.PORT,
                webhookUrl: config.WEBHOOK_URL,
                webhookSecret: config.WEBHOOK_SECRET
            });
        } else {
            logger.info('Starting in polling mode...');
            const pollingHandler = require('./src/handlers/polling');
            await pollingHandler.start(bot, {
                port: config.PORT
            });
        }

        logger.info('✅ Bot started successfully!');

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('🛑 Received SIGINT, shutting down gracefully...');
            await bot.stop();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            logger.info('🛑 Received SIGTERM, shutting down gracefully...');
            await bot.stop();
            process.exit(0);
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            process.exit(1);
        });

    } catch (error) {
        logger.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}

// Start the application
if (require.main === module) {
    main();
}

module.exports = main;

