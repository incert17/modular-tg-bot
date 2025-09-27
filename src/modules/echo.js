/**
 * Echo Module
 * 
 * Provides text manipulation commands like echo and reverse.
 * Demonstrates basic module functionality and command handling.
 * 
 * @module modules/echo
 */

const BaseModule = require('../core/BaseModule');

/**
 * Echo Module class
 */
class EchoModule extends BaseModule {
    constructor(bot) {
        super(bot);
        this.name = 'Echo';
        this.version = '1.0.0';
        this.description = 'Text manipulation and echo commands';
    }

    /**
     * Initialize the module
     */
    async init() {
        await super.init();

        // Register commands
        this.registerCommands([
            {
                command: 'echo',
                handler: this.handleEcho,
                options: {
                    description: 'Echo back the provided text',
                    usage: '/echo <text>',
                    permission: 'public'
                }
            },
            {
                command: 'reverse',
                handler: this.handleReverse,
                options: {
                    description: 'Reverse the provided text',
                    usage: '/reverse <text>',
                    permission: 'public'
                }
            },
            {
                command: 'uppercase',
                handler: this.handleUppercase,
                options: {
                    description: 'Convert text to uppercase',
                    usage: '/uppercase <text>',
                    permission: 'public'
                }
            },
            {
                command: 'lowercase',
                handler: this.handleLowercase,
                options: {
                    description: 'Convert text to lowercase',
                    usage: '/lowercase <text>',
                    permission: 'public'
                }
            },
            {
                command: 'count',
                handler: this.handleCount,
                options: {
                    description: 'Count characters and words in text',
                    usage: '/count <text>',
                    permission: 'public'
                }
            }
        ]);

        this.log('Echo module initialized with commands', {
            commands: this.commands.map(cmd => cmd.command)
        });
    }

    /**
     * Handle /echo command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handleEcho(msg, args) {
        try {
            // Validate arguments
            const validation = this.validateArgs(args, {
                minArgs: 1,
                args: [
                    {
                        name: 'text',
                        type: 'string',
                        required: true,
                        minLength: 1,
                        maxLength: 4000
                    }
                ]
            });

            if (!validation.valid) {
                await this.reply(msg, `❌ ${validation.errors.join(', ')}`);
                return;
            }

            // Join all arguments to form the text
            const text = args.join(' ');

            // Validate user input for security
            const inputValidation = this.validateInput(text);
            if (inputValidation.warnings.length > 0) {
                this.log('Security warning in echo command', {
                    userId: msg.from.id,
                    warnings: inputValidation.warnings
                });
            }

            // Echo the text back
            await this.reply(msg, `🔊 ${inputValidation.sanitized}`);

            this.log('Echo command executed', {
                userId: msg.from.id,
                textLength: text.length
            });

        } catch (error) {
            this.logError(error, { command: 'echo', userId: msg.from.id });
            await this.reply(msg, '❌ An error occurred while processing your request.');
        }
    }

    /**
     * Handle /reverse command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handleReverse(msg, args) {
        try {
            // Validate arguments
            if (args.length === 0) {
                await this.reply(msg, '❌ Please provide text to reverse.\nUsage: /reverse <text>');
                return;
            }

            // Join all arguments and reverse
            const text = args.join(' ');
            const reversed = text.split('').reverse().join('');

            // Validate input
            const inputValidation = this.validateInput(reversed);

            await this.reply(msg, `🔄 ${inputValidation.sanitized}`);

            this.log('Reverse command executed', {
                userId: msg.from.id,
                originalLength: text.length
            });

        } catch (error) {
            this.logError(error, { command: 'reverse', userId: msg.from.id });
            await this.reply(msg, '❌ An error occurred while processing your request.');
        }
    }

    /**
     * Handle /uppercase command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handleUppercase(msg, args) {
        try {
            if (args.length === 0) {
                await this.reply(msg, '❌ Please provide text to convert.\nUsage: /uppercase <text>');
                return;
            }

            const text = args.join(' ');
            const uppercase = text.toUpperCase();

            const inputValidation = this.validateInput(uppercase);
            await this.reply(msg, `🔤 ${inputValidation.sanitized}`);

            this.log('Uppercase command executed', {
                userId: msg.from.id,
                textLength: text.length
            });

        } catch (error) {
            this.logError(error, { command: 'uppercase', userId: msg.from.id });
            await this.reply(msg, '❌ An error occurred while processing your request.');
        }
    }

    /**
     * Handle /lowercase command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handleLowercase(msg, args) {
        try {
            if (args.length === 0) {
                await this.reply(msg, '❌ Please provide text to convert.\nUsage: /lowercase <text>');
                return;
            }

            const text = args.join(' ');
            const lowercase = text.toLowerCase();

            const inputValidation = this.validateInput(lowercase);
            await this.reply(msg, `🔡 ${inputValidation.sanitized}`);

            this.log('Lowercase command executed', {
                userId: msg.from.id,
                textLength: text.length
            });

        } catch (error) {
            this.logError(error, { command: 'lowercase', userId: msg.from.id });
            await this.reply(msg, '❌ An error occurred while processing your request.');
        }
    }

    /**
     * Handle /count command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handleCount(msg, args) {
        try {
            if (args.length === 0) {
                await this.reply(msg, '❌ Please provide text to count.\nUsage: /count <text>');
                return;
            }

            const text = args.join(' ');
            const characters = text.length;
            const charactersNoSpaces = text.replace(/\s/g, '').length;
            const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
            const lines = text.split('\n').length;

            const response = `📊 <b>Text Statistics:</b>\n\n` +
                `📝 Characters: ${characters}\n` +
                `🔤 Characters (no spaces): ${charactersNoSpaces}\n` +
                `📖 Words: ${words}\n` +
                `📄 Lines: ${lines}`;

            await this.reply(msg, response);

            this.log('Count command executed', {
                userId: msg.from.id,
                characters,
                words,
                lines
            });

        } catch (error) {
            this.logError(error, { command: 'count', userId: msg.from.id });
            await this.reply(msg, '❌ An error occurred while processing your request.');
        }
    }
}

module.exports = EchoModule;

