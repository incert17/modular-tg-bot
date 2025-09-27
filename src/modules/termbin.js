/**
 * Termbin Module v1.1.0
 * 
 * Provides commands to upload text or file contents to termbin.com.
 * Supports text from direct messages, replied-to messages, and replied-to files.
 * 
 * @module modules/termbin
 */

const BaseModule = require('../core/BaseModule');
const net = require('net');
const axios = require('axios');

/**
 * Termbin Module class
 */
class TermbinModule extends BaseModule {
    constructor(bot) {
        super(bot);
        this.name = 'Termbin';
        this.version = '1.1.0';
        this.description = 'Uploads text or file contents to termbin.com for easy sharing.';
    }

    /**
     * Initialize the module and register commands.
     */
    async init() {
        await super.init();
        this.registerCommands([
            {
                command: 'termbin',
                handler: this.handleTermbin,
                options: {
                    description: 'Upload text or a file to termbin.com.',
                    usage: '/termbin [text] (or reply to a message/file)',
                    permission: 'public'
                }
            }
        ]);
        this.log('Termbin module initialized.');
    }

    /**
     * Handle the /termbin command.
     * Determines the source of the content (direct text, replied text, or replied file)
     * and triggers the upload process.
     */
    async handleTermbin(msg, args) {
        let contentToUpload = '';
        let source = 'unknown';

        // Case 1: Reply to a file
        if (msg.reply_to_message && msg.reply_to_message.document) {
            source = 'file';
            const document = msg.reply_to_message.document;

            // Optional: Add file size check
            if (document.file_size > 50000) { // 50 KB limit
                await this.reply(msg, '❌ File is too large. Please upload files smaller than 50 KB.');
                return;
            }

            try {
                contentToUpload = await this._downloadFileContent(document.file_id);
            } catch (error) {
                this.logError(error, { command: 'termbin', context: 'file-download' });
                await this.reply(msg, '❌ Failed to download the attached file.');
                return;
            }

        // Case 2: Reply to a text message
        } else if (msg.reply_to_message && msg.reply_to_message.text) {
            source = 'replied-text';
            contentToUpload = msg.reply_to_message.text;
        
        // Case 3: Direct text argument
        } else if (args.length > 0) {
            source = 'direct-text';
            contentToUpload = args.join(' ');
        
        // Case 4: No content provided
        } else {
            await this.reply(msg, 'ℹ️ Please provide text or reply to a message/file with <code>/termbin</code>.');
            return;
        }

        // Final validation before upload
        if (contentToUpload.trim().length === 0) {
            await this.reply(msg, '❌ The content is empty. Nothing to upload.');
            return;
        }

        // Perform the upload
        try {
            const tempMessage = await this.reply(msg, 'Uploading to termbin.com...');
            const termbinUrl = await this._uploadToTermbin(contentToUpload);
            
            await this.bot.bot.editMessageText(     `✅ <b>Upload successful!</b>\n\nYour URL is: ${termbinUrl}`,     {         chat_id: tempMessage.chat.id,         message_id: tempMessage.message_id,         parse_mode: 'HTML'     } );
            
            this.log('Termbin upload successful', {
                userId: msg.from.id,
                url: termbinUrl,
                source: source,
                length: contentToUpload.length
            });

        } catch (error) {
            this.logError(error, { command: 'termbin', userId: msg.from.id });
            await this.reply(msg, '❌ An error occurred while uploading to termbin.');
        }
    }

    /**
     * Downloads the content of a file from Telegram's servers.
     * @param {string} fileId - The file_id of the Telegram document.
     * @returns {Promise<string>} A promise that resolves with the file's text content.
     */
    async _downloadFileContent(fileId) {
        // Get the file path from the Telegram API
        const file = await this.bot.bot.getFile(fileId);
        const filePath = file.file_path;

        // Construct the full download URL
        const downloadUrl = `https://api.telegram.org/file/bot${this.bot.token}/${filePath}`;

        // Use axios to download the file content
        const response = await axios.get(downloadUrl, { responseType: 'text' });
        return response.data;
    }

    /**
     * Uploads the given text to termbin.com using a raw TCP socket.
     * @param {string} text - The text to upload.
     * @returns {Promise<string>} A promise that resolves with the termbin URL.
     */
    _uploadToTermbin(text) {
        return new Promise((resolve, reject) => {
            const client = new net.Socket();

            client.connect(9999, 'termbin.com', () => {
                client.write(text + '\n');
                client.end();
            });

            let responseData = '';
            client.on('data', (chunk) => {
                responseData += chunk.toString();
            });

            client.on('end', () => {
                const url = responseData.trim();
                if (url.startsWith('http')) {
                    resolve(url);
                } else {
                    reject(new Error('Termbin did not return a valid URL.'));
                }
            });

            client.on('error', (err) => {
                reject(new Error(`Failed to connect or upload to termbin.com: ${err.message}`));
            });

            client.on('timeout', () => {
                client.destroy();
                reject(new Error('Connection to termbin.com timed out.'));
            });
        });
    }
}

module.exports = TermbinModule;
