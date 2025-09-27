/**
 * Random Module
 * 
 * Provides random number generation, coin flips, dice rolls,
 * and other randomization utilities.
 * 
 * @module modules/random
 */

const BaseModule = require('../core/BaseModule');

/**
 * Random Module class
 */
class RandomModule extends BaseModule {
    constructor(bot) {
        super(bot);
        this.name = 'Random';
        this.version = '1.0.0';
        this.description = 'Random number generation and utilities';
    }

    /**
     * Initialize the module
     */
    async init() {
        await super.init();

        // Register commands
        this.registerCommands([
            {
                command: 'random',
                handler: this.handleRandom,
                options: {
                    description: 'Generate a random number',
                    usage: '/random [max] or /random [min] [max]',
                    permission: 'public'
                }
            },
            {
                command: 'flip',
                handler: this.handleFlip,
                options: {
                    description: 'Flip a coin',
                    usage: '/flip',
                    permission: 'public'
                }
            },
            {
                command: 'dice',
                handler: this.handleDice,
                options: {
                    description: 'Roll dice',
                    usage: '/dice [sides] [count]',
                    permission: 'public'
                }
            },
            {
                command: 'choose',
                handler: this.handleChoose,
                options: {
                    description: 'Choose randomly from options',
                    usage: '/choose option1 option2 option3...',
                    permission: 'public'
                }
            },
            {
                command: 'shuffle',
                handler: this.handleShuffle,
                options: {
                    description: 'Shuffle a list of items',
                    usage: '/shuffle item1 item2 item3...',
                    permission: 'public'
                }
            },
            {
                command: 'password',
                handler: this.handlePassword,
                options: {
                    description: 'Generate a random password',
                    usage: '/password [length] [complexity]',
                    permission: 'public'
                }
            }
        ]);

        this.log('Random module initialized with commands', {
            commands: this.commands.map(cmd => cmd.command)
        });
    }

    /**
     * Handle /random command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handleRandom(msg, args) {
        try {
            let min = 1;
            let max = 100;

            if (args.length === 1) {
                // /random [max]
                max = parseInt(args[0], 10);
                if (isNaN(max) || max < 1) {
                    await this.reply(msg, '❌ Please provide a valid maximum number (greater than 0).');
                    return;
                }
            } else if (args.length === 2) {
                // /random [min] [max]
                min = parseInt(args[0], 10);
                max = parseInt(args[1], 10);
                
                if (isNaN(min) || isNaN(max)) {
                    await this.reply(msg, '❌ Please provide valid numbers for min and max.');
                    return;
                }
                
                if (min >= max) {
                    await this.reply(msg, '❌ Minimum value must be less than maximum value.');
                    return;
                }
            } else if (args.length > 2) {
                await this.reply(msg, '❌ Too many arguments.\nUsage: /random [max] or /random [min] [max]');
                return;
            }

            // Ensure reasonable limits
            if (max - min > 1000000) {
                await this.reply(msg, '❌ Range is too large. Maximum range is 1,000,000.');
                return;
            }

            const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
            
            await this.reply(msg, `🎲 Random number between ${min} and ${max}: <b>${randomNumber}</b>`);

            this.log('Random number generated', {
                userId: msg.from.id,
                min,
                max,
                result: randomNumber
            });

        } catch (error) {
            this.logError(error, { command: 'random', userId: msg.from.id });
            await this.reply(msg, '❌ An error occurred while generating random number.');
        }
    }

    /**
     * Handle /flip command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handleFlip(msg, args) {
        try {
            const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
            const emoji = result === 'Heads' ? '🪙' : '🔄';
            
            await this.reply(msg, `${emoji} Coin flip result: <b>${result}</b>`);

            this.log('Coin flip executed', {
                userId: msg.from.id,
                result
            });

        } catch (error) {
            this.logError(error, { command: 'flip', userId: msg.from.id });
            await this.reply(msg, '❌ An error occurred while flipping coin.');
        }
    }

    /**
     * Handle /dice command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handleDice(msg, args) {
        try {
            let sides = 6;
            let count = 1;

            if (args.length >= 1) {
                sides = parseInt(args[0], 10);
                if (isNaN(sides) || sides < 2 || sides > 100) {
                    await this.reply(msg, '❌ Number of sides must be between 2 and 100.');
                    return;
                }
            }

            if (args.length >= 2) {
                count = parseInt(args[1], 10);
                if (isNaN(count) || count < 1 || count > 20) {
                    await this.reply(msg, '❌ Number of dice must be between 1 and 20.');
                    return;
                }
            }

            const results = [];
            let total = 0;

            for (let i = 0; i < count; i++) {
                const roll = Math.floor(Math.random() * sides) + 1;
                results.push(roll);
                total += roll;
            }

            let response = `🎲 Rolling ${count} ${sides}-sided dice:\n\n`;
            
            if (count === 1) {
                response += `Result: <b>${results[0]}</b>`;
            } else {
                response += `Results: ${results.map(r => `<b>${r}</b>`).join(', ')}\n`;
                response += `Total: <b>${total}</b>`;
            }

            await this.reply(msg, response);

            this.log('Dice rolled', {
                userId: msg.from.id,
                sides,
                count,
                results,
                total
            });

        } catch (error) {
            this.logError(error, { command: 'dice', userId: msg.from.id });
            await this.reply(msg, '❌ An error occurred while rolling dice.');
        }
    }

    /**
     * Handle /choose command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handleChoose(msg, args) {
        try {
            if (args.length < 2) {
                await this.reply(msg, '❌ Please provide at least 2 options to choose from.\nUsage: /choose option1 option2 option3...');
                return;
            }

            if (args.length > 50) {
                await this.reply(msg, '❌ Too many options. Maximum is 50.');
                return;
            }

            const choice = args[Math.floor(Math.random() * args.length)];
            
            await this.reply(msg, `🎯 I choose: <b>${this.escapeHtml(choice)}</b>`);

            this.log('Choice made', {
                userId: msg.from.id,
                optionCount: args.length,
                choice
            });

        } catch (error) {
            this.logError(error, { command: 'choose', userId: msg.from.id });
            await this.reply(msg, '❌ An error occurred while making choice.');
        }
    }

    /**
     * Handle /shuffle command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handleShuffle(msg, args) {
        try {
            if (args.length < 2) {
                await this.reply(msg, '❌ Please provide at least 2 items to shuffle.\nUsage: /shuffle item1 item2 item3...');
                return;
            }

            if (args.length > 50) {
                await this.reply(msg, '❌ Too many items. Maximum is 50.');
                return;
            }

            // Fisher-Yates shuffle algorithm
            const shuffled = [...args];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }

            const response = `🔀 Shuffled list:\n${shuffled.map((item, index) => 
                `${index + 1}. ${this.escapeHtml(item)}`).join('\n')}`;

            await this.reply(msg, response);

            this.log('List shuffled', {
                userId: msg.from.id,
                itemCount: args.length
            });

        } catch (error) {
            this.logError(error, { command: 'shuffle', userId: msg.from.id });
            await this.reply(msg, '❌ An error occurred while shuffling list.');
        }
    }

    /**
     * Handle /password command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handlePassword(msg, args) {
        try {
            let length = 12;
            let complexity = 'medium';

            if (args.length >= 1) {
                length = parseInt(args[0], 10);
                if (isNaN(length) || length < 4 || length > 128) {
                    await this.reply(msg, '❌ Password length must be between 4 and 128 characters.');
                    return;
                }
            }

            if (args.length >= 2) {
                complexity = args[1].toLowerCase();
                if (!['low', 'medium', 'high'].includes(complexity)) {
                    await this.reply(msg, '❌ Complexity must be: low, medium, or high.');
                    return;
                }
            }

            // Character sets based on complexity
            let charset = '';
            switch (complexity) {
                case 'low':
                    charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
                    break;
                case 'medium':
                    charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                    break;
                case 'high':
                    charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
                    break;
            }

            let password = '';
            for (let i = 0; i < length; i++) {
                password += charset.charAt(Math.floor(Math.random() * charset.length));
            }

            // Send password in a code block for easy copying
            await this.reply(msg, `🔐 Generated password (${complexity} complexity):\n\n<code>${password}</code>\n\n⚠️ <i>Make sure to save this password securely!</i>`);

            this.log('Password generated', {
                userId: msg.from.id,
                length,
                complexity
            });

        } catch (error) {
            this.logError(error, { command: 'password', userId: msg.from.id });
            await this.reply(msg, '❌ An error occurred while generating password.');
        }
    }
}

module.exports = RandomModule;

