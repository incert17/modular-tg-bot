/**
 * Wallhaven Module
 *
 * Provides wallpaper search functionality via inline queries.
 * Usage: @botusername .w <search query>
 *
 * @module modules/wallhaven
 */

const BaseModule = require('../core/BaseModule');
const https = require('https');
const { URL } = require('url');

/**
 * Wallhaven Module class
 */
class WallhavenModule extends BaseModule {
    constructor(bot) {
        super(bot);
        this.name = 'Wallhaven';
        this.version = '1.0.0';
        this.description = 'Search and share wallpapers from Wallhaven.cc via inline queries';
        
        // Default search parameters for best results
        this.defaultParams = {
            categories: '111',        // general=1, anime=1, people=1
            purity: '100',           // sfw=1, sketchy=0, nsfw=0 (no API key)
            atleast: '1920x1080',    // minimum resolution
            sorting: 'relevance',    // relevance, date_added, random, views, favorites
            order: 'desc',           // desc, asc
            page: '1'                // start with first page
        };
        
        // Cache for recent searches (simple in-memory cache)
        this.searchCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Initialize the module
     */
    async init() {
        await super.init();
        
        // Register ONE info command so module appears in help
        this.registerCommands([
            {
                command: 'wallpaper',
                handler: this.handleWallpaperInfo,
                options: {
                    description: 'Get info about inline wallpaper search (@botusername .w query)',
                    usage: '/wallpaper',
                    permission: 'public'
                }
            }
        ]);

        // Register inline query handler for wallpaper searches
        this.bot.registerInlineQueryHandler(/^\.w\s+(.+)$/i, this.handleWallpaperSearch.bind(this), {
            module: this.name
        });
        
        // Register general inline query handler for help
        this.bot.registerInlineQueryHandler(/^\.w\s*$/i, this.handleWallpaperHelp.bind(this), {
            module: this.name
        });
        
        this.log('Wallhaven module initialized with inline handlers and info command');
    }

    /**
     * Handle wallpaper info command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handleWallpaperInfo(msg, args) {
        try {
            const botInfo = await this.bot.getBotInfo();
            
            let infoText = `🖼️ <b>Wallhaven Wallpaper Search</b>\n\n`;
            infoText += `This module provides <b>inline wallpaper search</b> functionality.\n\n`;
            infoText += `<b>How to use:</b>\n`;
            infoText += `Type <code>@${botInfo.username} .w</code> in any chat, followed by your search terms.\n\n`;
            infoText += `<b>Examples:</b>\n`;
            infoText += `<code>@${botInfo.username} .w nature mountains</code>\n`;
            infoText += `<code>@${botInfo.username} .w anime cyberpunk</code>\n`;
            infoText += `<code>@${botInfo.username} .w space galaxy</code>\n\n`;
            infoText += `<b>Features:</b>\n`;
            infoText += `• HD wallpapers (min 1920x1080)\n`;
            infoText += `• SFW content only\n`;
            infoText += `• Multiple categories\n`;
            infoText += `• Advanced search syntax support\n\n`;
            infoText += `<b>Advanced Search Tips:</b>\n`;
            infoText += `• <code>.w cars -racing</code> (exclude words)\n`;
            infoText += `• <code>.w +space +nebula</code> (require tags)\n`;
            infoText += `• <code>.w @username</code> (user uploads)\n`;
            infoText += `• <code>.w type:png landscape</code> (file type)\n\n`;
            infoText += `💡 <i>This is an inline-only feature - use it directly in any chat!</i>`;
            
            await this.reply(msg, infoText);
            
            this.log('Wallpaper info command executed', { userId: msg.from.id });
        } catch (error) {
            this.logError(error, { command: 'wallpaper', userId: msg.from.id });
            await this.reply(msg, '❌ An error occurred while showing wallpaper information.');
        }
    }

    /**
     * Handle wallpaper search inline queries
     * @param {Object} query - Telegram inline query object
     */
    async handleWallpaperSearch(query) {
        try {
            const matches = query.query.match(/^\.w\s+(.+)$/i);
            if (!matches) return;
            
            const searchQuery = matches[1].trim();
            
            this.log('Processing wallpaper search', { 
                query: searchQuery, 
                userId: query.from.id 
            });

            // Check cache first
            const cacheKey = `wallhaven:${searchQuery}`;
            const cached = this.getCachedResults(cacheKey);
            
            if (cached) {
                await this.bot.answerInlineQuery(query.id, cached, {
                    cache_time: 300,
                    is_personal: false
                });
                this.log('Served cached wallpaper results', { query: searchQuery });
                return;
            }

            // Search wallhaven
            const wallpapers = await this.searchWallpapers(searchQuery);
            
            if (!wallpapers || wallpapers.length === 0) {
                await this.bot.answerInlineQuery(query.id, [
                    {
                        type: 'article',
                        id: 'no-results',
                        title: 'No wallpapers found',
                        description: `No results for "${searchQuery}". Try different keywords.`,
                        input_message_content: {
                            message_text: `🔍 No wallpapers found for "${searchQuery}"\n\nTry searching with different keywords or check your spelling.`
                        }
                    }
                ], {
                    cache_time: 60,
                    is_personal: false
                });
                return;
            }

            // Convert wallpapers to inline results
            const results = wallpapers.slice(0, 15).map((wallpaper, index) => ({
                type: 'photo',
                id: wallpaper.id,
                photo_url: wallpaper.path,
                thumb_url: wallpaper.thumbs.small,
                photo_width: Math.min(wallpaper.dimension_x, 1920),
                photo_height: Math.min(wallpaper.dimension_y, 1080),
                title: `${wallpaper.resolution} • ${Math.round(wallpaper.file_size / 1024 / 1024 * 10) / 10}MB`,
                description: `Category: ${wallpaper.category} • Views: ${wallpaper.views}`,
                caption: this.buildWallpaperCaption(wallpaper, searchQuery),
                parse_mode: 'HTML'
            }));

            // Cache results
            this.setCachedResults(cacheKey, results);

            await this.bot.answerInlineQuery(query.id, results, {
                cache_time: 300,
                is_personal: false
            });

            this.log('Wallpaper search completed', { 
                query: searchQuery, 
                resultCount: results.length,
                userId: query.from.id 
            });

        } catch (error) {
            this.logError(error, { 
                context: 'Wallpaper search inline query',
                query: query.query,
                userId: query.from.id 
            });
            
            // Send error result
            await this.bot.answerInlineQuery(query.id, [
                {
                    type: 'article',
                    id: 'error',
                    title: 'Search Error',
                    description: 'An error occurred while searching for wallpapers.',
                    input_message_content: {
                        message_text: '❌ An error occurred while searching for wallpapers. Please try again.'
                    }
                }
            ], {
                cache_time: 10,
                is_personal: true
            });
        }
    }

    /**
     * Handle help for wallpaper search
     * @param {Object} query - Telegram inline query object
     */
    async handleWallpaperHelp(query) {
        try {
            const botInfo = await this.bot.getBotInfo();
            
            await this.bot.answerInlineQuery(query.id, [
                {
                    type: 'article',
                    id: 'wallhaven-help',
                    title: 'Wallhaven Wallpaper Search',
                    description: 'Search for high-quality wallpapers from wallhaven.cc',
                    input_message_content: {
                        message_text: `🖼️ <b>Wallhaven Wallpaper Search</b>\n\n` +
                                     `Use: <code>@${botInfo.username} .w [search terms]</code>\n\n` +
                                     `<b>Examples:</b>\n` +
                                     `<code>@${botInfo.username} .w nature mountains</code>\n` +
                                     `<code>@${botInfo.username} .w anime cyberpunk</code>\n` +
                                     `<code>@${botInfo.username} .w space galaxy</code>\n\n` +
                                     `Features: HD quality, SFW content, multiple categories`,
                        parse_mode: 'HTML'
                    }
                },
                {
                    type: 'article',
                    id: 'search-tips',
                    title: 'Search Tips & Tricks',
                    description: 'Learn how to get better wallpaper search results',
                    input_message_content: {
                        message_text: `💡 <b>Wallpaper Search Tips</b>\n\n` +
                                     `<b>Basic Search:</b> <code>.w nature</code>\n` +
                                     `<b>Multiple Words:</b> <code>.w anime sunset</code>\n` +
                                     `<b>Exclude Words:</b> <code>.w cars -racing</code>\n` +
                                     `<b>Required Tags:</b> <code>.w +space +nebula</code>\n` +
                                     `<b>User Uploads:</b> <code>.w @username</code>\n` +
                                     `<b>File Type:</b> <code>.w type:png landscape</code>\n\n` +
                                     `All wallpapers are minimum 1920x1080 resolution!`,
                        parse_mode: 'HTML'
                    }
                }
            ], {
                cache_time: 3600,
                is_personal: false
            });

            this.log('Wallpaper help served', { userId: query.from.id });

        } catch (error) {
            this.logError(error, { 
                context: 'Wallpaper help inline query',
                userId: query.from.id 
            });
        }
    }

    /**
     * Search wallpapers using Wallhaven API
     * @param {string} query - Search query
     * @returns {Promise<Array>} Array of wallpaper objects
     */
    async searchWallpapers(query) {
        return new Promise((resolve, reject) => {
            try {
                // Build search URL with parameters
                const baseUrl = 'https://wallhaven.cc/api/v1/search';
                const params = new URLSearchParams({
                    ...this.defaultParams,
                    q: query
                });
                
                const searchUrl = `${baseUrl}?${params.toString()}`;
                
                this.log('Making Wallhaven API request', { url: searchUrl });

                const request = https.get(searchUrl, {
                    headers: {
                        'User-Agent': 'TelegramBot/1.0 (Wallhaven Module)',
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
                            
                            if (!result.data || !Array.isArray(result.data)) {
                                throw new Error('Invalid API response format');
                            }
                            
                            this.log('Wallhaven API response received', { 
                                resultCount: result.data.length,
                                totalResults: result.meta?.total || 0
                            });
                            
                            resolve(result.data);
                            
                        } catch (parseError) {
                            this.logError(parseError, { 
                                context: 'Parse Wallhaven API response',
                                statusCode: response.statusCode,
                                dataLength: data.length
                            });
                            reject(parseError);
                        }
                    });
                });
                
                request.on('error', (error) => {
                    this.logError(error, { context: 'Wallhaven API request' });
                    reject(error);
                });
                
                request.setTimeout(10000, () => {
                    request.destroy();
                    reject(new Error('Request timeout'));
                });
                
            } catch (error) {
                this.logError(error, { context: 'Build Wallhaven API request' });
                reject(error);
            }
        });
    }

    /**
     * Build caption for wallpaper
     * @param {Object} wallpaper - Wallpaper data from API
     * @param {string} searchQuery - Original search query
     * @returns {string} Formatted caption
     */
    buildWallpaperCaption(wallpaper, searchQuery) {
        let caption = `🖼️ <b>${wallpaper.resolution}</b> wallpaper\n`;
        caption += `📁 ${wallpaper.file_size ? Math.round(wallpaper.file_size / 1024 / 1024 * 10) / 10 + 'MB' : 'Unknown size'} • `;
        caption += `📂 ${wallpaper.category || 'Unknown'}\n`;
        
        if (wallpaper.views) {
            caption += `👁️ ${wallpaper.views.toLocaleString()} views`;
        }
        
        if (wallpaper.favorites) {
            caption += ` • ❤️ ${wallpaper.favorites} favorites`;
        }
        
        caption += `\n\n🔗 <a href="${wallpaper.url}">View on Wallhaven</a>`;
        caption += `\n🔍 Searched: "${this.escapeHtml(searchQuery)}"`;
        
        return caption;
    }

    /**
     * Get cached search results
     * @param {string} cacheKey - Cache key
     * @returns {Array|null} Cached results or null
     */
    getCachedResults(cacheKey) {
        const cached = this.searchCache.get(cacheKey);
        if (!cached) return null;
        
        // Check if cache has expired
        if (Date.now() - cached.timestamp > this.cacheTimeout) {
            this.searchCache.delete(cacheKey);
            return null;
        }
        
        return cached.results;
    }

    /**
     * Set cached search results
     * @param {string} cacheKey - Cache key
     * @param {Array} results - Results to cache
     */
    setCachedResults(cacheKey, results) {
        // Clean old cache entries if cache gets too large
        if (this.searchCache.size > 50) {
            const oldestKey = this.searchCache.keys().next().value;
            this.searchCache.delete(oldestKey);
        }
        
        this.searchCache.set(cacheKey, {
            results,
            timestamp: Date.now()
        });
    }

    /**
     * Clean up module
     */
    async cleanup() {
        await super.cleanup();
        this.searchCache.clear();
    }
}

module.exports = WallhavenModule;
