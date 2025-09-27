/**
 * Anime Module
 *
 * Provides anime, manga, and character search functionality using Jikan API.
 * Commands: /anime, /manga, /character with pagination and ID search.
 *
 * @module modules/anime
 */

const BaseModule = require('../core/BaseModule');
const https = require('https');

/**
 * Anime Module class
 */
class AnimeModule extends BaseModule {
    constructor(bot) {
        super(bot);
        this.name = 'Anime';
        this.version = '1.0.0';
        this.description = 'Search anime, manga, and characters using MyAnimeList data';
        
        // API configuration
        this.apiBase = 'https://api.jikan.moe/v4';
        this.requestDelay = 350; // 350ms delay between requests to respect rate limits
        this.lastRequestTime = 0;
        
        // Cache for API responses
        this.cache = new Map();
        this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
        
        // Items per page for search results
        this.itemsPerPage = 5;
    }

    /**
     * Initialize the module
     */
    async init() {
        await super.init();
        
        // Register commands
        this.registerCommands([
            {
                command: 'anime',
                handler: this.handleAnimeSearch,
                options: {
                    description: 'Search for anime information or get by ID',
                    usage: '/anime <search query> or /anime id:<mal_id>',
                    permission: 'public'
                }
            },
            {
                command: 'manga',
                handler: this.handleMangaSearch,
                options: {
                    description: 'Search for manga information or get by ID',
                    usage: '/manga <search query> or /manga id:<mal_id>',
                    permission: 'public'
                }
            },
            {
                command: 'character',
                handler: this.handleCharacterSearch,
                options: {
                    description: 'Search for character information or get by ID',
                    usage: '/character <search query> or /character id:<mal_id>',
                    permission: 'public'
                }
            }
        ]);

        // Register callback handlers
        this.bot.registerCallbackHandler(/^anime:/, this.handleAnimeCallback.bind(this), {
            module: this.name,
            permission: 'public'
        });

        this.bot.registerCallbackHandler(/^manga:/, this.handleMangaCallback.bind(this), {
            module: this.name,
            permission: 'public'
        });

        this.bot.registerCallbackHandler(/^character:/, this.handleCharacterCallback.bind(this), {
            module: this.name,
            permission: 'public'
        });
        
        this.log('Anime module initialized with Jikan API integration');
    }

    /**
     * Handle anime search command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handleAnimeSearch(msg, args) {
        try {
            if (args.length === 0) {
                await this.reply(msg, '🔍 Please provide a search query or ID.\n\n<b>Examples:</b>\n<code>/anime naruto</code>\n<code>/anime id:1535</code>');
                return;
            }

            const query = args.join(' ');
            
            // Check if it's an ID search
            if (query.toLowerCase().startsWith('id:')) {
                const animeId = query.substring(3).trim();
                if (!/^\d+$/.test(animeId)) {
                    await this.reply(msg, '❌ Invalid ID format. Use: <code>/anime id:123</code>');
                    return;
                }
                
                const searchMessage = await this.reply(msg, '🔍 Getting anime details...');
                const anime = await this.getAnimeById(animeId);
                
                if (!anime) {
                    await this.bot.editMessageText(msg.chat.id, searchMessage.message_id, 
                        `❌ No anime found with ID: ${animeId}`);
                    return;
                }
                
                await this.showAnimeDetails(msg.chat.id, searchMessage.message_id, anime);
                this.log('Anime ID lookup executed', { userId: msg.from.id, animeId });
                return;
            }
            
            // Regular search
            const searchMessage = await this.reply(msg, '🔍 Searching for anime...');
            const results = await this.searchAnime(query, 1);
            
            if (!results || results.length === 0) {
                await this.bot.editMessageText(msg.chat.id, searchMessage.message_id, 
                    `❌ No anime found for "${this.escapeHtml(query)}"`);
                return;
            }

            await this.showAnimeResults(msg.chat.id, searchMessage.message_id, query, results, 1);
            
            this.log('Anime search executed', { userId: msg.from.id, query, resultCount: results.length });
        } catch (error) {
            this.logError(error, { command: 'anime', userId: msg.from.id, query: args.join(' ') });
            await this.reply(msg, '❌ An error occurred while searching for anime.');
        }
    }

    /**
     * Handle manga search command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handleMangaSearch(msg, args) {
        try {
            if (args.length === 0) {
                await this.reply(msg, '🔍 Please provide a search query or ID.\n\n<b>Examples:</b>\n<code>/manga one piece</code>\n<code>/manga id:13</code>');
                return;
            }

            const query = args.join(' ');
            
            // Check if it's an ID search
            if (query.toLowerCase().startsWith('id:')) {
                const mangaId = query.substring(3).trim();
                if (!/^\d+$/.test(mangaId)) {
                    await this.reply(msg, '❌ Invalid ID format. Use: <code>/manga id:123</code>');
                    return;
                }
                
                const searchMessage = await this.reply(msg, '🔍 Getting manga details...');
                const manga = await this.getMangaById(mangaId);
                
                if (!manga) {
                    await this.bot.editMessageText(msg.chat.id, searchMessage.message_id, 
                        `❌ No manga found with ID: ${mangaId}`);
                    return;
                }
                
                await this.showMangaDetails(msg.chat.id, searchMessage.message_id, manga);
                this.log('Manga ID lookup executed', { userId: msg.from.id, mangaId });
                return;
            }
            
            // Regular search
            const searchMessage = await this.reply(msg, '🔍 Searching for manga...');
            const results = await this.searchManga(query, 1);
            
            if (!results || results.length === 0) {
                await this.bot.editMessageText(msg.chat.id, searchMessage.message_id, 
                    `❌ No manga found for "${this.escapeHtml(query)}"`);
                return;
            }

            await this.showMangaResults(msg.chat.id, searchMessage.message_id, query, results, 1);
            
            this.log('Manga search executed', { userId: msg.from.id, query, resultCount: results.length });
        } catch (error) {
            this.logError(error, { command: 'manga', userId: msg.from.id, query: args.join(' ') });
            await this.reply(msg, '❌ An error occurred while searching for manga.');
        }
    }

    /**
     * Handle character search command
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     */
    async handleCharacterSearch(msg, args) {
        try {
            if (args.length === 0) {
                await this.reply(msg, '🔍 Please provide a search query or ID.\n\n<b>Examples:</b>\n<code>/character luffy</code>\n<code>/character id:40</code>');
                return;
            }

            const query = args.join(' ');
            
            // Check if it's an ID search
            if (query.toLowerCase().startsWith('id:')) {
                const characterId = query.substring(3).trim();
                if (!/^\d+$/.test(characterId)) {
                    await this.reply(msg, '❌ Invalid ID format. Use: <code>/character id:123</code>');
                    return;
                }
                
                const searchMessage = await this.reply(msg, '🔍 Getting character details...');
                const character = await this.getCharacterById(characterId);
                
                if (!character) {
                    await this.bot.editMessageText(msg.chat.id, searchMessage.message_id, 
                        `❌ No character found with ID: ${characterId}`);
                    return;
                }
                
                await this.showCharacterDetails(msg.chat.id, searchMessage.message_id, character);
                this.log('Character ID lookup executed', { userId: msg.from.id, characterId });
                return;
            }
            
            // Regular search
            const searchMessage = await this.reply(msg, '🔍 Searching for characters...');
            const results = await this.searchCharacters(query, 1);
            
            if (!results || results.length === 0) {
                await this.bot.editMessageText(msg.chat.id, searchMessage.message_id, 
                    `❌ No characters found for "${this.escapeHtml(query)}"`);
                return;
            }

            // Start with the first character (page 1)
            await this.showCharacterResults(msg.chat.id, searchMessage.message_id, query, results, 1);
            
            this.log('Character search executed', { userId: msg.from.id, query, resultCount: results.length });
        } catch (error) {
            this.logError(error, { command: 'character', userId: msg.from.id, query: args.join(' ') });
            await this.reply(msg, '❌ An error occurred while searching for characters.');
        }
    }

    // === CALLBACK HANDLERS ===
    async handleAnimeCallback(query, data) {
        try {
            const parts = query.data.split(':');
            const action = parts[1];
            
            switch (action) {
                case 'search':
                    await this.handleAnimeSearchCallback(query, parts);
                    break;
                case 'show':
                    await this.handleAnimeShowCallback(query, parts);
                    break;
                case 'characters':
                    await this.handleAnimeCharactersCallback(query, parts);
                    break;
                case 'recommendations':
                    await this.handleAnimeRecommendationsCallback(query, parts);
                    break;
            }
            
            await this.bot.answerCallbackQuery(query.id);
        } catch (error) {
            this.logError(error, { context: 'Anime callback', data: query.data });
            await this.bot.answerCallbackQuery(query.id, 'An error occurred', true);
        }
    }

    async handleMangaCallback(query, data) {
        try {
            const parts = query.data.split(':');
            const action = parts[1];
            
            switch (action) {
                case 'search':
                    await this.handleMangaSearchCallback(query, parts);
                    break;
                case 'show':
                    await this.handleMangaShowCallback(query, parts);
                    break;
                case 'characters':
                    await this.handleMangaCharactersCallback(query, parts);
                    break;
                case 'recommendations':
                    await this.handleMangaRecommendationsCallback(query, parts);
                    break;
            }
            
            await this.bot.answerCallbackQuery(query.id);
        } catch (error) {
            this.logError(error, { context: 'Manga callback', data: query.data });
            await this.bot.answerCallbackQuery(query.id, 'An error occurred', true);
        }
    }

    async handleCharacterCallback(query, data) {
        try {
            const parts = query.data.split(':');
            const action = parts[1];
            
            switch (action) {
                case 'search':
                    await this.handleCharacterSearchCallback(query, parts);
                    break;
                case 'show':
                    await this.handleCharacterShowCallback(query, parts);
                    break;
            }
            
            await this.bot.answerCallbackQuery(query.id);
        } catch (error) {
            this.logError(error, { context: 'Character callback', data: query.data });
            await this.bot.answerCallbackQuery(query.id, 'An error occurred', true);
        }
    }

    // === CALLBACK IMPLEMENTATIONS ===
    async handleAnimeSearchCallback(query, parts) {
        const searchQuery = decodeURIComponent(parts[2]);
        const page = parseInt(parts[3]) || 1;
        
        const results = await this.searchAnime(searchQuery, page);
        await this.showAnimeResults(query.message.chat.id, query.message.message_id, searchQuery, results, page);
    }

    async handleAnimeShowCallback(query, parts) {
        const animeId = parts[2];
        const anime = await this.getAnimeById(animeId);
        
        if (anime) {
            await this.showAnimeDetails(query.message.chat.id, query.message.message_id, anime);
        }
    }

    async handleAnimeCharactersCallback(query, parts) {
        const animeId = parts[2];
        const page = parseInt(parts[3]) || 1;
        
        const characters = await this.getAnimeCharacters(animeId, page);
        const anime = await this.getAnimeById(animeId);
        
        if (characters && anime) {
            await this.showAnimeCharacters(query.message.chat.id, query.message.message_id, anime, characters, page);
        }
    }

    async handleAnimeRecommendationsCallback(query, parts) {
        const animeId = parts[2];
        const page = parseInt(parts[3]) || 1;
        
        const recommendations = await this.getAnimeRecommendations(animeId);
        const anime = await this.getAnimeById(animeId);
        
        if (recommendations && anime) {
            await this.showAnimeRecommendations(query.message.chat.id, query.message.message_id, anime, recommendations, page);
        }
    }

    async handleMangaSearchCallback(query, parts) {
        const searchQuery = decodeURIComponent(parts[2]);
        const page = parseInt(parts[3]) || 1;
        
        const results = await this.searchManga(searchQuery, page);
        await this.showMangaResults(query.message.chat.id, query.message.message_id, searchQuery, results, page);
    }

    async handleMangaShowCallback(query, parts) {
        const mangaId = parts[2];
        const manga = await this.getMangaById(mangaId);
        
        if (manga) {
            await this.showMangaDetails(query.message.chat.id, query.message.message_id, manga);
        }
    }

    async handleMangaCharactersCallback(query, parts) {
        const mangaId = parts[2];
        const page = parseInt(parts[3]) || 1;
        
        const characters = await this.getMangaCharacters(mangaId, page);
        const manga = await this.getMangaById(mangaId);
        
        if (characters && manga) {
            await this.showMangaCharacters(query.message.chat.id, query.message.message_id, manga, characters, page);
        }
    }

    async handleMangaRecommendationsCallback(query, parts) {
        const mangaId = parts[2];
        const page = parseInt(parts[3]) || 1;
        
        const recommendations = await this.getMangaRecommendations(mangaId);
        const manga = await this.getMangaById(mangaId);
        
        if (recommendations && manga) {
            await this.showMangaRecommendations(query.message.chat.id, query.message.message_id, manga, recommendations, page);
        }
    }

    async handleCharacterSearchCallback(query, parts) {
        const searchQuery = decodeURIComponent(parts[2]);
        const page = parseInt(parts[3]) || 1;
        
        const results = await this.searchCharacters(searchQuery, 1);
        await this.showCharacterResults(query.message.chat.id, query.message.message_id, searchQuery, results, page);
    }

    async handleCharacterShowCallback(query, parts) {
        const characterId = parts[2];
        const character = await this.getCharacterById(characterId);
        
        if (character) {
            await this.showCharacterDetails(query.message.chat.id, query.message.message_id, character);
        }
    }

    // === API METHODS ===
    async makeApiRequest(endpoint) {
        const cacheKey = `jikan:${endpoint}`;
        const cached = this.getFromCache(cacheKey);
        
        if (cached) {
            return cached;
        }

        // Rate limiting
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.requestDelay) {
            await this.sleep(this.requestDelay - timeSinceLastRequest);
        }
        this.lastRequestTime = Date.now();

        return new Promise((resolve, reject) => {
            const url = `${this.apiBase}${endpoint}`;
            
            https.get(url, {
                headers: {
                    'User-Agent': 'TelegramBot/1.0 (Anime Module)',
                    'Accept': 'application/json'
                }
            }, (response) => {
                let data = '';
                
                response.on('data', (chunk) => {
                    data += chunk;
                });
                
                response.on('end', () => {
                    try {
                        if (response.statusCode === 429) {
                            this.logError(new Error('Rate limited by Jikan API'), { endpoint });
                            reject(new Error('Rate limited'));
                            return;
                        }
                        
                        if (response.statusCode !== 200) {
                            throw new Error(`API returned status ${response.statusCode}`);
                        }
                        
                        const result = JSON.parse(data);
                        this.setCache(cacheKey, result);
                        resolve(result);
                        
                    } catch (parseError) {
                        this.logError(parseError, { endpoint, statusCode: response.statusCode });
                        reject(parseError);
                    }
                });
            }).on('error', (error) => {
                this.logError(error, { endpoint });
                reject(error);
            });
        });
    }

    async searchAnime(query, page = 1) {
        try {
            const response = await this.makeApiRequest(`/anime?q=${encodeURIComponent(query)}&limit=${this.itemsPerPage}&page=${page}`);
            return response.data || [];
        } catch (error) {
            this.logError(error, { context: 'Search anime', query, page });
            return [];
        }
    }

    async searchManga(query, page = 1) {
        try {
            const response = await this.makeApiRequest(`/manga?q=${encodeURIComponent(query)}&limit=${this.itemsPerPage}&page=${page}`);
            return response.data || [];
        } catch (error) {
            this.logError(error, { context: 'Search manga', query, page });
            return [];
        }
    }

    async searchCharacters(query, page = 1) {
        try {
            // Get more results since we're showing one at a time
            const response = await this.makeApiRequest(`/characters?q=${encodeURIComponent(query)}&limit=25&page=${page}`);
            return response.data || [];
        } catch (error) {
            this.logError(error, { context: 'Search characters', query, page });
            return [];
        }
    }

    async getAnimeById(id) {
        try {
            const response = await this.makeApiRequest(`/anime/${id}/full`);
            return response.data;
        } catch (error) {
            this.logError(error, { context: 'Get anime by ID', id });
            return null;
        }
    }

    async getMangaById(id) {
        try {
            const response = await this.makeApiRequest(`/manga/${id}/full`);
            return response.data;
        } catch (error) {
            this.logError(error, { context: 'Get manga by ID', id });
            return null;
        }
    }

    async getCharacterById(id) {
        try {
            const response = await this.makeApiRequest(`/characters/${id}/full`);
            return response.data;
        } catch (error) {
            this.logError(error, { context: 'Get character by ID', id });
            return null;
        }
    }

    async getAnimeCharacters(animeId, page = 1) {
        try {
            const response = await this.makeApiRequest(`/anime/${animeId}/characters`);
            return response.data || [];
        } catch (error) {
            this.logError(error, { context: 'Get anime characters', animeId, page });
            return [];
        }
    }

    async getMangaCharacters(mangaId, page = 1) {
        try {
            const response = await this.makeApiRequest(`/manga/${mangaId}/characters`);
            return response.data || [];
        } catch (error) {
            this.logError(error, { context: 'Get manga characters', mangaId, page });
            return [];
        }
    }

    async getAnimeRecommendations(animeId) {
        try {
            const response = await this.makeApiRequest(`/anime/${animeId}/recommendations`);
            return response.data || [];
        } catch (error) {
            this.logError(error, { context: 'Get anime recommendations', animeId });
            return [];
        }
    }

    async getMangaRecommendations(mangaId) {
        try {
            const response = await this.makeApiRequest(`/manga/${mangaId}/recommendations`);
            return response.data || [];
        } catch (error) {
            this.logError(error, { context: 'Get manga recommendations', mangaId });
            return [];
        }
    }

    // === DISPLAY METHODS ===
    async showAnimeResults(chatId, messageId, query, results, page) {
        const totalPages = Math.ceil(results.length / this.itemsPerPage) || 1;
        const startIndex = (page - 1) * this.itemsPerPage;
        const pageResults = results.slice(0, this.itemsPerPage);

        let text = `🎌 <b>Anime Search Results</b> for "${this.escapeHtml(query)}"\n`;
        text += `📄 Page ${page} of ${totalPages}\n\n`;

        pageResults.forEach((anime, index) => {
            const num = startIndex + index + 1;
            const title = anime.title || anime.title_english || 'Unknown Title';
            const year = anime.year || 'N/A';
            const score = anime.score || 'N/A';
            const type = anime.type || 'Unknown';
            
            text += `${num}. <b>${this.escapeHtml(title)}</b>\n`;
            text += `   📅 ${year} • 📺 ${type} • ⭐ ${score}\n\n`;
        });

        // Create inline keyboard
        const keyboard = [];
        const buttonRow = [];
        
        // Navigation buttons
        if (page > 1) {
            buttonRow.push(this.bot.createInlineButton('◀ Previous', `anime:search:${encodeURIComponent(query)}:${page - 1}`));
        }
        if (results.length === this.itemsPerPage) {
            buttonRow.push(this.bot.createInlineButton('Next ▶', `anime:search:${encodeURIComponent(query)}:${page + 1}`));
        }
        if (buttonRow.length > 0) {
            keyboard.push(buttonRow);
        }

        // Selection buttons
        const selectRow = [];
        pageResults.forEach((anime, index) => {
            const num = startIndex + index + 1;
            selectRow.push(this.bot.createInlineButton(`${num}`, `anime:show:${anime.mal_id}`));
            if (selectRow.length === 5) {
                keyboard.push(selectRow.splice(0));
            }
        });
        if (selectRow.length > 0) {
            keyboard.push(selectRow);
        }

        const inlineKeyboard = this.bot.createInlineKeyboard(keyboard);

        await this.bot.editMessageText(chatId, messageId, text, {
            ...inlineKeyboard,
            parse_mode: 'HTML'
        });
    }

    async showMangaResults(chatId, messageId, query, results, page) {
        const totalPages = Math.ceil(results.length / this.itemsPerPage) || 1;
        const startIndex = (page - 1) * this.itemsPerPage;
        const pageResults = results.slice(0, this.itemsPerPage);

        let text = `📚 <b>Manga Search Results</b> for "${this.escapeHtml(query)}"\n`;
        text += `📄 Page ${page} of ${totalPages}\n\n`;

        pageResults.forEach((manga, index) => {
            const num = startIndex + index + 1;
            const title = manga.title || manga.title_english || 'Unknown Title';
            const year = manga.published?.from?.split('T')[0]?.split('-')[0] || 'N/A';
            const score = manga.score || 'N/A';
            const type = manga.type || 'Unknown';
            
            text += `${num}. <b>${this.escapeHtml(title)}</b>\n`;
            text += `   📅 ${year} • 📖 ${type} • ⭐ ${score}\n\n`;
        });

        // Create inline keyboard
        const keyboard = [];
        const buttonRow = [];
        
        // Navigation buttons
        if (page > 1) {
            buttonRow.push(this.bot.createInlineButton('◀ Previous', `manga:search:${encodeURIComponent(query)}:${page - 1}`));
        }
        if (results.length === this.itemsPerPage) {
            buttonRow.push(this.bot.createInlineButton('Next ▶', `manga:search:${encodeURIComponent(query)}:${page + 1}`));
        }
        if (buttonRow.length > 0) {
            keyboard.push(buttonRow);
        }

        // Selection buttons
        const selectRow = [];
        pageResults.forEach((manga, index) => {
            const num = startIndex + index + 1;
            selectRow.push(this.bot.createInlineButton(`${num}`, `manga:show:${manga.mal_id}`));
            if (selectRow.length === 5) {
                keyboard.push(selectRow.splice(0));
            }
        });
        if (selectRow.length > 0) {
            keyboard.push(selectRow);
        }

        const inlineKeyboard = this.bot.createInlineKeyboard(keyboard);

        await this.bot.editMessageText(chatId, messageId, text, {
            ...inlineKeyboard,
            parse_mode: 'HTML'
        });
    }

    async showCharacterResults(chatId, messageId, query, results, page) {
        const totalPages = results.length; // Each character gets its own page
        const characterIndex = page - 1; // Convert page to array index
        
        if (characterIndex >= results.length || characterIndex < 0) {
            await this.bot.editMessageText(chatId, messageId, 
                `❌ Page ${page} not found for "${this.escapeHtml(query)}"`);
            return;
        }

        const character = results[characterIndex];
        
        let text = `👤 <b>Character Search Results</b> for "${this.escapeHtml(query)}"\n`;
        text += `📄 Page ${page} of ${totalPages}\n\n`;
        text += `🔄 <i>Loading character details...</i>`;

        // Create initial keyboard
        const keyboard = [];
        const buttonRow = [];
        
        // Navigation buttons
        if (page > 1) {
            buttonRow.push(this.bot.createInlineButton('◀ Previous', `character:search:${encodeURIComponent(query)}:${page - 1}`));
        }
        if (page < totalPages) {
            buttonRow.push(this.bot.createInlineButton('Next ▶', `character:search:${encodeURIComponent(query)}:${page + 1}`));
        }
        if (buttonRow.length > 0) {
            keyboard.push(buttonRow);
        }

        // View details button
        keyboard.push([
            this.bot.createInlineButton('📖 View Full Details', `character:show:${character.mal_id}`)
        ]);

        const inlineKeyboard = this.bot.createInlineKeyboard(keyboard);

        // First update with loading message
        await this.bot.editMessageText(chatId, messageId, text, {
            ...inlineKeyboard,
            parse_mode: 'HTML'
        });

        try {
            // Fetch full character details to get anime/manga context
            const fullCharacter = await this.getCharacterById(character.mal_id);
            
            const name = character.name || 'Unknown Name';
            const nameKanji = character.name_kanji || '';
            const favorites = character.favorites || 0;
            
            // Get anime/manga context from full details
            let appearanceText = '';
            let contextDetails = '';
            
            if (fullCharacter) {
                if (fullCharacter.anime && fullCharacter.anime.length > 0) {
                    const firstAnime = fullCharacter.anime[0].anime.title;
                    const animeRole = fullCharacter.anime[0].role;
                    appearanceText = ` (${this.escapeHtml(firstAnime)})`;
                    contextDetails = `🎌 <b>Appears in:</b> ${this.escapeHtml(firstAnime)} (${animeRole})`;
                    
                    if (fullCharacter.anime.length > 1) {
                        contextDetails += `\n   <i>...and ${fullCharacter.anime.length - 1} more anime</i>`;
                    }
                } else if (fullCharacter.manga && fullCharacter.manga.length > 0) {
                    const firstManga = fullCharacter.manga[0].manga.title;
                    const mangaRole = fullCharacter.manga[0].role;
                    appearanceText = ` (${this.escapeHtml(firstManga)})`;
                    contextDetails = `📚 <b>Appears in:</b> ${this.escapeHtml(firstManga)} (${mangaRole})`;
                    
                    if (fullCharacter.manga.length > 1) {
                        contextDetails += `\n   <i>...and ${fullCharacter.manga.length - 1} more manga</i>`;
                    }
                }
            }

            // Build final text with full context
            let finalText = `👤 <b>Character Search Results</b> for "${this.escapeHtml(query)}"\n`;
            finalText += `📄 Page ${page} of ${totalPages}\n\n`;
            
            finalText += `<b>${this.escapeHtml(name)}</b>${appearanceText}\n`;
            if (nameKanji) {
                finalText += `${this.escapeHtml(nameKanji)}\n`;
            }
            finalText += `❤️ ${favorites.toLocaleString()} favorites\n\n`;
            
            if (contextDetails) {
                finalText += `${contextDetails}\n\n`;
            }
            
            // Add brief description if available
            if (fullCharacter && fullCharacter.about) {
                const shortAbout = fullCharacter.about.length > 200 
                    ? fullCharacter.about.substring(0, 200) + '...' 
                    : fullCharacter.about;
                finalText += `📖 <b>About:</b>\n${this.escapeHtml(shortAbout)}`;
            }

            // Update with full information
            await this.bot.editMessageText(chatId, messageId, finalText, {
                ...inlineKeyboard,
                parse_mode: 'HTML'
            });

        } catch (error) {
            this.logError(error, { context: 'Character details loading', characterId: character.mal_id });
            
            // Fallback to basic info if detail loading fails
            let fallbackText = `👤 <b>Character Search Results</b> for "${this.escapeHtml(query)}"\n`;
            fallbackText += `📄 Page ${page} of ${totalPages}\n\n`;
            fallbackText += `<b>${this.escapeHtml(character.name)}</b>\n`;
            if (character.name_kanji) {
                fallbackText += `${this.escapeHtml(character.name_kanji)}\n`;
            }
            fallbackText += `❤️ ${character.favorites ? character.favorites.toLocaleString() : 0} favorites\n\n`;
            fallbackText += `<i>Could not load additional details</i>`;

            await this.bot.editMessageText(chatId, messageId, fallbackText, {
                ...inlineKeyboard,
                parse_mode: 'HTML'
            });
        }
    }

    async showAnimeDetails(chatId, messageId, anime) {
        const title = anime.title || anime.title_english || 'Unknown Title';
        const titleEng = anime.title_english && anime.title_english !== title ? anime.title_english : '';
        const titleJap = anime.title_japanese || '';
        const synopsis = anime.synopsis ? (anime.synopsis.length > 300 ? anime.synopsis.substring(0, 300) + '...' : anime.synopsis) : 'No synopsis available.';
        
        let text = `🎌 <b>${this.escapeHtml(title)}</b>\n`;
        if (titleEng) text += `<i>${this.escapeHtml(titleEng)}</i>\n`;
        if (titleJap) text += `${this.escapeHtml(titleJap)}\n`;
        text += '\n';

        // Basic info
        text += `📺 <b>Type:</b> ${anime.type || 'N/A'}\n`;
        text += `📅 <b>Year:</b> ${anime.year || 'N/A'}\n`;
        text += `📊 <b>Status:</b> ${anime.status || 'N/A'}\n`;
        text += `🎬 <b>Episodes:</b> ${anime.episodes || 'N/A'}\n`;
        text += `⭐ <b>Score:</b> ${anime.score || 'N/A'}/10\n`;
        text += `👥 <b>Members:</b> ${anime.members ? anime.members.toLocaleString() : 'N/A'}\n`;
        
        // Genres
        if (anime.genres && anime.genres.length > 0) {
            const genres = anime.genres.map(g => g.name).slice(0, 3).join(', ');
            text += `🏷️ <b>Genres:</b> ${this.escapeHtml(genres)}\n`;
        }
        
        // Studios
        if (anime.studios && anime.studios.length > 0) {
            const studios = anime.studios.map(s => s.name).slice(0, 2).join(', ');
            text += `🏢 <b>Studio:</b> ${this.escapeHtml(studios)}\n`;
        }
        
        text += `\n📖 <b>Synopsis:</b>\n${this.escapeHtml(synopsis)}`;

        // Create inline keyboard
        const keyboard = [
            [
                this.bot.createInlineButton('👥 Characters', `anime:characters:${anime.mal_id}:1`),
                this.bot.createInlineButton('💡 Recommendations', `anime:recommendations:${anime.mal_id}:1`)
            ],
            [
                this.bot.createUrlButton('📱 View on MAL', anime.url)
            ]
        ];

        const inlineKeyboard = this.bot.createInlineKeyboard(keyboard);

        await this.bot.editMessageText(chatId, messageId, text, {
            ...inlineKeyboard,
            parse_mode: 'HTML'
        });
    }

    async showMangaDetails(chatId, messageId, manga) {
        const title = manga.title || manga.title_english || 'Unknown Title';
        const titleEng = manga.title_english && manga.title_english !== title ? manga.title_english : '';
        const titleJap = manga.title_japanese || '';
        const synopsis = manga.synopsis ? (manga.synopsis.length > 300 ? manga.synopsis.substring(0, 300) + '...' : manga.synopsis) : 'No synopsis available.';
        
        let text = `📚 <b>${this.escapeHtml(title)}</b>\n`;
        if (titleEng) text += `<i>${this.escapeHtml(titleEng)}</i>\n`;
        if (titleJap) text += `${this.escapeHtml(titleJap)}\n`;
        text += '\n';

        // Basic info
        text += `📖 <b>Type:</b> ${manga.type || 'N/A'}\n`;
        text += `📅 <b>Published:</b> ${manga.published?.from?.split('T')[0] || 'N/A'}\n`;
        text += `📊 <b>Status:</b> ${manga.status || 'N/A'}\n`;
        text += `📑 <b>Chapters:</b> ${manga.chapters || 'N/A'}\n`;
        text += `📚 <b>Volumes:</b> ${manga.volumes || 'N/A'}\n`;
        text += `⭐ <b>Score:</b> ${manga.score || 'N/A'}/10\n`;
        text += `👥 <b>Members:</b> ${manga.members ? manga.members.toLocaleString() : 'N/A'}\n`;
        
        // Genres
        if (manga.genres && manga.genres.length > 0) {
            const genres = manga.genres.map(g => g.name).slice(0, 3).join(', ');
            text += `🏷️ <b>Genres:</b> ${this.escapeHtml(genres)}\n`;
        }
        
        // Authors
        if (manga.authors && manga.authors.length > 0) {
            const authors = manga.authors.map(a => a.name).slice(0, 2).join(', ');
            text += `✍️ <b>Author:</b> ${this.escapeHtml(authors)}\n`;
        }
        
        text += `\n📖 <b>Synopsis:</b>\n${this.escapeHtml(synopsis)}`;

        // Create inline keyboard
        const keyboard = [
            [
                this.bot.createInlineButton('👥 Characters', `manga:characters:${manga.mal_id}:1`),
                this.bot.createInlineButton('💡 Recommendations', `manga:recommendations:${manga.mal_id}:1`)
            ],
            [
                this.bot.createUrlButton('📱 View on MAL', manga.url)
            ]
        ];

        const inlineKeyboard = this.bot.createInlineKeyboard(keyboard);

        await this.bot.editMessageText(chatId, messageId, text, {
            ...inlineKeyboard,
            parse_mode: 'HTML'
        });
    }

    async showCharacterDetails(chatId, messageId, character) {
        const name = character.name || 'Unknown Name';
        const nameKanji = character.name_kanji || '';
        const nicknames = character.nicknames ? character.nicknames.slice(0, 3).join(', ') : '';
        const about = character.about ? (character.about.length > 400 ? character.about.substring(0, 400) + '...' : character.about) : 'No description available.';
        
        let text = `👤 <b>${this.escapeHtml(name)}</b>\n`;
        if (nameKanji) text += `${this.escapeHtml(nameKanji)}\n`;
        if (nicknames) text += `<i>Also known as: ${this.escapeHtml(nicknames)}</i>\n`;
        text += '\n';

        text += `❤️ <b>Favorites:</b> ${character.favorites ? character.favorites.toLocaleString() : 'N/A'}\n\n`;
        
        // Anime appearances
        if (character.anime && character.anime.length > 0) {
            const animeList = character.anime.slice(0, 3).map(a => a.anime.title).join(', ');
            text += `🎌 <b>Appears in:</b> ${this.escapeHtml(animeList)}\n`;
            if (character.anime.length > 3) {
                text += `   <i>...and ${character.anime.length - 3} more</i>\n`;
            }
            text += '\n';
        }
        
        text += `📖 <b>About:</b>\n${this.escapeHtml(about)}`;

        // Create inline keyboard
        const keyboard = [
            [
                this.bot.createUrlButton('📱 View on MAL', character.url)
            ]
        ];

        const inlineKeyboard = this.bot.createInlineKeyboard(keyboard);

        await this.bot.editMessageText(chatId, messageId, text, {
            ...inlineKeyboard,
            parse_mode: 'HTML'
        });
    }

    async showAnimeCharacters(chatId, messageId, anime, characters, page) {
        const itemsPerPage = 8;
        const totalPages = Math.ceil(characters.length / itemsPerPage);
        const startIndex = (page - 1) * itemsPerPage;
        const pageCharacters = characters.slice(startIndex, startIndex + itemsPerPage);

        let text = `👥 <b>Characters from ${this.escapeHtml(anime.title)}</b>\n`;
        text += `📄 Page ${page} of ${totalPages}\n\n`;

        pageCharacters.forEach((char, index) => {
            const name = char.character.name;
            const role = char.role;
            
            text += `${startIndex + index + 1}. <b>${this.escapeHtml(name)}</b> (${role})\n`;
        });

        // Create inline keyboard
        const keyboard = [];
        
        // Navigation
        const navRow = [];
        if (page > 1) {
            navRow.push(this.bot.createInlineButton('◀ Previous', `anime:characters:${anime.mal_id}:${page - 1}`));
        }
        navRow.push(this.bot.createInlineButton('🔙 Back to Anime', `anime:show:${anime.mal_id}`));
        if (page < totalPages) {
            navRow.push(this.bot.createInlineButton('Next ▶', `anime:characters:${anime.mal_id}:${page + 1}`));
        }
        keyboard.push(navRow);

        const inlineKeyboard = this.bot.createInlineKeyboard(keyboard);

        await this.bot.editMessageText(chatId, messageId, text, {
            ...inlineKeyboard,
            parse_mode: 'HTML'
        });
    }

    async showMangaCharacters(chatId, messageId, manga, characters, page) {
        const itemsPerPage = 8;
        const totalPages = Math.ceil(characters.length / itemsPerPage);
        const startIndex = (page - 1) * itemsPerPage;
        const pageCharacters = characters.slice(startIndex, startIndex + itemsPerPage);

        let text = `👥 <b>Characters from ${this.escapeHtml(manga.title)}</b>\n`;
        text += `📄 Page ${page} of ${totalPages}\n\n`;

        pageCharacters.forEach((char, index) => {
            const name = char.character.name;
            const role = char.role;
            
            text += `${startIndex + index + 1}. <b>${this.escapeHtml(name)}</b> (${role})\n`;
        });

        // Create inline keyboard
        const keyboard = [];
        
        // Navigation
        const navRow = [];
        if (page > 1) {
            navRow.push(this.bot.createInlineButton('◀ Previous', `manga:characters:${manga.mal_id}:${page - 1}`));
        }
        navRow.push(this.bot.createInlineButton('🔙 Back to Manga', `manga:show:${manga.mal_id}`));
        if (page < totalPages) {
            navRow.push(this.bot.createInlineButton('Next ▶', `manga:characters:${manga.mal_id}:${page + 1}`));
        }
        keyboard.push(navRow);

        const inlineKeyboard = this.bot.createInlineKeyboard(keyboard);

        await this.bot.editMessageText(chatId, messageId, text, {
            ...inlineKeyboard,
            parse_mode: 'HTML'
        });
    }

    async showAnimeRecommendations(chatId, messageId, anime, recommendations, page) {
        const itemsPerPage = 5;
        const totalPages = Math.ceil(recommendations.length / itemsPerPage);
        const startIndex = (page - 1) * itemsPerPage;
        const pageRecommendations = recommendations.slice(startIndex, startIndex + itemsPerPage);

        let text = `💡 <b>Recommendations for ${this.escapeHtml(anime.title)}</b>\n`;
        text += `📄 Page ${page} of ${totalPages}\n\n`;

        pageRecommendations.forEach((rec, index) => {
            const title = rec.entry.title;
            const votes = rec.votes || 0;
            
            text += `${startIndex + index + 1}. <b>${this.escapeHtml(title)}</b>\n`;
            text += `   👍 ${votes} recommendations\n\n`;
        });

        // Create inline keyboard
        const keyboard = [];
        
        // Navigation
        const navRow = [];
        if (page > 1) {
            navRow.push(this.bot.createInlineButton('◀ Previous', `anime:recommendations:${anime.mal_id}:${page - 1}`));
        }
        navRow.push(this.bot.createInlineButton('🔙 Back to Anime', `anime:show:${anime.mal_id}`));
        if (page < totalPages) {
            navRow.push(this.bot.createInlineButton('Next ▶', `anime:recommendations:${anime.mal_id}:${page + 1}`));
        }
        keyboard.push(navRow);

        // Selection buttons
        const selectRow = [];
        pageRecommendations.forEach((rec, index) => {
            const num = startIndex + index + 1;
            selectRow.push(this.bot.createInlineButton(`${num}`, `anime:show:${rec.entry.mal_id}`));
        });
        if (selectRow.length > 0) {
            keyboard.push(selectRow);
        }

        const inlineKeyboard = this.bot.createInlineKeyboard(keyboard);

        await this.bot.editMessageText(chatId, messageId, text, {
            ...inlineKeyboard,
            parse_mode: 'HTML'
        });
    }

    async showMangaRecommendations(chatId, messageId, manga, recommendations, page) {
        const itemsPerPage = 5;
        const totalPages = Math.ceil(recommendations.length / itemsPerPage);
        const startIndex = (page - 1) * itemsPerPage;
        const pageRecommendations = recommendations.slice(startIndex, startIndex + itemsPerPage);

        let text = `💡 <b>Recommendations for ${this.escapeHtml(manga.title)}</b>\n`;
        text += `📄 Page ${page} of ${totalPages}\n\n`;

        pageRecommendations.forEach((rec, index) => {
            const title = rec.entry.title;
            const votes = rec.votes || 0;
            
            text += `${startIndex + index + 1}. <b>${this.escapeHtml(title)}</b>\n`;
            text += `   👍 ${votes} recommendations\n\n`;
        });

        // Create inline keyboard
        const keyboard = [];
        
        // Navigation
        const navRow = [];
        if (page > 1) {
            navRow.push(this.bot.createInlineButton('◀ Previous', `manga:recommendations:${manga.mal_id}:${page - 1}`));
        }
        navRow.push(this.bot.createInlineButton('🔙 Back to Manga', `manga:show:${manga.mal_id}`));
        if (page < totalPages) {
            navRow.push(this.bot.createInlineButton('Next ▶', `manga:recommendations:${manga.mal_id}:${page + 1}`));
        }
        keyboard.push(navRow);

        // Selection buttons
        const selectRow = [];
        pageRecommendations.forEach((rec, index) => {
            const num = startIndex + index + 1;
            selectRow.push(this.bot.createInlineButton(`${num}`, `manga:show:${rec.entry.mal_id}`));
        });
        if (selectRow.length > 0) {
            keyboard.push(selectRow);
        }

        const inlineKeyboard = this.bot.createInlineKeyboard(keyboard);

        await this.bot.editMessageText(chatId, messageId, text, {
            ...inlineKeyboard,
            parse_mode: 'HTML'
        });
    }

    // === UTILITY METHODS ===
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > this.cacheTimeout) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }

    setCache(key, data) {
        // Clean old cache entries if cache gets too large
        if (this.cache.size > 200) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        
        this.cache.set(key, {
            data,
            timestamp: Date.now()
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

module.exports = AnimeModule;
