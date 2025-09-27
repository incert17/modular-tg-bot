/**
 * URL Utils Module v1.1.0
 * 
 * Provides a suite of tools for URL analysis and manipulation, including
 * status checking, security scanning, cleaning, unshortening, and downloading.
 * This version dynamically fetches and caches the latest ClearURLs rule catalog.
 * 
 * @module modules/url
 */

const BaseModule = require('../core/BaseModule');
const { config } = require('../utils/config');
const axios = require('axios');
const { URL, URLSearchParams } = require('url');

const CLEARURLS_CATALOG_URL = 'https://rules2.clearurls.xyz/data.minify.json';

class UrlUtilsModule extends BaseModule {
    constructor(bot) {
        super(bot);
        this.name = 'URL';
        this.version = '1.1.0';
        this.description = 'A suite of tools for URL analysis and manipulation.';
        this.vtApiKey = config.VIRUSTOTAL_API_KEY;
        this.clearUrlsRules = null; // This will be populated on init
    }

    /**
     * Escapes HTML special characters for safe embedding.
     */
    _escapeHtml(str) {
        if (typeof str !== 'string' || !str) return '';
        return str.replace(/[&<>"']/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match]));
    }

    /**
     * Fetches the ClearURLs rules catalog on startup and caches it.
     */
    async _loadClearUrlsRules() {
        try {
            this.log('Fetching latest ClearURLs rule catalog...');
            const response = await axios.get(CLEARURLS_CATALOG_URL);
            if (response.data && response.data.providers) {
                this.clearUrlsRules = response.data.providers;
                this.log(`Successfully loaded ${Object.keys(this.clearUrlsRules).length} providers from ClearURLs catalog.`);
            } else {
                throw new Error('Invalid catalog format received from ClearURLs.');
            }
        } catch (error) {
            this.logError(error, { context: 'clearurls-fetch-failure' });
            this.clearUrlsRules = {}; // Set to empty to prevent crashes on /cl command
        }
    }

    /**
     * Initializes the module, loads rules, and registers all commands.
     */
    async init() {
        await super.init();
        await this._loadClearUrlsRules(); // Load rules only once on startup

        this.registerCommands([
            { command: 'st', handler: this.handleStatus, options: { description: 'Check the HTTP status code of a URL.', usage: '/st <url>', permission: 'public' } },
            { command: 'vs', handler: this.handleScan, options: { description: 'Scan a URL with VirusTotal.', usage: '/vs <url>', permission: 'public' } },
            { command: 'cl', handler: this.handleClean, options: { description: 'Remove tracking parameters from a URL.', usage: '/cl <url>', permission: 'public' } },
            { command: 'us', handler: this.handleUnshorten, options: { description: 'Expand a shortened URL.', usage: '/us <url>', permission: 'public' } },
            { command: 'get', handler: this.handleGet, options: { description: 'Download content from a URL.', usage: '/get <url>', permission: 'public' } },
        ]);
        this.log('URL Utils module initialized.');
    }

    /**
     * A generic utility to extract and validate a URL from message arguments.
     */
    _getUrlFromArgs(args) {
        if (args.length === 0) return null;
        try {
            const url = new URL(args[0]);
            return url.href;
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Applies a set of rules to remove parameters from a URLSearchParams object.
     */
    _applyRules(params, rules) {
        if (!rules) return params;
        const paramsToDelete = [];
        for (const key of params.keys()) {
            for (const rule of rules) {
                // The ClearURLs catalog uses regex-like strings, so we create RegExp objects.
                if (new RegExp('^' + rule + '$').test(key)) {
                    paramsToDelete.push(key);
                    break; 
                }
            }
        }
        paramsToDelete.forEach(key => params.delete(key));
    }


    /*================================================================================*/
    /*                            COMMAND HANDLERS                                    */
    /*================================================================================*/
    
    /**
     * Command: /st <url>
     * Fetches and displays the HTTP status code of a URL.
     */
    async handleStatus(msg, args) {
        const url = this._getUrlFromArgs(args);
        if (!url) {
            await this.reply(msg, '❌ Please provide a valid URL. Usage: <code>/st &lt;url&gt;</code>');
            return;
        }

        try {
            const tempMessage = await this.reply(msg, `Checking status of ${this._escapeHtml(url)}...`);
            const response = await axios.head(url, { maxRedirects: 0, validateStatus: () => true });

            let statusText = `📊 <b>Status for:</b> ${this._escapeHtml(url)}\n\n`;
            statusText += `<b>Code:</b> <code>${response.status}</code> (${response.statusText})\n`;

            if (response.status >= 300 && response.status < 400 && response.headers.location) {
                statusText += `🔗 <b>Redirects to:</b> ${this._escapeHtml(response.headers.location)}`;
            }
            
            await this.bot.bot.editMessageText(statusText, { chat_id: tempMessage.chat.id, message_id: tempMessage.message_id, parse_mode: 'HTML' });
        } catch (error) {
            this.logError(error, { command: 'st', url });
            await this.reply(msg, '❌ Could not fetch the status for that URL.');
        }
    }

    /**
     * Command: /vs <url>
     * Submits a URL to VirusTotal for scanning.
     */
    async handleScan(msg, args) {
        if (!this.vtApiKey) {
            await this.reply(msg, '⚙️ <b>VirusTotal API Key Not Configured</b>\n\nPlease set the <code>VIRUSTOTAL_API_KEY</code> in your <code>.env</code> file.');
            return;
        }
        const url = this._getUrlFromArgs(args);
        if (!url) {
            await this.reply(msg, '❌ Please provide a valid URL. Usage: <code>/vs &lt;url&gt;</code>');
            return;
        }
        
        try {
            const tempMessage = await this.reply(msg, 'Submitting URL to VirusTotal...');
            await axios.post('https://www.virustotal.com/api/v3/urls', `url=${encodeURIComponent(url)}`, {
                headers: { 'x-apikey': this.vtApiKey, 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            
            const urlId = Buffer.from(url).toString('base64').replace(/=/g, '');
            const reportUrl = `https://www.virustotal.com/gui/url/${urlId}`;

            await this.bot.bot.editMessageText(`✅ <b>Scan Submitted!</b>\n\nView the report here:\n${reportUrl}`, { chat_id: tempMessage.chat.id, message_id: tempMessage.message_id, parse_mode: 'HTML', disable_web_page_preview: true });
        } catch (error) {
            this.logError(error, { command: 'vs', url });
            await this.reply(msg, '❌ Failed to submit the URL to VirusTotal.');
        }
    }

    /**
     * Command: /cl <url>
     * Cleans tracking parameters from a URL using the cached ClearURLs catalog.
     */
    async handleClean(msg, args) {
        const url = this._getUrlFromArgs(args);
        if (!url) {
            await this.reply(msg, '❌ Please provide a valid URL. Usage: <code>/cl &lt;url&gt;</code>');
            return;
        }

        if (!this.clearUrlsRules || Object.keys(this.clearUrlsRules).length === 0) {
            await this.reply(msg, '⚠️ URL cleaning service is currently unavailable (could not load rules on startup).');
            return;
        }

        try {
            const parsedUrl = new URL(url);
            const originalParams = new URLSearchParams(parsedUrl.search);
            const cleanedParams = new URLSearchParams(parsedUrl.search);
            let paramsRemovedCount = 0;

            // Apply global rules
            this._applyRules(cleanedParams, this.clearUrlsRules.globalRules.rules);
            
            // Apply provider-specific rules
            for (const providerName in this.clearUrlsRules) {
                if (providerName === 'globalRules') continue;
                
                const provider = this.clearUrlsRules[providerName];
                if (new RegExp(provider.urlPattern).test(url)) {
                    this._applyRules(cleanedParams, provider.rules);
                }
            }
            
            paramsRemovedCount = originalParams.size - cleanedParams.size;
            parsedUrl.search = cleanedParams.toString();
            const cleanedUrl = parsedUrl.href;

            if (paramsRemovedCount > 0) {
                await this.reply(msg, `✨ <b>URL Cleaned</b> (${paramsRemovedCount} parameter${paramsRemovedCount > 1 ? 's' : ''} removed):\n\n${this._escapeHtml(cleanedUrl)}`);
            } else {
                await this.reply(msg, '✅ No tracking parameters found to remove.');
            }
        } catch (error) {
            this.logError(error, { command: 'cl', url });
            await this.reply(msg, '❌ Could not clean the URL.');
        }
    }

    /**
     * Command: /us <url>
     * Expands a shortened URL using unshorten.me.
     */
    async handleUnshorten(msg, args) {
        const url = this._getUrlFromArgs(args);
        if (!url) {
            await this.reply(msg, '❌ Please provide a valid URL. Usage: <code>/us &lt;url&gt;</code>');
            return;
        }

        try {
            const tempMessage = await this.reply(msg, `Unshortening ${this._escapeHtml(url)}...`);
            const response = await axios.get(`https://unshorten.me/json/${encodeURIComponent(url)}`);

            if (response.data && response.data.resolved_url) {
                await this.bot.bot.editMessageText(`🔗 <b>Unshortened URL:</b>\n\n${this._escapeHtml(response.data.resolved_url)}`, { chat_id: tempMessage.chat.id, message_id: tempMessage.message_id, parse_mode: 'HTML' });
            } else {
                await this.bot.bot.editMessageText('⚠️ This URL could not be unshortened. It may not be a shortened link.', { chat_id: tempMessage.chat.id, message_id: tempMessage.message_id });
            }
        } catch (error) {
            this.logError(error, { command: 'us', url });
            await this.reply(msg, '❌ An error occurred while trying to unshorten the URL.');
        }
    }

    /**
     * Command: /get <url>
     * Downloads content from a URL and uploads it as a document.
     */
    async handleGet(msg, args) {
        const url = this._getUrlFromArgs(args);
        if (!url) {
            await this.reply(msg, '❌ Please provide a valid URL. Usage: <code>/get &lt;url&gt;</code>');
            return;
        }

        try {
            const tempMessage = await this.reply(msg, `Downloading from ${this._escapeHtml(url)}...`);
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                maxContentLength: 50 * 1024 * 1024, // 50MB Telegram Bot API limit
                maxRedirects: 5
            });

            const buffer = Buffer.from(response.data, 'binary');
            const path = new URL(url).pathname;
            const filename = path.substring(path.lastIndexOf('/') + 1) || 'download.dat';
            
            await this.bot.bot.deleteMessage(tempMessage.chat.id, tempMessage.message_id);
            await this.bot.bot.sendDocument(msg.chat.id, buffer, 
    { // Options for the bot API
        caption: `Downloaded from: ${this._escapeHtml(url)}`
    }, 
    { // File Options for node-telegram-bot-api
        filename: filename,
        contentType: 'application/octet-stream' // <-- The crucial addition
    }
);

        } catch (error) {
            this.logError(error, { command: 'get', url });
            await this.reply(msg, '❌ Failed to download file. It may be too large, protected, or the URL is invalid.');
        }
    }
}

module.exports = UrlUtilsModule;
