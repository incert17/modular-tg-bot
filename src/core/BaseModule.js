/**
 * Base Module Class
 * 
 * Base class for all bot modules. Provides common functionality
 * and helper methods for module development.
 * 
 * @module core/BaseModule
 */

const logger = require('../utils/logger');
const { validateArgs, validateUserInput } = require('../utils/validators');

/**
 * Base Module class
 * All bot modules should extend this class
 */
class BaseModule {
    /**
     * Create a new BaseModule instance
     * @param {Bot} bot - Bot instance
     */
    constructor(bot) {
        this.bot = bot;
        this.name = 'BaseModule';
        this.version = '1.0.0';
        this.description = 'Base module class';
        this.commands = [];
        this.enabled = true;
        this.initTime = null;
    }

    /**
     * Initialize the module
     * Override this method in child classes for custom initialization
     */
    async init() {
        this.initTime = new Date();
        logger.logModuleActivity(this.name, 'Module initialized');
    }

    /**
     * Cleanup the module
     * Override this method in child classes for custom cleanup
     */
    async cleanup() {
        logger.logModuleActivity(this.name, 'Module cleaned up');
    }

    /**
     * Register a command
     * @param {string} command - Command name (without /)
     * @param {Function} handler - Command handler function
     * @param {Object} options - Command options
     */
    registerCommand(command, handler, options = {}) {
        const commandOptions = {
            ...options,
            module: this.name
        };

        // Bind handler to this module instance
        const boundHandler = handler.bind(this);

        // Register with bot
        this.bot.registerCommand(command, boundHandler, commandOptions);

        // Track command in module
        this.commands.push({
            command,
            description: options.description || 'No description',
            usage: options.usage || `/${command}`,
            permission: options.permission || 'public'
        });

        logger.logModuleActivity(this.name, 'Command registered', { command });
    }

    /**
     * Register multiple commands
     * @param {Array} commands - Array of command definitions
     */
    registerCommands(commands) {
        for (const cmd of commands) {
            this.registerCommand(cmd.command, cmd.handler, cmd.options || {});
        }
    }

    /**
     * Send a message with error handling
     * @param {number} chatId - Chat ID
     * @param {string} text - Message text
     * @param {Object} options - Send options
     * @returns {Promise<Object|null>} Sent message or null on error
     */
    async sendMessage(chatId, text, options = {}) {
        try {
            return await this.bot.sendMessage(chatId, text, options);
        } catch (error) {
            logger.logError(error, { 
                context: 'Module send message',
                module: this.name,
                chatId
            });
            return null;
        }
    }

    /**
     * Send a photo with error handling
     * @param {number} chatId - Chat ID
     * @param {string|Buffer} photo - Photo
     * @param {Object} options - Send options
     * @returns {Promise<Object|null>} Sent message or null on error
     */
    async sendPhoto(chatId, photo, options = {}) {
        try {
            return await this.bot.sendPhoto(chatId, photo, options);
        } catch (error) {
            logger.logError(error, { 
                context: 'Module send photo',
                module: this.name,
                chatId
            });
            return null;
        }
    }

    /**
     * Send a document with error handling
     * @param {number} chatId - Chat ID
     * @param {string|Buffer} document - Document
     * @param {Object} options - Send options
     * @returns {Promise<Object|null>} Sent message or null on error
     */
    async sendDocument(chatId, document, options = {}) {
        try {
            return await this.bot.sendDocument(chatId, document, options);
        } catch (error) {
            logger.logError(error, { 
                context: 'Module send document',
                module: this.name,
                chatId
            });
            return null;
        }
    }

    /**
     * Reply to a message
     * @param {Object} msg - Original message
     * @param {string} text - Reply text
     * @param {Object} options - Send options
     * @returns {Promise<Object|null>} Sent message or null on error
     */
    async reply(msg, text, options = {}) {
        return await this.sendMessage(msg.chat.id, text, {
            reply_to_message_id: msg.message_id,
            ...options
        });
    }

    /**
     * Validate command arguments
     * @param {Array} args - Command arguments
     * @param {Object} schema - Validation schema
     * @returns {Object} Validation result
     */
    validateArgs(args, schema) {
        return validateArgs(args, schema);
    }

    /**
     * Validate user input
     * @param {string} input - User input
     * @returns {Object} Validation result
     */
    validateInput(input) {
        return validateUserInput(input);
    }

    /**
     * Log module activity
     * @param {string} action - Action performed
     * @param {Object} data - Additional data
     */
    log(action, data = {}) {
        logger.logModuleActivity(this.name, action, data);
    }

    /**
     * Log module error
     * @param {Error} error - Error object
     * @param {Object} context - Error context
     */
    logError(error, context = {}) {
        logger.logError(error, {
            context: 'Module error',
            module: this.name,
            ...context
        });
    }

    /**
     * Create inline keyboard
     * @param {Array} buttons - Button configuration
     * @returns {Object} Inline keyboard markup
     */
    createInlineKeyboard(buttons) {
        return {
            reply_markup: {
                inline_keyboard: buttons
            }
        };
    }

    /**
     * Create reply keyboard
     * @param {Array} buttons - Button configuration
     * @param {Object} options - Keyboard options
     * @returns {Object} Reply keyboard markup
     */
    createReplyKeyboard(buttons, options = {}) {
        return {
            reply_markup: {
                keyboard: buttons,
                resize_keyboard: true,
                one_time_keyboard: false,
                ...options
            }
        };
    }

    /**
     * Remove keyboard
     * @returns {Object} Remove keyboard markup
     */
    removeKeyboard() {
        return {
            reply_markup: {
                remove_keyboard: true
            }
        };
    }

    /**
     * Format text with HTML
     * @param {string} text - Text to format
     * @param {string} format - Format type (bold, italic, code, pre)
     * @returns {string} Formatted text
     */
    formatText(text, format) {
        switch (format) {
            case 'bold':
                return `<b>${text}</b>`;
            case 'italic':
                return `<i>${text}</i>`;
            case 'code':
                return `<code>${text}</code>`;
            case 'pre':
                return `<pre>${text}</pre>`;
            case 'underline':
                return `<u>${text}</u>`;
            case 'strikethrough':
                return `<s>${text}</s>`;
            default:
                return text;
        }
    }

    /**
     * Escape HTML characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    /**
     * Get user mention
     * @param {Object} user - User object
     * @returns {string} User mention
     */
    getUserMention(user) {
        const name = user.first_name + (user.last_name ? ` ${user.last_name}` : '');
        return `<a href="tg://user?id=${user.id}">${this.escapeHtml(name)}</a>`;
    }

    /**
     * Format duration
     * @param {number} milliseconds - Duration in milliseconds
     * @returns {string} Formatted duration
     */
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Format file size
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted file size
     */
    formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    /**
     * Sleep for specified duration
     * @param {number} ms - Duration in milliseconds
     * @returns {Promise} Promise that resolves after the duration
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get module information
     * @returns {Object} Module information
     */
    getInfo() {
        return {
            name: this.name,
            version: this.version,
            description: this.description,
            commands: this.commands,
            enabled: this.enabled,
            initTime: this.initTime
        };
    }

    /**
     * Handle callback query (override in child classes)
     * @param {Object} query - Callback query object
     */
    onCallbackQuery(query) {
        // Override in child classes
    }

    /**
     * Handle generic events (override in child classes)
     * @param {string} event - Event name
     * @param {...any} args - Event arguments
     */
    onEvent(event, ...args) {
        // Override in child classes
    }
}

module.exports = BaseModule;

