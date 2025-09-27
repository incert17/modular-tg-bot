/**
 * Configuration Loader
 * 
 * Loads and validates environment variables and configuration settings.
 * Provides a centralized configuration object for the entire application.
 * 
 * @module utils/config
 */

const path = require('path');
const fs = require('fs');

// Load environment variables from .env file
require('dotenv').config();

/**
 * Load environment-specific configuration
 * @param {string} env - Environment name
 * @returns {Object} Environment-specific configuration
 */
function loadEnvironmentConfig(env) {
    const configPath = path.join(__dirname, '../../config', `${env}.json`);
    
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (error) {
            console.warn(`Warning: Failed to load ${env} config:`, error.message);
        }
    }
    
    return {};
}

/**
 * Parse comma-separated string to array
 * @param {string} str - Comma-separated string
 * @returns {Array} Array of strings
 */
function parseArray(str) {
    if (!str) return [];
    return str.split(',').map(item => item.trim()).filter(Boolean);
}

/**
 * Parse boolean from string
 * @param {string} str - String to parse
 * @param {boolean} defaultValue - Default value if parsing fails
 * @returns {boolean} Parsed boolean value
 */
function parseBoolean(str, defaultValue = false) {
    if (str === undefined || str === null) return defaultValue;
    return str.toLowerCase() === 'true';
}

/**
 * Parse integer from string
 * @param {string} str - String to parse
 * @param {number} defaultValue - Default value if parsing fails
 * @returns {number} Parsed integer value
 */
function parseInteger(str, defaultValue = 0) {
    const parsed = parseInt(str, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

// Get environment
const NODE_ENV = process.env.NODE_ENV || 'development';

// Load environment-specific configuration
const envConfig = loadEnvironmentConfig(NODE_ENV);

/**
 * Application configuration object
 */
const config = {
    // Environment
    NODE_ENV,
    IS_DEVELOPMENT: NODE_ENV === 'development',
    IS_PRODUCTION: NODE_ENV === 'production',
    IS_TEST: NODE_ENV === 'test',

    // Server Configuration
    PORT: parseInteger(process.env.PORT, 3000),
    HOST: process.env.HOST || '0.0.0.0',

    // Telegram Bot Configuration
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    
    // Deployment Configuration
    DEPLOYMENT_MODE: process.env.DEPLOYMENT_MODE || 'polling',
    WEBHOOK_URL: process.env.WEBHOOK_URL,
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || 'default-secret',

    // Admin Configuration
    ADMIN_USER_IDS: parseArray(process.env.ADMIN_USER_IDS),

    // Logging Configuration
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    LOG_FILE: process.env.LOG_FILE || 'bot.log',

    // Rate Limiting
    RATE_LIMIT: parseInteger(process.env.RATE_LIMIT, 30),

    // Feature Flags
    ENABLE_ANALYTICS: parseBoolean(process.env.ENABLE_ANALYTICS),
    ENABLE_METRICS: parseBoolean(process.env.ENABLE_METRICS),

    // Health Check
    HEALTH_CHECK_TOKEN: process.env.HEALTH_CHECK_TOKEN || 'health-check',

    // Module-specific Configuration
    OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
   VIRUSTOTAL_API_KEY: process.env.VIRUSTOTAL_API_KEY,

    // Merge environment-specific configuration
    ...envConfig
};

/**
 * Validate required configuration
 */
function validateConfig() {
    const required = ['TELEGRAM_BOT_TOKEN'];
    const missing = required.filter(key => !config[key]);
    
    if (missing.length > 0) {
        throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }

    // Validate deployment mode
    if (!['webhook', 'polling'].includes(config.DEPLOYMENT_MODE)) {
        throw new Error('DEPLOYMENT_MODE must be either "webhook" or "polling"');
    }

    // Validate webhook configuration
    if (config.DEPLOYMENT_MODE === 'webhook' && !config.WEBHOOK_URL) {
        throw new Error('WEBHOOK_URL is required when using webhook mode');
    }

    return true;
}

/**
 * Get configuration value with fallback
 * @param {string} key - Configuration key
 * @param {*} defaultValue - Default value if key doesn't exist
 * @returns {*} Configuration value
 */
function get(key, defaultValue = null) {
    return config[key] !== undefined ? config[key] : defaultValue;
}

/**
 * Check if a feature is enabled
 * @param {string} feature - Feature name
 * @returns {boolean} Whether the feature is enabled
 */
function isFeatureEnabled(feature) {
    const key = `ENABLE_${feature.toUpperCase()}`;
    return parseBoolean(config[key]);
}

/**
 * Get admin user IDs
 * @returns {Array<string>} Array of admin user IDs
 */
function getAdminUserIds() {
    return config.ADMIN_USER_IDS;
}

/**
 * Check if user is admin
 * @param {string|number} userId - User ID to check
 * @returns {boolean} Whether the user is an admin
 */
function isAdmin(userId) {
    return config.ADMIN_USER_IDS.includes(String(userId));
}

module.exports = {
    config,
    validateConfig,
    get,
    isFeatureEnabled,
    getAdminUserIds,
    isAdmin,
    parseArray,
    parseBoolean,
    parseInteger
};

