/**
 * Admin Module
 * 
 * Provides administrative commands for bot management,
 * including module listing, help system, and status monitoring.
 * 
 * @module modules/admin
 */

const BaseModule = require('../core/BaseModule');
const { config } = require('../utils/config');

/**
 * Admin Module class
 */
class AdminModule extends BaseModule {
    constructor(bot) {
        super(bot);
        this.name = 'Admin';
        this.version = '1.0.0';
        this.description = 'Administrative commands and bot management';
    }

    /**
     * Initialize the module
     */
    async init() {
        await super.init();

        // Register commands
        this.registerCommands([
            {
                command: 'start',
                handler: this.handleStart,
                options: {
                    description: 'Start the bot and show welcome message',
                    usage: '/start',
                    permission: 'public'
                }
            },
            {
                command: 'help',
                handler: this.handleHelp,
                options: {
                    description: 'Show available commands',
                    usage: '/help [command]',
                    permission: 'public'
                }
            },
            {
                command: 'modules',
                handler: this.handleModules,
                options: {
                    description: 'List loaded modules',
                    usage: '/modules',
                    permission: 'admin'
                }
            },
            {
                command: 'status',
                handler: this.handleStatus,
                options: {
                    description: 'Show bot status and statistics',
                    usage: '/status',
                    permission: 'admin'
                }
            },
            {
                command: 'info',
                handler: this.handleInfo,
                options: {
                    description: 'Show bot information',
                    usage: '/info',
                    permission: 'public'
                }
            },
            {
                command: 'ping',
                handler: this.handlePing,
                options: {
                    description: 'Check bot responsiveness',
                    usage: '/ping',
                    permission: 'public'
                }
            }
        ]);

        this.log('Admin module initialized with commands', {
            commands: this.commands.map(cmd => cmd.command)
        });
    }

    /**
     * Handle /start command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handleStart(msg, args) {
        try {
            const user = msg.from;
            const isAdmin = config.ADMIN_USER_IDS.includes(String(user.id));
            
            let welcomeMessage = `👋 Hello ${this.escapeHtml(user.first_name)}!\n\n`;
            welcomeMessage += `🤖 I'm a modular Telegram bot with various features.\n\n`;
            welcomeMessage += `📋 Use /help to see available commands.\n`;
            
            if (isAdmin) {
                welcomeMessage += `\n🔧 <i>Admin access detected. You have access to administrative commands.</i>`;
            }

            await this.reply(msg, welcomeMessage);

            this.log('Start command executed', {
                userId: user.id,
                username: user.username,
                isAdmin
            });

        } catch (error) {
            this.logError(error, { command: 'start', userId: msg.from.id });
            await this.reply(msg, '❌ An error occurred while processing start command.');
        }
    }

    /**
     * Handle /help command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handleHelp(msg, args) {
        try {
            const isAdmin = config.ADMIN_USER_IDS.includes(String(msg.from.id));
            const allCommands = this.bot.getCommands(true); // Get ALL commands, including hidden ones

            if (args.length > 0) {
                // --- Logic for specific command help: /help <command> ---
                const commandName = args[0].replace('/', '');
                const command = allCommands.find(cmd => cmd.command === commandName);

                // Ensure the command exists and the user has permission to see its help
                if (!command || (command.permission === 'admin' && !isAdmin) || command.hidden) {
                    await this.reply(msg, `❌ Command '/${commandName}' not found or you don't have permission.`);
                    return;
                }

                let helpText = `📖 <b>Help for /${command.command}</b>\n\n`;
                helpText += `📝 <b>Description:</b> ${command.description}\n`;
                helpText += `💡 <b>Usage:</b> <code>${command.usage}</code>\n`;
                helpText += `🔐 <b>Permission:</b> ${command.permission}\n`;
                helpText += `📦 <b>Module:</b> ${command.module}`;

                await this.reply(msg, helpText);

            } else {
                // --- Logic for the general command list: /help ---
                const commandsToShow = allCommands.filter(cmd => {
                    if (cmd.hidden) return false; // Never show hidden commands in the list
                    if (cmd.permission === 'public') return true; // Show public commands to everyone
                    return cmd.permission === 'admin' && isAdmin; // Only show admin commands to admins
                });

                if (commandsToShow.length === 0) {
                    await this.reply(msg, 'ℹ️ There are no commands available for you to use.');
                    return;
                }

                // Group commands by module for a clean look
                const moduleGroups = {};
                commandsToShow.forEach(cmd => {
                    if (!moduleGroups[cmd.module]) {
                        moduleGroups[cmd.module] = [];
                    }
                    moduleGroups[cmd.module].push(cmd);
                });

                let helpText = `📋 <b>Available Commands</b>\n\n`;
                
                Object.keys(moduleGroups).sort().forEach(moduleName => {
                    helpText += `📦 <b>${moduleName} Module:</b>\n`;
                    moduleGroups[moduleName].forEach(cmd => {
                        const permissionIcon = cmd.permission === 'admin' ? '🔧' : '👤';
                        helpText += `${permissionIcon} /${cmd.command} - ${cmd.description}\n`;
                    });
                    helpText += '\n';
                });

                helpText += `💡 Use /help <command> for detailed information about a specific command.`;

                await this.reply(msg, helpText);
            }

            this.log('Help command executed', {
                userId: msg.from.id,
                specificCommand: args[0] || null,
                isAdmin
            });

        } catch (error) {
            this.logError(error, { command: 'help', userId: msg.from.id });
            await this.reply(msg, '❌ An error occurred while showing help.');
        }
    }


    /**
     * Handle /modules command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handleModules(msg, args) {
        try {
            const modules = this.bot.getModules();
            
            if (modules.length === 0) {
                await this.reply(msg, '❌ No modules loaded.');
                return;
            }

            let moduleText = `📦 <b>Loaded Modules (${modules.length})</b>\n\n`;
            
            modules.forEach(module => {
                const statusIcon = module.enabled ? '✅' : '❌';
                const loadTime = new Date(module.loadTime).toLocaleString();
                
                moduleText += `${statusIcon} <b>${module.name}</b> v${module.version}\n`;
                moduleText += `   📝 ${module.description}\n`;
                moduleText += `   📅 Loaded: ${loadTime}\n`;
                moduleText += `   🔧 Commands: ${module.commands.length}\n\n`;
            });

            await this.reply(msg, moduleText);

            this.log('Modules command executed', {
                userId: msg.from.id,
                moduleCount: modules.length
            });

        } catch (error) {
            this.logError(error, { command: 'modules', userId: msg.from.id });
            await this.reply(msg, '❌ An error occurred while listing modules.');
        }
    }

    /**
     * Handle /status command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handleStatus(msg, args) {
        try {
            const stats = this.bot.getStats();
            const botInfo = await this.bot.getBotInfo();
            
            let statusText = `📊 <b>Bot Status</b>\n\n`;
            statusText += `🤖 <b>Bot:</b> @${botInfo.username}\n`;
            statusText += `🆔 <b>Bot ID:</b> ${botInfo.id}\n`;
            statusText += `🟢 <b>Status:</b> ${stats.isRunning ? 'Running' : 'Stopped'}\n`;
            statusText += `⏱️ <b>Uptime:</b> ${this.formatDuration(stats.uptime)}\n`;
            statusText += `📅 <b>Started:</b> ${stats.startTime ? stats.startTime.toLocaleString() : 'N/A'}\n\n`;
            
            statusText += `📈 <b>Statistics:</b>\n`;
            statusText += `💬 Messages processed: ${stats.messagesProcessed}\n`;
            statusText += `⚡ Commands executed: ${stats.commandsExecuted}\n`;
            statusText += `❌ Errors occurred: ${stats.errorsOccurred}\n`;
            statusText += `📦 Loaded modules: ${stats.loadedModules}\n`;
            statusText += `🔧 Registered commands: ${stats.registeredCommands}\n\n`;
            
            statusText += `⚙️ <b>Configuration:</b>\n`;
            statusText += `🌍 Environment: ${config.NODE_ENV}\n`;
            statusText += `🔗 Deployment mode: ${config.DEPLOYMENT_MODE}\n`;
            statusText += `🚪 Port: ${config.PORT}\n`;
            statusText += `📝 Log level: ${config.LOG_LEVEL}`;

            await this.reply(msg, statusText);

            this.log('Status command executed', {
                userId: msg.from.id,
                stats
            });

        } catch (error) {
            this.logError(error, { command: 'status', userId: msg.from.id });
            await this.reply(msg, '❌ An error occurred while getting status.');
        }
    }

    /**
     * Handle /info command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handleInfo(msg, args) {
        try {
            const botInfo = await this.bot.getBotInfo();
            const stats = this.bot.getStats();
            
            let infoText = `ℹ️ <b>Bot Information</b>\n\n`;
            infoText += `🤖 <b>Name:</b> ${botInfo.first_name}\n`;
            infoText += `👤 <b>Username:</b> @${botInfo.username}\n`;
            infoText += `🆔 <b>ID:</b> ${botInfo.id}\n`;
            infoText += `📦 <b>Modules:</b> ${stats.loadedModules}\n`;
            infoText += `🔧 <b>Commands:</b> ${stats.registeredCommands}\n\n`;
            
            infoText += `🏗️ <b>Framework:</b> Modular Telegram Bot v1.0.0\n`;
            infoText += `⚡ <b>Runtime:</b> Node.js ${process.version}\n`;
            infoText += `🖥️ <b>Platform:</b> ${process.platform} ${process.arch}\n\n`;
            
            infoText += `📖 This bot uses a modular architecture that allows easy extension with new features.`;

            await this.reply(msg, infoText);

            this.log('Info command executed', {
                userId: msg.from.id
            });

        } catch (error) {
            this.logError(error, { command: 'info', userId: msg.from.id });
            await this.reply(msg, '❌ An error occurred while getting bot information.');
        }
    }

    /**
     * Handle /ping command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handlePing(msg, args) {
        try {
            const startTime = Date.now();
            
            const sentMessage = await this.reply(msg, '🏓 Pinging...');
            
            if (sentMessage) {
                const responseTime = Date.now() - startTime;
                
                await this.bot.sendMessage(msg.chat.id, 
                    `🏓 Pong! Response time: ${responseTime}ms`, 
                    { 
                        reply_to_message_id: sentMessage.message_id 
                    }
                );
            }

            this.log('Ping command executed', {
                userId: msg.from.id,
                responseTime: Date.now() - startTime
            });

        } catch (error) {
            this.logError(error, { command: 'ping', userId: msg.from.id });
            await this.reply(msg, '❌ An error occurred while pinging.');
        }
    }
}

module.exports = AdminModule;

