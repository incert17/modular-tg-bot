/**
 * Help Module
 *
 * Provides interactive help system with inline keyboard navigation,
 * module browsing, and detailed command information.
 * Fully compatible with BaseModule system.
 *
 * @module modules/help
 */

const BaseModule = require('../core/BaseModule');
const { config } = require('../utils/config');

/**
 * Help Module class
 */
class HelpModule extends BaseModule {
    constructor(bot) {
        super(bot);
        this.name = 'Help';
        this.version = '1.0.0';
        this.description = 'Interactive help system for bot commands';
    }

    /**
     * Initialize the module
     */
    async init() {
        await super.init();
        
        // Register the help command using BaseModule's method
        this.registerCommands([
            {
                command: 'help',
                handler: this.handleHelp,
                options: {
                    description: 'Show available commands with interactive navigation',
                    usage: '/help [command]',
                    permission: 'public'
                }
            }
        ]);

        // Register callback handlers for help navigation
        this.bot.registerCallbackHandler(/^help:page:\d+$/, this.handlePageCallback.bind(this), {
            module: this.name,
            permission: 'public'
        });

        this.bot.registerCallbackHandler(/^help:module:.+$/, this.handleModuleCallback.bind(this), {
            module: this.name,
            permission: 'public'
        });
        
        this.log('Help module initialized with callback handlers');
    }

    /**
     * Get all available commands with proper filtering
     * @param {number} userId - User ID for permission checking
     * @returns {Array} Array of available commands
     */
    _getAvailableCommands(userId) {
        const isAdmin = config.ADMIN_USER_IDS && config.ADMIN_USER_IDS.includes(String(userId));
        
        // Get commands from bot's registry (preferred method)
        let commands = [];
        
        try {
            commands = this.bot.getCommands(true); // Include hidden for filtering
        } catch (error) {
            this.logError(error, { context: 'Getting commands from bot' });
            commands = [];
        }
        
        // Filter commands based on permissions and visibility
        const filteredCommands = commands.filter(cmd => {
            // Skip hidden commands
            if (cmd.hidden) return false;
            
            // Check permissions
            const permission = cmd.permission || 'public';
            if (permission === 'admin' && !isAdmin) return false;
            
            return true;
        });

        this.log('Commands retrieved and filtered', {
            totalCommands: commands.length,
            filteredCommands: filteredCommands.length,
            isAdmin,
            userId
        });

        return filteredCommands;
    }

    /**
     * Handle page navigation callbacks
     * @param {Object} query - Telegram callback query object
     * @param {Object} data - Parsed callback data
     */
    async handlePageCallback(query, data) {
        try {
            // Parse page number from callback data
            const matches = query.data.match(/^help:page:(\d+)$/);
            const page = matches ? parseInt(matches[1], 10) : 0;
            
            await this._sendHelpMenu(query.message.chat.id, query.message.message_id, query.from.id, page);
            await this.bot.answerCallbackQuery(query.id);
            
            this.log('Page callback handled', { 
                userId: query.from.id, 
                page: page,
                callbackData: query.data 
            });
        } catch (error) {
            this.logError(error, { 
                context: 'Page callback handling',
                callbackData: query.data,
                userId: query.from.id 
            });
            await this.bot.answerCallbackQuery(query.id, 'An error occurred', true);
        }
    }

    /**
     * Handle module navigation callbacks
     * @param {Object} query - Telegram callback query object
     * @param {Object} data - Parsed callback data
     */
    async handleModuleCallback(query, data) {
        try {
            // Parse module name from callback data
            const matches = query.data.match(/^help:module:(.+)$/);
            const moduleName = matches ? matches[1] : '';
            
            await this._sendModuleHelp(query.message.chat.id, query.message.message_id, query.from.id, moduleName);
            await this.bot.answerCallbackQuery(query.id);
            
            this.log('Module callback handled', { 
                userId: query.from.id, 
                module: moduleName,
                callbackData: query.data 
            });
        } catch (error) {
            this.logError(error, { 
                context: 'Module callback handling',
                callbackData: query.data,
                userId: query.from.id 
            });
            await this.bot.answerCallbackQuery(query.id, 'An error occurred', true);
        }
    }

    /**
     * Handle /help command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handleHelp(msg, args) {
        try {
            if (args.length > 0) {
                await this._sendSpecificCommandHelp(msg, args);
                return;
            }
            
            await this._sendHelpMenu(msg.chat.id, null, msg.from.id, 0);
            
            this.log('Help command executed', {
                userId: msg.from.id,
                specificCommand: args[0] || null
            });
        } catch (error) {
            this.logError(error, { command: 'help', userId: msg.from.id });
            await this.reply(msg, '❌ An error occurred while showing help.');
        }
    }

    /**
     * Send interactive help menu
     * @param {number} chatId - Chat ID
     * @param {number} messageId - Message ID to edit (null for new message)
     * @param {number} userId - User ID
     * @param {number} page - Page number
     */
    async _sendHelpMenu(chatId, messageId, userId, page) {
        this.log('Building help menu', { chatId, messageId, userId, page });
        
        const commands = this._getAvailableCommands(userId);
        
        // Group commands by module
        const moduleGroups = {};
        commands.forEach(cmd => {
            const moduleName = cmd.module || 'Unknown';
            if (!moduleGroups[moduleName]) {
                moduleGroups[moduleName] = [];
            }
            moduleGroups[moduleName].push(cmd);
        });

        const modules = Object.keys(moduleGroups).sort();
        
        this.log('Module grouping complete', { 
            totalModules: modules.length,
            modules: modules,
            commandsPerModule: Object.fromEntries(
                Object.entries(moduleGroups).map(([mod, cmds]) => [mod, cmds.length])
            )
        });

        const MODULES_PER_PAGE = 6;
        const totalPages = Math.ceil(modules.length / MODULES_PER_PAGE);
        const startIndex = page * MODULES_PER_PAGE;
        const modulesForPage = modules.slice(startIndex, startIndex + MODULES_PER_PAGE);

        this.log('Pagination info', { 
            page: page + 1, 
            totalPages, 
            modulesThisPage: modulesForPage.length,
            modules: modulesForPage 
        });

        // Handle case where no modules are available
        if (modules.length === 0) {
            const noModulesText = `📋 <b>Help System</b>\n\nNo commands are currently available.\n\nPlease contact an administrator if this seems incorrect.`;
            const keyboard = this.bot.createInlineKeyboard([]);
            
            if (messageId) {
                await this.bot.editMessageText(chatId, messageId, noModulesText, {
                    ...keyboard,
                    parse_mode: 'HTML'
                });
            } else {
                await this.bot.sendMessage(chatId, noModulesText, {
                    ...keyboard,
                    parse_mode: 'HTML'
                });
            }
            return;
        }

        // Build keyboard using Bot.js helper methods
        const keyboardRows = [];
        let currentRow = [];

        // Create module buttons (2 per row)
        modulesForPage.forEach(moduleName => {
            const commandCount = moduleGroups[moduleName].length;
            const buttonText = `${moduleName} (${commandCount})`;
            currentRow.push(this.bot.createInlineButton(buttonText, `help:module:${moduleName}`));
            
            if (currentRow.length === 2) {
                keyboardRows.push(currentRow);
                currentRow = [];
            }
        });
        if (currentRow.length > 0) {
            keyboardRows.push(currentRow);
        }

        // Navigation buttons
        const navRow = [];
        if (page > 0) {
            navRow.push(this.bot.createInlineButton('◀ Previous', `help:page:${page - 1}`));
        }
        if (page < totalPages - 1) {
            navRow.push(this.bot.createInlineButton('Next ▶', `help:page:${page + 1}`));
        }
        if (navRow.length > 0) {
            keyboardRows.push(navRow);
        }

        const totalCommands = commands.length;
        const text = `📋 <b>Available Modules</b> (Page ${page + 1}/${totalPages})\n\n` +
                    `📊 Total commands: ${totalCommands}\n\n` +
                    `Select a module to see its commands:`;
                    
        const footer = `\n\n💡 Use <code>/help &lt;command&gt;</code> for detailed information about a specific command.`;
        
        const keyboard = this.bot.createInlineKeyboard(keyboardRows);

        this.log('Sending help menu', { 
            isEdit: !!messageId, 
            keyboardRows: keyboardRows.length,
            totalButtons: keyboardRows.reduce((sum, row) => sum + row.length, 0)
        });

        try {
            if (messageId) {
                await this.bot.editMessageText(chatId, messageId, text + footer, {
                    ...keyboard,
                    parse_mode: 'HTML'
                });
                this.log('Help menu edited successfully');
            } else {
                await this.bot.sendMessage(chatId, text + footer, {
                    ...keyboard,
                    parse_mode: 'HTML'
                });
                this.log('New help menu sent successfully');
            }
        } catch (error) {
            if (!error.message.includes('message is not modified')) {
                this.logError(error, { context: 'Send help menu', chatId, messageId });
                
                // If edit fails, try sending a new message
                if (messageId) {
                    this.log('Edit failed, sending new message');
                    await this.bot.sendMessage(chatId, text + footer, {
                        ...keyboard,
                        parse_mode: 'HTML'
                    });
                }
            } else {
                this.log('Message content unchanged');
            }
        }
    }

    /**
     * Send module-specific help
     * @param {number} chatId - Chat ID
     * @param {number} messageId - Message ID to edit
     * @param {number} userId - User ID
     * @param {string} moduleName - Module name
     */
    async _sendModuleHelp(chatId, messageId, userId, moduleName) {
        this.log('Building module help', { moduleName, chatId, messageId, userId });
        
        const allCommands = this._getAvailableCommands(userId);
        const moduleCommands = allCommands.filter(cmd => 
            (cmd.module || 'Unknown') === moduleName
        );

        this.log('Module commands found', { 
            moduleName, 
            commandCount: moduleCommands.length,
            commands: moduleCommands.map(cmd => cmd.command)
        });

        let text = `📦 <b>${this.escapeHtml(moduleName)} Commands</b>\n\n`;
        
        if (moduleCommands.length > 0) {
            moduleCommands.forEach(cmd => {
                const icon = (cmd.permission === 'admin') ? '🔧' : '👤';
                text += `${icon} <code>/${cmd.command}</code> - ${this.escapeHtml(cmd.description)}\n`;
            });
        } else {
            text += 'No available commands found in this module.';
        }

        // Create back button using Bot.js helper method
        const keyboard = this.bot.createInlineKeyboard([
            [this.bot.createInlineButton('◀ Back to Modules', 'help:page:0')]
        ]);

        try {
            await this.bot.editMessageText(chatId, messageId, text, {
                ...keyboard,
                parse_mode: 'HTML'
            });
            this.log('Module help updated successfully');
        } catch (error) {
            this.logError(error, { context: 'Send module help', moduleName, chatId, messageId });
        }
    }

    /**
     * Send help for a specific command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async _sendSpecificCommandHelp(msg, args) {
        const commandName = args[0].replace('/', '');
        const allCommands = this._getAvailableCommands(msg.from.id);
        const command = allCommands.find(cmd => cmd.command === commandName);

        if (!command) {
            await this.reply(msg, `❌ Command '<code>${this.escapeHtml(args[0])}</code>' not found or you don't have permission to use it.`);
            return;
        }

        let helpText = `📖 <b>Help for /${command.command}</b>\n\n`;
        helpText += `<b>Description:</b> ${this.escapeHtml(command.description)}\n`;
        helpText += `<b>Usage:</b> <code>${this.escapeHtml(command.usage)}</code>\n`;
        helpText += `<b>Permission:</b> ${command.permission}\n`;
        helpText += `<b>Module:</b> ${this.escapeHtml(command.module || 'Unknown')}`;
        
        await this.reply(msg, helpText);
        
        this.log('Specific command help sent', { 
            command: commandName, 
            userId: msg.from.id 
        });
    }
}

module.exports = HelpModule;
