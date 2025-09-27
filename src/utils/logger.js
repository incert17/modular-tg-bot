/**
 * Logger Utility
 * 
 * Winston-based logging system with multiple transports and formatting.
 * Provides structured logging for the entire application.
 * 
 * @module utils/logger
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { config } = require('./config');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Custom log format
 */
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
        
        // Add stack trace for errors
        if (stack) {
            log += `\n${stack}`;
        }
        
        // Add metadata if present
        if (Object.keys(meta).length > 0) {
            log += `\n${JSON.stringify(meta, null, 2)}`;
        }
        
        return log;
    })
);

/**
 * Console format for development
 */
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
        format: 'HH:mm:ss'
    }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
        let log = `${timestamp} ${level}: ${message}`;
        if (stack) {
            log += `\n${stack}`;
        }
        return log;
    })
);

/**
 * Create transports array
 */
const transports = [
    // Console transport
    new winston.transports.Console({
        level: config.IS_DEVELOPMENT ? 'debug' : config.LOG_LEVEL,
        format: config.IS_DEVELOPMENT ? consoleFormat : logFormat,
        handleExceptions: true,
        handleRejections: true
    })
];

// Add file transport in production
if (config.IS_PRODUCTION || config.LOG_FILE) {
    transports.push(
        // Error log file
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            format: logFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            handleExceptions: true,
            handleRejections: true
        }),
        
        // Combined log file
        new winston.transports.File({
            filename: path.join(logsDir, config.LOG_FILE || 'bot.log'),
            level: config.LOG_LEVEL,
            format: logFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    );
}

/**
 * Create Winston logger instance
 */
const logger = winston.createLogger({
    level: config.LOG_LEVEL,
    format: logFormat,
    transports,
    exitOnError: false
});

/**
 * Log bot activity
 * @param {string} action - Action performed
 * @param {Object} data - Additional data
 */
function logBotActivity(action, data = {}) {
    logger.info(`Bot Activity: ${action}`, {
        action,
        timestamp: new Date().toISOString(),
        ...data
    });
}

/**
 * Log user interaction
 * @param {Object} msg - Telegram message object
 * @param {string} action - Action performed
 */
function logUserInteraction(msg, action) {
    const user = msg.from;
    const chat = msg.chat;
    
    logger.info(`User Interaction: ${action}`, {
        action,
        userId: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        chatId: chat.id,
        chatType: chat.type,
        messageId: msg.message_id,
        timestamp: new Date().toISOString()
    });
}

/**
 * Log module activity
 * @param {string} moduleName - Name of the module
 * @param {string} action - Action performed
 * @param {Object} data - Additional data
 */
function logModuleActivity(moduleName, action, data = {}) {
    logger.info(`Module Activity: ${moduleName} - ${action}`, {
        module: moduleName,
        action,
        timestamp: new Date().toISOString(),
        ...data
    });
}

/**
 * Log error with context
 * @param {Error} error - Error object
 * @param {Object} context - Error context
 */
function logError(error, context = {}) {
    logger.error('Application Error', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        ...context
    });
}

/**
 * Log command execution
 * @param {string} command - Command name
 * @param {Object} msg - Telegram message object
 * @param {Object} result - Command execution result
 */
function logCommand(command, msg, result = {}) {
    const user = msg.from;
    
    logger.info(`Command Executed: ${command}`, {
        command,
        userId: user.id,
        username: user.username,
        chatId: msg.chat.id,
        success: result.success !== false,
        executionTime: result.executionTime,
        timestamp: new Date().toISOString()
    });
}

/**
 * Log webhook activity
 * @param {string} action - Webhook action
 * @param {Object} data - Request data
 */
function logWebhook(action, data = {}) {
    logger.info(`Webhook: ${action}`, {
        action,
        timestamp: new Date().toISOString(),
        ...data
    });
}

/**
 * Log deployment information
 * @param {Object} info - Deployment information
 */
function logDeployment(info = {}) {
    logger.info('Deployment Information', {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        environment: config.NODE_ENV,
        deploymentMode: config.DEPLOYMENT_MODE,
        timestamp: new Date().toISOString(),
        ...info
    });
}

/**
 * Create child logger with additional context
 * @param {Object} context - Additional context for all logs
 * @returns {Object} Child logger
 */
function createChildLogger(context = {}) {
    return logger.child(context);
}

// Log deployment information on startup
if (config.IS_PRODUCTION) {
    logDeployment();
}

// Export logger with additional methods
module.exports = Object.assign(logger, {
    logBotActivity,
    logUserInteraction,
    logModuleActivity,
    logError,
    logCommand,
    logWebhook,
    logDeployment,
    createChildLogger
});

