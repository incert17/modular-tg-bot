	const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const logger = require('../utils/logger');
const { parseCommand, hasPermission, checkRateLimit } = require('../utils/validators');
const { config } = require('../utils/config');
const ModuleLoader = require('./ModuleLoader');

/**
 * Main Bot class with enhanced callback queries, inline keyboards, and message editing
 */
class Bot {
    /**
     * Create a new Bot instance
     * @param {string} token - Telegram bot token
     * @param {Object} options - Bot options
     */
    constructor(token, options = {}) {
        this.token = token;
        this.options = {
            polling: false,
            webhook: false,
            ...options
        };

        // Initialize Telegram bot (without polling/webhook yet)
        this.bot = new TelegramBot(token, { polling: false });
        
        // Initialize module loader
        this.moduleLoader = new ModuleLoader(this);
        
        // Command registry
        this.commands = new Map();
        this.middlewares = [];
        
        // Callback query handlers
        this.callbackHandlers = new Map();
        this.callbackRoutes = new Map();
        
        // Message edit handlers
        this.editHandlers = [];
        
        // Inline query handlers
        this.inlineQueryHandlers = [];
        
        // Bot state
        this.isRunning = false;
        this.startTime = null;
        
        // Statistics
        this.stats = {
            messagesProcessed: 0,
            commandsExecuted: 0,
            callbacksProcessed: 0,
            messagesEdited: 0,
            inlineQueriesProcessed: 0,
            errorsOccurred: 0,
            uptime: 0
        };

        // Setup error handlers
        this.setupErrorHandlers();
        
        logger.logBotActivity('Bot instance created', {
            polling: this.options.polling,
            webhook: this.options.webhook
        });
    }

    /**
     * Setup error handlers for the bot
     */
    setupErrorHandlers() {
        this.bot.on('error', (error) => {
            logger.logError(error, { context: 'Telegram Bot API' });
            this.stats.errorsOccurred++;
        });

        this.bot.on('polling_error', (error) => {
            logger.logError(error, { context: 'Telegram Polling' });
            this.stats.errorsOccurred++;
        });

        this.bot.on('webhook_error', (error) => {
            logger.logError(error, { context: 'Telegram Webhook' });
            this.stats.errorsOccurred++;
        });
    }

    /**
     * Load all modules from the modules directory
     */
    async loadModules() {
        try {
            logger.logBotActivity('Loading modules...');
            await this.moduleLoader.loadModules();
            logger.logBotActivity('Modules loaded successfully', {
                moduleCount: this.moduleLoader.getLoadedModules().length
            });
        } catch (error) {
            logger.logError(error, { context: 'Module loading' });
            throw error;
        }
    }

    /**
     * Register a command handler
     * @param {string} command - Command name (without /)
     * @param {Function} handler - Command handler function
     * @param {Object} options - Command options
     */
    registerCommand(command, handler, options = {}) {
        const commandInfo = {
            command: command.toLowerCase(),
            handler,
            description: options.description || 'No description available',
            usage: options.usage || `/${command}`,
            permission: options.permission || 'public',
            module: options.module || 'unknown',
            hidden: options.hidden || false,
            ...options
        };

        this.commands.set(command.toLowerCase(), commandInfo);
        
        logger.logModuleActivity(commandInfo.module, 'Command registered', {
            command: command.toLowerCase(),
            permission: commandInfo.permission
        });
    }

    /**
     * Register callback query handler
     * @param {string|RegExp} pattern - Callback data pattern to match
     * @param {Function} handler - Callback handler function
     * @param {Object} options - Handler options
     */
    registerCallbackHandler(pattern, handler, options = {}) {
        const handlerInfo = {
            pattern,
            handler,
            module: options.module || 'unknown',
            permission: options.permission || 'public',
            ...options
        };

        if (typeof pattern === 'string') {
            this.callbackRoutes.set(pattern, handlerInfo);
        } else {
            this.callbackHandlers.set(pattern, handlerInfo);
        }
        
        logger.logModuleActivity(handlerInfo.module, 'Callback handler registered', {
            pattern: pattern.toString(),
            permission: handlerInfo.permission
        });
    }

    /**
     * Register inline query handler
     * @param {string|RegExp} pattern - Query pattern to match
     * @param {Function} handler - Query handler function
     * @param {Object} options - Handler options
     */
    registerInlineQueryHandler(pattern, handler, options = {}) {
        const handlerInfo = {
            pattern,
            handler,
            module: options.module || 'unknown',
            ...options
        };

        this.inlineQueryHandlers.push(handlerInfo);
        
        logger.logModuleActivity(handlerInfo.module, 'Inline query handler registered', {
            pattern: pattern.toString()
        });
    }

    /**
     * Register message edit handler
     * @param {Function} handler - Edit handler function
     * @param {Object} options - Handler options
     */
    registerEditHandler(handler, options = {}) {
        const handlerInfo = {
            handler,
            module: options.module || 'unknown',
            ...options
        };

        this.editHandlers.push(handlerInfo);
        
        logger.logModuleActivity(handlerInfo.module, 'Edit handler registered');
    }

    /**
     * Register middleware
     * @param {Function} middleware - Middleware function
     */
    registerMiddleware(middleware) {
        this.middlewares.push(middleware);
        logger.logBotActivity('Middleware registered');
    }

    /**
     * Start the bot
     */
    async start() {
        if (this.isRunning) {
            logger.warn('Bot is already running');
            return;
        }

        try {
            // Setup message handler
            this.bot.on('message', (msg) => this.handleMessage(msg));
            
            // Setup callback query handler
            this.bot.on('callback_query', (query) => this.handleCallbackQuery(query));
            
            // Setup edited message handler
            this.bot.on('edited_message', (msg) => this.handleEditedMessage(msg));
            
            // Setup inline query handler
            this.bot.on('inline_query', (query) => this.handleInlineQuery(query));

            // Start polling if enabled
            if (this.options.polling) {
                await this.bot.startPolling();
                logger.logBotActivity('Polling started');
            }

            this.isRunning = true;
            this.startTime = new Date();
            
            logger.logBotActivity('Bot started successfully');

        } catch (error) {
            logger.logError(error, { context: 'Bot startup' });
            throw error;
        }
    }

    /**
     * Stop the bot
     */
    async stop() {
        if (!this.isRunning) {
            logger.warn('Bot is not running');
            return;
        }

        try {
            if (this.options.polling) {
                await this.bot.stopPolling();
                logger.logBotActivity('Polling stopped');
            }

            this.isRunning = false;
            logger.logBotActivity('Bot stopped successfully');

        } catch (error) {
            logger.logError(error, { context: 'Bot shutdown' });
            throw error;
        }
    }

    /**
     * Handle incoming messages
     * @param {Object} msg - Telegram message object
     */
    async handleMessage(msg) {
        try {
            this.stats.messagesProcessed++;
            
            // Log user interaction
            logger.logUserInteraction(msg, 'Message received');

            // Run middlewares
            for (const middleware of this.middlewares) {
                try {
                    const result = await middleware(msg, this);
                    if (result === false) {
                        // Middleware blocked the message
                        return;
                    }
                } catch (error) {
                    logger.logError(error, { 
                        context: 'Middleware execution',
                        userId: msg.from.id,
                        messageId: msg.message_id
                    });
                }
            }

            // Check if message contains a command
            if (msg.text && msg.text.startsWith('/')) {
                await this.handleCommand(msg);
            }

        } catch (error) {
            logger.logError(error, { 
                context: 'Message handling',
                userId: msg.from?.id,
                messageId: msg.message_id
            });
            this.stats.errorsOccurred++;
            
            // Send error message to user
            await this.sendErrorMessage(msg.chat.id, 'An error occurred while processing your message.');
        }
    }

    /**
     * Handle command messages
     * @param {Object} msg - Telegram message object
     */
    async handleCommand(msg) {
        const startTime = Date.now();
        
        try {
            // Parse command
            const parsed = parseCommand(msg.text);
            if (!parsed) {
                return;
            }

            const { command, args } = parsed;
            
            // Check if command exists
            const commandInfo = this.commands.get(command.replace('/', ''));
            if (!commandInfo) {
                await this.sendMessage(msg.chat.id, `Unknown command: ${command}`);
                return;
            }

            // Check permissions
            if (!hasPermission(msg, commandInfo.permission)) {
                await this.sendMessage(msg.chat.id, 'You don\'t have permission to use this command.');
                return;
            }

            // Check rate limiting
            const rateLimit = checkRateLimit(msg.from.id, command, config.RATE_LIMIT);
            if (!rateLimit.allowed) {
                const resetTime = new Date(rateLimit.resetTime);
                await this.sendMessage(msg.chat.id, 
                    `Rate limit exceeded. Try again after ${resetTime.toLocaleTimeString()}.`);
                return;
            }

            // Execute command
            const executionTime = Date.now();
            await commandInfo.handler(msg, args, this);
            
            this.stats.commandsExecuted++;
            
            // Log command execution
            logger.logCommand(command, msg, {
                success: true,
                executionTime: Date.now() - executionTime
            });

        } catch (error) {
            logger.logError(error, { 
                context: 'Command execution',
                command: msg.text,
                userId: msg.from.id
            });
            
            logger.logCommand(msg.text, msg, {
                success: false,
                executionTime: Date.now() - startTime,
                error: error.message
            });
            
            this.stats.errorsOccurred++;
            
            // Send error message to user
            await this.sendErrorMessage(msg.chat.id, 'An error occurred while executing the command.');
        }
    }

    /**
     * Handle callback queries (inline keyboard buttons)
     * @param {Object} query - Telegram callback query object
     */
    async handleCallbackQuery(query) {
        try {
            this.stats.callbacksProcessed++;
            
            logger.logUserInteraction(query.message, 'Callback query received', {
                data: query.data,
                userId: query.from.id
            });

            // Parse callback data
            const callbackData = this.parseCallbackData(query.data);
            
            // Check for exact route match first
            if (this.callbackRoutes.has(query.data)) {
                const handlerInfo = this.callbackRoutes.get(query.data);
                
                // Check permissions
                if (!hasPermission(query.message, handlerInfo.permission)) {
                    await this.answerCallbackQuery(query.id, 'You don\'t have permission to use this feature.', true);
                    return;
                }
                
                await handlerInfo.handler(query, callbackData, this);
                return;
            }

            // Check pattern-based handlers
            for (const [pattern, handlerInfo] of this.callbackHandlers) {
                if (pattern.test(query.data)) {
                    // Check permissions
                    if (!hasPermission(query.message, handlerInfo.permission)) {
                        await this.answerCallbackQuery(query.id, 'You don\'t have permission to use this feature.', true);
                        return;
                    }
                    
                    await handlerInfo.handler(query, callbackData, this);
                    return;
                }
            }

            // Default: answer callback query to remove loading state
            await this.answerCallbackQuery(query.id);
            
            // Emit callback query event for modules to handle
            this.emit('callback_query', query, callbackData);
            
        } catch (error) {
            logger.logError(error, { 
                context: 'Callback query handling',
                queryId: query.id,
                data: query.data,
                userId: query.from.id
            });
            this.stats.errorsOccurred++;
            
            // Answer with error
            await this.answerCallbackQuery(query.id, 'An error occurred while processing your request.', true);
        }
    }

    /**
     * Handle edited messages
     * @param {Object} msg - Telegram edited message object
     */
    async handleEditedMessage(msg) {
        try {
            this.stats.messagesEdited++;
            
            logger.logUserInteraction(msg, 'Message edited');

            // Run edit handlers
            for (const handlerInfo of this.editHandlers) {
                try {
                    await handlerInfo.handler(msg, this);
                } catch (error) {
                    logger.logError(error, { 
                        context: 'Edit handler execution',
                        module: handlerInfo.module,
                        userId: msg.from.id,
                        messageId: msg.message_id
                    });
                }
            }

            // Emit edit event for modules
            this.emit('edited_message', msg);
            
        } catch (error) {
            logger.logError(error, { 
                context: 'Edited message handling',
                userId: msg.from?.id,
                messageId: msg.message_id
            });
            this.stats.errorsOccurred++;
        }
    }

    /**
     * Handle inline queries
     * @param {Object} query - Telegram inline query object
     */
    async handleInlineQuery(query) {
        try {
            this.stats.inlineQueriesProcessed++;
            
            logger.logUserInteraction(null, 'Inline query received', {
                query: query.query,
                userId: query.from.id
            });

            // Find matching handler
            for (const handlerInfo of this.inlineQueryHandlers) {
                if (typeof handlerInfo.pattern === 'string') {
                    if (query.query.startsWith(handlerInfo.pattern)) {
                        await handlerInfo.handler(query, this);
                        return;
                    }
                } else if (handlerInfo.pattern.test(query.query)) {
                    await handlerInfo.handler(query, this);
                    return;
                }
            }

            // Default: empty results
            await this.answerInlineQuery(query.id, []);
            
        } catch (error) {
            logger.logError(error, { 
                context: 'Inline query handling',
                queryId: query.id,
                userId: query.from.id
            });
            this.stats.errorsOccurred++;
        }
    }

    /**
     * Parse callback data
     * @param {string} data - Callback data string
     * @returns {Object} Parsed callback data
     */
    parseCallbackData(data) {
        try {
            // Try to parse as JSON first
            return JSON.parse(data);
        } catch {
            // Fallback to simple string parsing
            const parts = data.split(':');
            return {
                action: parts[0] || data,
                params: parts.slice(1),
                raw: data
            };
        }
    }

    // === INLINE KEYBOARD BUILDER FUNCTIONS ===

    /**
     * Create an inline keyboard
     * @param {Array} buttons - Array of button rows
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
     * Create an inline button
     * @param {string} text - Button text
     * @param {string} callbackData - Callback data
     * @param {Object} options - Additional options
     * @returns {Object} Inline button
     */
    createInlineButton(text, callbackData, options = {}) {
        const button = { text };
        
        if (options.url) {
            button.url = options.url;
        } else {
            button.callback_data = callbackData;
        }
        
        return button;
    }

    /**
     * Create a URL button
     * @param {string} text - Button text
     * @param {string} url - URL to open
     * @returns {Object} URL button
     */
    createUrlButton(text, url) {
        return { text, url };
    }

    /**
     * Create pagination keyboard
     * @param {number} currentPage - Current page number
     * @param {number} totalPages - Total number of pages
     * @param {string} prefix - Callback data prefix
     * @returns {Object} Pagination keyboard
     */
    createPaginationKeyboard(currentPage, totalPages, prefix = 'page') {
        const buttons = [];
        const row = [];
        
        if (currentPage > 1) {
            row.push(this.createInlineButton('⬅️ Previous', `${prefix}:${currentPage - 1}`));
        }
        
        row.push(this.createInlineButton(`${currentPage}/${totalPages}`, `${prefix}:current`));
        
        if (currentPage < totalPages) {
            row.push(this.createInlineButton('Next ➡️', `${prefix}:${currentPage + 1}`));
        }
        
        buttons.push(row);
        return this.createInlineKeyboard(buttons);
    }

    // === MESSAGE EDITING FUNCTIONS ===

    /**
     * Edit message text
     * @param {number} chatId - Chat ID
     * @param {number} messageId - Message ID
     * @param {string} text - New text
     * @param {Object} options - Edit options
     * @returns {Promise<Object>} Edited message
     */
    async editMessageText(chatId, messageId, text, options = {}) {
        try {
            return await this.bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                ...options
            });
        } catch (error) {
            logger.logError(error, { 
                context: 'Edit message text',
                chatId,
                messageId,
                textLength: text.length
            });
            throw error;
        }
    }

    /**
     * Edit message reply markup
     * @param {number} chatId - Chat ID
     * @param {number} messageId - Message ID
     * @param {Object} replyMarkup - New reply markup
     * @returns {Promise<Object>} Edited message
     */
    async editMessageReplyMarkup(chatId, messageId, replyMarkup) {
        try {
            return await this.bot.editMessageReplyMarkup(replyMarkup, {
                chat_id: chatId,
                message_id: messageId
            });
        } catch (error) {
            logger.logError(error, { 
                context: 'Edit message reply markup',
                chatId,
                messageId
            });
            throw error;
        }
    }

    /**
     * Edit message media
     * @param {number} chatId - Chat ID
     * @param {number} messageId - Message ID
     * @param {Object} media - New media
     * @param {Object} options - Edit options
     * @returns {Promise<Object>} Edited message
     */
    async editMessageMedia(chatId, messageId, media, options = {}) {
        try {
            return await this.bot.editMessageMedia(media, {
                chat_id: chatId,
                message_id: messageId,
                ...options
            });
        } catch (error) {
            logger.logError(error, { 
                context: 'Edit message media',
                chatId,
                messageId
            });
            throw error;
        }
    }

    /**
     * Delete message
     * @param {number} chatId - Chat ID
     * @param {number} messageId - Message ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteMessage(chatId, messageId) {
        try {
            return await this.bot.deleteMessage(chatId, messageId);
        } catch (error) {
            logger.logError(error, { 
                context: 'Delete message',
                chatId,
                messageId
            });
            throw error;
        }
    }

    // === CALLBACK QUERY FUNCTIONS ===

    /**
     * Answer callback query
     * @param {string} queryId - Callback query ID
     * @param {string} text - Optional text to show
     * @param {boolean} showAlert - Show as alert or notification
     * @param {Object} options - Additional options
     * @returns {Promise<boolean>} Success status
     */
    async answerCallbackQuery(queryId, text = '', showAlert = false, options = {}) {
        try {
            return await this.bot.answerCallbackQuery(queryId, {
                text,
                show_alert: showAlert,
                ...options
            });
        } catch (error) {
            logger.logError(error, { 
                context: 'Answer callback query',
                queryId
            });
            throw error;
        }
    }

    /**
     * Answer inline query
     * @param {string} queryId - Inline query ID
     * @param {Array} results - Query results
     * @param {Object} options - Additional options
     * @returns {Promise<boolean>} Success status
     */
    async answerInlineQuery(queryId, results, options = {}) {
        try {
            return await this.bot.answerInlineQuery(queryId, results, {
                cache_time: 300,
                ...options
            });
        } catch (error) {
            logger.logError(error, { 
                context: 'Answer inline query',
                queryId,
                resultsCount: results.length
            });
            throw error;
        }
    }

    // === EXISTING METHODS (keeping them as they were) ===

    /**
     * Send a message
     * @param {number} chatId - Chat ID
     * @param {string} text - Message text
     * @param {Object} options - Send options
     * @returns {Promise<Object>} Sent message
     */
    async sendMessage(chatId, text, options = {}) {
        try {
            return await this.bot.sendMessage(chatId, text, {
                parse_mode: 'HTML',
                ...options
            });
        } catch (error) {
            logger.logError(error, { 
                context: 'Send message',
                chatId,
                textLength: text.length
            });
            throw error;
        }
    }

    /**
     * Send an error message
     * @param {number} chatId - Chat ID
     * @param {string} message - Error message
     */
    async sendErrorMessage(chatId, message) {
        try {
            await this.sendMessage(chatId, `❌ ${message}`);
        } catch (error) {
            logger.logError(error, { 
                context: 'Send error message',
                chatId
            });
        }
    }

    /**
     * Send a photo
     * @param {number} chatId - Chat ID
     * @param {string|Buffer} photo - Photo file path, URL, or Buffer
     * @param {Object} options - Send options
     * @returns {Promise<Object>} Sent message
     */
    async sendPhoto(chatId, photo, options = {}) {
        try {
            return await this.bot.sendPhoto(chatId, photo, options);
        } catch (error) {
            logger.logError(error, { 
                context: 'Send photo',
                chatId
            });
            throw error;
        }
    }

    /**
     * Send a document
     * @param {number} chatId - Chat ID
     * @param {string|Buffer} document - Document file path, URL, or Buffer
     * @param {Object} options - Send options
     * @returns {Promise<Object>} Sent message
     */
    async sendDocument(chatId, document, options = {}) {
        try {
            return await this.bot.sendDocument(chatId, document, options);
        } catch (error) {
            logger.logError(error, { 
                context: 'Send document',
                chatId
            });
            throw error;
        }
    }

    /**
     * Get bot information
     * @returns {Promise<Object>} Bot information
     */
    async getBotInfo() {
        try {
            return await this.bot.getMe();
        } catch (error) {
            logger.logError(error, { context: 'Get bot info' });
            throw error;
        }
    }

    /**
     * Get bot statistics
     * @returns {Object} Bot statistics
     */
    getStats() {
        const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;
        
        return {
            ...this.stats,
            uptime,
            isRunning: this.isRunning,
            startTime: this.startTime,
            loadedModules: this.moduleLoader.getLoadedModules().length,
            registeredCommands: this.commands.size,
            registeredCallbackHandlers: this.callbackRoutes.size + this.callbackHandlers.size,
            registeredEditHandlers: this.editHandlers.length,
            registeredInlineQueryHandlers: this.inlineQueryHandlers.length
        };
    }

    /**
     * Get registered commands
     * @param {boolean} includeHidden - Include hidden commands
     * @returns {Array} Array of command information
     */
    getCommands(includeHidden = false) {
        const commands = Array.from(this.commands.values());
        return includeHidden ? commands : commands.filter(cmd => !cmd.hidden);
    }

    /**
     * Get loaded modules
     * @returns {Array} Array of loaded modules
     */
    getModules() {
        return this.moduleLoader.getLoadedModules();
    }

    /**
     * Process webhook update
     * @param {Object} update - Telegram update object
     */
    async processUpdate(update) {
        try {
            await this.bot.processUpdate(update);
        } catch (error) {
            logger.logError(error, { 
                context: 'Process webhook update',
                updateId: update.update_id
            });
            this.stats.errorsOccurred++;
        }
    }

    /**
     * Set webhook
     * @param {string} url - Webhook URL
     * @param {Object} options - Webhook options
     */
    async setWebhook(url, options = {}) {
        try {
            await this.bot.setWebHook(url, options);
            logger.logBotActivity('Webhook set', { url });
        } catch (error) {
            logger.logError(error, { context: 'Set webhook', url });
            throw error;
        }
    }

    /**
     * Delete webhook
     */
    async deleteWebhook() {
        try {
            await this.bot.deleteWebHook();
            logger.logBotActivity('Webhook deleted');
        } catch (error) {
            logger.logError(error, { context: 'Delete webhook' });
            throw error;
        }
    }

    /**
     * Emit event to modules
     * @param {string} event - Event name
     * @param {...any} args - Event arguments
     */
    emit(event, ...args) {
        this.moduleLoader.emit(event, ...args);
    }
}

module.exports = Bot;

