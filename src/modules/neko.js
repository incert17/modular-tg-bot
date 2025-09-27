/**
 * Neko Module
 *
 * Provides anime reaction images and GIFs using nekos.best API.
 * Usage: +<category> as reply to someone or standalone.
 *
 * @module modules/neko
 */

const BaseModule = require('../core/BaseModule');
const https = require('https');

/**
 * Neko Module class
 */
class NekoModule extends BaseModule {
    constructor(bot) {
        super(bot);
        this.name = 'Neko';
        this.version = '1.0.0';
        this.description = 'Anime reactions using nekos.best API - use +<category> to react';
        
        // API configuration
        this.apiBase = 'https://nekos.best/api/v2';
        
        // Available categories
        this.imageCategories = ['husbando', 'kitsune', 'neko', 'waifu'];
        this.gifCategories = [
            'angry', 'baka', 'bite', 'blush', 'bored', 'cry', 'cuddle', 'dance', 
            'facepalm', 'feed', 'handhold', 'handshake', 'happy', 'highfive', 
            'hug', 'kick', 'kiss', 'laugh', 'lurk', 'nod', 'nom', 'nope', 
            'pat', 'peck', 'poke', 'pout', 'punch', 'run', 'shoot', 'shrug', 
            'slap', 'sleep', 'smile', 'smug', 'stare', 'think', 'thumbsup', 
            'tickle', 'wave', 'wink', 'yawn', 'yeet'
        ];
        
        // All valid categories
        this.allCategories = [...this.imageCategories, ...this.gifCategories];
        
        // Cache for API responses
        this.cache = new Map();
        this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
    }

    /**
     * Initialize the module
     */
    async init() {
        await super.init();
        
        // Register help command
        this.registerCommands([
            {
                command: 'nekoh',
                handler: this.handleNekoHelp,
                options: {
                    description: 'Show anime reaction help - use +<category> to react',
                    usage: '/nekoh',
                    permission: 'public'
                }
            }
        ]);

        // Register message handler for reactions
        this.bot.registerMiddleware(this.handleReactionMessage.bind(this));
        
        this.log('Neko module initialized with reaction functionality');
    }

    /**
     * Handle neko help command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handleNekoHelp(msg, args) {
        try {
            let helpText = `🐱 <b>Neko Reactions Help</b>\n\n`;
            helpText += `Use reactions by typing <code>+&lt;category&gt;</code> in any chat!\n\n`;
            
            helpText += `<b>📸 Image Categories:</b>\n`;
            this.imageCategories.forEach(cat => {
                helpText += `• <code>+${cat}</code>\n`;
            });
            
            helpText += `\n<b>🎬 GIF Categories:</b>\n`;
            // Group GIFs in rows of 4 for better readability
            for (let i = 0; i < this.gifCategories.length; i += 4) {
                const row = this.gifCategories.slice(i, i + 4);
                helpText += `• ${row.map(cat => `<code>+${cat}</code>`).join(' ')}\n`;
            }
            
            helpText += `\n<b>💡 How to use:</b>\n`;
            helpText += `• Reply to someone: <code>+hug</code> → "User1 hugged User2"\n`;
            helpText += `• Standalone: <code>+hug</code> → Bot reacts to you\n\n`;
            helpText += `<i>All reactions use cute anime images and GIFs! 🌸</i>`;
            
            await this.reply(msg, helpText);
            
            this.log('Neko help command executed', { userId: msg.from.id });
        } catch (error) {
            this.logError(error, { command: 'nekoh', userId: msg.from.id });
            await this.reply(msg, '❌ An error occurred while showing neko help.');
        }
    }

    /**
     * Handle reaction messages
     * @param {Object} msg - Telegram message object
     * @param {Object} bot - Bot instance
     * @returns {boolean} Continue processing
     */
    async handleReactionMessage(msg, bot) {
        try {
            // Check if message starts with +
            if (!msg.text || !msg.text.startsWith('+')) {
                return true; // Continue processing
            }

            // Extract category
            const category = msg.text.slice(1).toLowerCase().trim();
            
            // Check if it's a valid category
            if (!this.allCategories.includes(category)) {
                return true; // Not a valid reaction, continue processing
            }

            // Process the reaction
            await this.processReaction(msg, category);
            
            return true; // Continue processing
        } catch (error) {
            this.logError(error, { context: 'Reaction message handler', userId: msg.from?.id });
            return true; // Continue processing even on error
        }
    }

    /**
     * Process a reaction
     * @param {Object} msg - Telegram message object
     * @param {string} category - Reaction category
     */
    async processReaction(msg, category) {
        try {
            // Get image/gif from API
            const mediaData = await this.getReactionMedia(category);
            
            if (!mediaData || !mediaData.url) {
                await this.reply(msg, `❌ Could not fetch ${category} reaction. Try again later!`);
                return;
            }

            // Determine if this is a reply or standalone
            const isReply = msg.reply_to_message;
            let caption = '';
            let replyToMessageId = null;

            if (isReply) {
                // Reply mode: User1 [action] User2
                const user1 = this.getUserDisplayName(msg.from);
                const user2 = this.getUserDisplayName(msg.reply_to_message.from);
                caption = this.buildReplyCaption(category, user1, user2);
                replyToMessageId = msg.reply_to_message.message_id;
            } else {
                // Standalone mode: Bot reacts to user
                const userName = this.getUserDisplayName(msg.from);
                caption = this.buildStandaloneCaption(category, userName);
                replyToMessageId = msg.message_id;
            }

            // Send the reaction
            if (this.gifCategories.includes(category)) {
                // Send as GIF/animation
                await this.bot.bot.sendAnimation(msg.chat.id, mediaData.url, {
                    caption: caption,
                    parse_mode: 'HTML',
                    reply_to_message_id: replyToMessageId
                });
            } else {
                // Send as photo
                await this.bot.bot.sendPhoto(msg.chat.id, mediaData.url, {
                    caption: caption,
                    parse_mode: 'HTML',
                    reply_to_message_id: replyToMessageId
                });
            }

            // Delete the original reaction message for cleaner chat
            try {
                await this.bot.deleteMessage(msg.chat.id, msg.message_id);
            } catch (deleteError) {
                // Ignore delete errors (bot might not have permission)
            }

            this.log('Reaction processed', { 
                category, 
                isReply, 
                userId: msg.from.id,
                chatId: msg.chat.id
            });

        } catch (error) {
            this.logError(error, { 
                context: 'Process reaction', 
                category, 
                userId: msg.from.id 
            });
            await this.reply(msg, `❌ Failed to send ${category} reaction.`);
        }
    }

    /**
     * Get reaction media from nekos.best API
     * @param {string} category - Reaction category
     * @returns {Promise<Object>} Media data with URL
     */
    async getReactionMedia(category) {
        const cacheKey = `neko:${category}`;
        const cached = this.getFromCache(cacheKey);
        
        if (cached) {
            return cached;
        }

        return new Promise((resolve, reject) => {
            const url = `${this.apiBase}/${category}`;
            
            https.get(url, {
                headers: {
                    'User-Agent': 'TelegramBot/1.0 (Neko Module)',
                    'Accept': 'application/json'
                }
            }, (response) => {
                let data = '';
                
                response.on('data', (chunk) => {
                    data += chunk;
                });
                
                response.on('end', () => {
                    try {
                        if (response.statusCode !== 200) {
                            throw new Error(`API returned status ${response.statusCode}`);
                        }
                        
                        const result = JSON.parse(data);
                        
                        if (!result.results || !result.results[0] || !result.results[0].url) {
                            throw new Error('Invalid API response format');
                        }
                        
                        const mediaData = {
                            url: result.results[0].url,
                            artist_name: result.results[0].artist_name,
                            artist_href: result.results[0].artist_href,
                            source_url: result.results[0].source_url
                        };
                        
                        // Cache the result (shorter cache for variety)
                        this.setCache(cacheKey, mediaData, 5 * 60 * 1000); // 5 minutes
                        
                        resolve(mediaData);
                        
                    } catch (parseError) {
                        this.logError(parseError, { 
                            context: 'Parse nekos.best API response',
                            category,
                            statusCode: response.statusCode 
                        });
                        reject(parseError);
                    }
                });
            }).on('error', (error) => {
                this.logError(error, { context: 'Nekos.best API request', category });
                reject(error);
            });
        });
    }

    /**
     * Build caption for reply reactions
     * @param {string} category - Reaction category
     * @param {string} user1 - User who sent the reaction
     * @param {string} user2 - User being reacted to
     * @returns {string} Caption text
     */
    buildReplyCaption(category, user1, user2) {
        const templates = {
            // GIF reactions
            angry: [`${user1} is angry at ${user2}! 😤`, `${user1} shows anger towards ${user2}! 💢`],
            baka: [`${user1} calls ${user2} a baka! 🙄`, `"Baka!" says ${user1} to ${user2} 😏`],
            bite: [`${user1} bites ${user2}! 😈`, `Nom nom! ${user1} bites ${user2} 🦷`],
            blush: [`${user1} makes ${user2} blush! 😊`, `${user2} is making ${user1} blush! ☺️`],
            bored: [`${user1} looks bored at ${user2} 😑`, `${user1} is bored with ${user2}... 😪`],
            cry: [`${user1} cries because of ${user2}! 😢`, `${user1} is in tears over ${user2}! 😭`],
            cuddle: [`${user1} cuddles with ${user2}! 🤗`, `Cozy cuddles between ${user1} and ${user2}! 💕`],
            dance: [`${user1} dances with ${user2}! 💃`, `${user1} and ${user2} are dancing together! 🕺`],
            facepalm: [`${user1} facepalms at ${user2}! 🤦`, `*facepalm* ${user1} can't believe ${user2}! 😅`],
            feed: [`${user1} feeds ${user2}! 🍽️`, `Nom nom! ${user1} is feeding ${user2}! 🥄`],
            handhold: [`${user1} holds ${user2}'s hand! 👫`, `Hand in hand: ${user1} and ${user2}! 💑`],
            handshake: [`${user1} shakes hands with ${user2}! 🤝`, `A firm handshake between ${user1} and ${user2}! 🤝`],
            happy: [`${user1} is happy with ${user2}! 😄`, `${user1} brings joy to ${user2}! 😊`],
            highfive: [`${user1} high-fives ${user2}! ✋`, `High five between ${user1} and ${user2}! 🙌`],
            hug: [`${user1} hugs ${user2}! 🤗`, `A warm hug from ${user1} to ${user2}! 💝`],
            kick: [`${user1} kicks ${user2}! 👢`, `Ouch! ${user1} kicks ${user2}! 🦵`],
            kiss: [`${user1} kisses ${user2}! 💋`, `A sweet kiss from ${user1} to ${user2}! 😘`],
            laugh: [`${user1} laughs with ${user2}! 😂`, `${user1} and ${user2} are laughing together! 🤣`],
            lurk: [`${user1} is lurking around ${user2}... 👀`, `${user1} lurks in the shadows watching ${user2}... 🕵️`],
            nod: [`${user1} nods at ${user2}! 👍`, `${user1} gives ${user2} an approving nod! ✅`],
            nom: [`${user1} noms on ${user2}! 😋`, `Nom nom nom! ${user1} is eating ${user2}! 🍽️`],
            nope: [`${user1} says nope to ${user2}! ❌`, `Nope! ${user1} rejects ${user2}! 🙅`],
            pat: [`${user1} pats ${user2}! 👋`, `Pat pat! ${user1} gently pats ${user2}! 🤚`],
            peck: [`${user1} gives ${user2} a little peck! 😙`, `A cute peck from ${user1} to ${user2}! 💕`],
            poke: [`${user1} pokes ${user2}! 👉`, `Poke poke! ${user1} is poking ${user2}! 👆`],
            pout: [`${user1} pouts at ${user2}! 😤`, `${user1} is pouting because of ${user2}! 😞`],
            punch: [`${user1} punches ${user2}! 👊`, `Pow! ${user1} throws a punch at ${user2}! 💥`],
            run: [`${user1} runs away from ${user2}! 🏃`, `${user1} is running towards ${user2}! 💨`],
            shoot: [`${user1} shoots ${user2}! 🔫`, `Pew pew! ${user1} shoots at ${user2}! 💥`],
            shrug: [`${user1} shrugs at ${user2}! 🤷`, `${user1} doesn't know what to say to ${user2}... 🤷`],
            slap: [`${user1} slaps ${user2}! 👋`, `Slap! ${user1} gives ${user2} a slap! 🤚`],
            sleep: [`${user1} sleeps next to ${user2}! 😴`, `${user1} and ${user2} are sleeping together! 💤`],
            smile: [`${user1} smiles at ${user2}! 😊`, `A bright smile from ${user1} to ${user2}! 😄`],
            smug: [`${user1} looks smug at ${user2}! 😏`, `${user1} has a smug expression for ${user2}! 😎`],
            stare: [`${user1} stares at ${user2}... 👀`, `${user1} is intensely staring at ${user2}... 😳`],
            think: [`${user1} thinks about ${user2}... 🤔`, `${user1} is pondering over ${user2}... 💭`],
            thumbsup: [`${user1} gives ${user2} a thumbs up! 👍`, `${user1} approves of ${user2}! 👌`],
            tickle: [`${user1} tickles ${user2}! 😂`, `Tickle tickle! ${user1} is tickling ${user2}! 🤗`],
            wave: [`${user1} waves at ${user2}! 👋`, `Hello! ${user1} waves to ${user2}! 🙋`],
            wink: [`${user1} winks at ${user2}! 😉`, `${user1} gives ${user2} a playful wink! 😜`],
            yawn: [`${user1} yawns at ${user2}! 😴`, `${user1} is getting sleepy around ${user2}... 🥱`],
            yeet: [`${user1} yeets ${user2}! 🚀`, `YEET! ${user1} throws ${user2}! 💨`],
            
            // Image reactions
            husbando: [`${user1} shows ${user2} their husbando! 💙`, `Look ${user2}, ${user1} found their husbando! 👨`],
            kitsune: [`${user1} shows ${user2} a cute kitsune! 🦊`, `${user1} shares kitsune vibes with ${user2}! 🌸`],
            neko: [`${user1} shows ${user2} a cute neko! 🐱`, `Nya~ ${user1} shares neko cuteness with ${user2}! 😺`],
            waifu: [`${user1} shows ${user2} their waifu! 💖`, `Look ${user2}, ${user1} found their waifu! 👩`]
        };

        const categoryTemplates = templates[category] || [`${user1} reacts to ${user2} with ${category}!`];
        const randomTemplate = categoryTemplates[Math.floor(Math.random() * categoryTemplates.length)];
        
        return randomTemplate;
    }

    /**
     * Build caption for standalone reactions
     * @param {string} category - Reaction category
     * @param {string} userName - User who sent the reaction
     * @returns {string} Caption text
     */
    buildStandaloneCaption(category, userName) {
        const templates = {
            // GIF reactions
            angry: [`I'm not angry at you, ${userName}! 😊`, `Don't be angry, ${userName}! Here's a hug! 🤗`],
            baka: [`You're not a baka, ${userName}! You're awesome! 😄`, `Silly ${userName}! 😏`],
            bite: [`I won't bite you, ${userName}! Promise! 😇`, `Gentle nibbles for ${userName}! 😋`],
            blush: [`You make me blush, ${userName}! 😊`, `${userName} is so sweet! ☺️`],
            bored: [`I'm never bored with you, ${userName}! 😄`, `Let's have fun, ${userName}! 🎉`],
            cry: [`Don't cry, ${userName}! Everything will be okay! 🤗`, `Here's a virtual hug, ${userName}! 💕`],
            cuddle: [`Virtual cuddles for ${userName}! 🤗`, `I'd love to cuddle with you, ${userName}! 💝`],
            dance: [`Let's dance together, ${userName}! 💃`, `Dance party with ${userName}! 🕺`],
            facepalm: [`Oh ${userName}! 🤦`, `Classic ${userName} moment! 😅`],
            feed: [`Here's some food for you, ${userName}! 🍽️`, `Nom nom time, ${userName}! 🥄`],
            handhold: [`I'd hold your hand, ${userName}! 👫`, `Virtual hand holding with ${userName}! 💑`],
            handshake: [`Nice to meet you, ${userName}! 🤝`, `A friendly handshake for ${userName}! 🤝`],
            happy: [`You make me happy, ${userName}! 😄`, `Spreading happiness to ${userName}! 😊`],
            highfive: [`High five, ${userName}! ✋`, `You deserve a high five, ${userName}! 🙌`],
            hug: [`Big hugs for ${userName}! 🤗`, `I love you, ${userName}! 💝`],
            kick: [`I would never kick you, ${userName}! 😊`, `Gentle nudge for ${userName}! 👉`],
            kiss: [`Sending kisses to ${userName}! 💋`, `Virtual kiss for ${userName}! 😘`],
            laugh: [`You make me laugh, ${userName}! 😂`, `Having fun with ${userName}! 🤣`],
            lurk: [`I see you lurking, ${userName}! 👀`, `Hello there, ${userName}! 🕵️`],
            nod: [`I agree with you, ${userName}! 👍`, `You're absolutely right, ${userName}! ✅`],
            nom: [`You look delicious, ${userName}! 😋`, `Nom nom ${userName}! 🍽️`],
            nope: [`I could never say no to you, ${userName}! 😊`, `Maybe later, ${userName}! 🙅`],
            pat: [`Head pats for ${userName}! 👋`, `Pat pat, good ${userName}! 🤚`],
            peck: [`A little kiss for ${userName}! 😙`, `Cute peck for ${userName}! 💕`],
            poke: [`Poke poke, ${userName}! 👉`, `Hey ${userName}! 👆`],
            pout: [`Don't pout, ${userName}! 😊`, `Cute pout, ${userName}! 😞`],
            punch: [`I'd never hurt you, ${userName}! 💝`, `Gentle boop for ${userName}! 👉`],
            run: [`Running to hug ${userName}! 🏃`, `Can't run away from my love, ${userName}! 💨`],
            shoot: [`Shooting hearts at ${userName}! 💘`, `Pew pew love for ${userName}! 💕`],
            shrug: [`I don't know either, ${userName}! 🤷`, `Sometimes that's life, ${userName}! 🤷`],
            slap: [`I'd never slap you, ${userName}! 😊`, `Gentle pat instead, ${userName}! 🤚`],
            sleep: [`Sweet dreams, ${userName}! 😴`, `Sleep well, ${userName}! 💤`],
            smile: [`You always make me smile, ${userName}! 😊`, `Beautiful smile for ${userName}! 😄`],
            smug: [`You're pretty cool, ${userName}! 😏`, `Looking good, ${userName}! 😎`],
            stare: [`I love looking at you, ${userName}! 👀`, `You're amazing, ${userName}! 😳`],
            think: [`Thinking about you, ${userName}! 🤔`, `You make me thoughtful, ${userName}! 💭`],
            thumbsup: [`You're the best, ${userName}! 👍`, `Great job, ${userName}! 👌`],
            tickle: [`Tickle fight with ${userName}! 😂`, `You're so ticklish, ${userName}! 🤗`],
            wave: [`Hello ${userName}! 👋`, `Nice to see you, ${userName}! 🙋`],
            wink: [`Wink wink, ${userName}! 😉`, `You're special, ${userName}! 😜`],
            yawn: [`Getting sleepy, ${userName}! 😴`, `Yawn... goodnight ${userName}! 🥱`],
            yeet: [`YEET! Love you ${userName}! 🚀`, `Yeeting happiness to ${userName}! 💨`],
            
            // Image reactions
            husbando: [`Here's a husbando for you, ${userName}! 💙`, `Thought you'd like this husbando, ${userName}! 👨`],
            kitsune: [`Cute kitsune for ${userName}! 🦊`, `Sharing kitsune magic with ${userName}! 🌸`],
            neko: [`Nya~ Here's a neko for ${userName}! 🐱`, `Cute neko just for you, ${userName}! 😺`],
            waifu: [`Beautiful waifu for ${userName}! 💖`, `Here's your waifu, ${userName}! 👩`]
        };

        const categoryTemplates = templates[category] || [`I love you, ${userName}! 💝`];
        const randomTemplate = categoryTemplates[Math.floor(Math.random() * categoryTemplates.length)];
        
        return randomTemplate;
    }

    /**
     * Get user display name
     * @param {Object} user - Telegram user object
     * @returns {string} Display name
     */
    getUserDisplayName(user) {
        if (!user) return 'Someone';
        
        if (user.first_name) {
            return user.first_name;
        }
        
        if (user.username) {
            return `@${user.username}`;
        }
        
        return 'Someone';
    }

    /**
     * Get from cache
     * @param {string} key - Cache key
     * @returns {Object|null} Cached data or null
     */
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > this.cacheTimeout) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }

    /**
     * Set cache
     * @param {string} key - Cache key
     * @param {Object} data - Data to cache
     * @param {number} customTimeout - Custom timeout (optional)
     */
    setCache(key, data, customTimeout = null) {
        // Clean old cache entries if cache gets too large
        if (this.cache.size > 100) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            timeout: customTimeout || this.cacheTimeout
        });
    }

    /**
     * Clean up module
     */
    async cleanup() {
        await super.cleanup();
        this.cache.clear();
    }
}

module.exports = NekoModule;
