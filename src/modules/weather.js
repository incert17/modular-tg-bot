/**
 * Weather Module v1.1
 * 
 * Provides weather information using OpenWeatherMap API.
 * This version includes robust HTML escaping and correct message editing.
 * 
 * @module modules/weather
 */

const BaseModule = require('../core/BaseModule');
const axios = require('axios');
const { config } = require('../utils/config');

/**
 * Weather Module class
 */
class WeatherModule extends BaseModule {
    constructor(bot) {
        super(bot);
        this.name = 'Weather';
        this.version = '1.1.0';
        this.description = 'Weather information and forecasts';
        this.apiKey = config.OPENWEATHER_API_KEY;
        this.baseUrl = 'https://api.openweathermap.org/data/2.5';
    }

    /**
     * Escapes HTML special characters for safe embedding
     * @param {string} str The string to escape
     * @returns {string} The escaped string
     */
    _escapeHtml(str) {
        if (typeof str !== 'string' || !str) return '';
        return str.replace(/[&<>"']/g, match => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[match]));
    }

    /**
     * Initialize the module
     */
    async init() {
        await super.init();

        if (!this.apiKey) {
            this.log('Weather module initialized without API key. Commands will show setup instructions.');
        } else {
            this.log('Weather module initialized with API key.');
        }

        this.registerCommands([
            {
                command: 'weather',
                handler: this.handleWeather,
                options: {
                    description: 'Get current weather for a city',
                    usage: '/weather &lt;city&gt;',
                    permission: 'public'
                }
            },
            {
                command: 'forecast',
                handler: this.handleForecast,
                options: {
                    description: 'Get 5-day weather forecast for a city',
                    usage: '/forecast &lt;city&gt;',
                    permission: 'public'
                }
            }
        ]);

        this.log('Weather module initialized with commands', {
            commands: this.commands.map(cmd => cmd.command),
            hasApiKey: !!this.apiKey
        });
    }

    /**
     * Shared logic to validate prerequisites for weather commands
     * @param {Object} msg - Telegram message object
     * @param {Array} args - Command arguments
     * @returns {string|null} City name if valid, otherwise null
     */
    async _validateWeatherRequest(msg, args) {
        if (!this.apiKey) {
            await this.sendSetupInstructions(msg);
            return null;
        }

        if (args.length === 0) {
            await this.reply(msg, `❌ Please provide a city name.\nUsage: ${msg.text.split(' ')[0]} &lt;city&gt;`);
            return null;
        }

        const city = args.join(' ');
        if (city.length > 100) {
            await this.reply(msg, '❌ City name is too long.');
            return null;
        }
        
        return city;
    }

    /**
     * Handle /weather command
     */
    async handleWeather(msg, args) {
        const city = await this._validateWeatherRequest(msg, args);
        if (!city) return;

        try {
            const tempMessage = await this.reply(msg, '🌤️ Getting weather information...');
            const weatherData = await this.getCurrentWeather(city);
            const response = this.formatWeatherResponse(weatherData);
            
            // CORRECTED: Use this.bot.bot.editMessageText
            await this.bot.bot.editMessageText(response, { 
                chat_id: tempMessage.chat.id, 
                message_id: tempMessage.message_id, 
                parse_mode: 'HTML' 
            });

            this.log('Weather command executed', {
                userId: msg.from.id,
                city,
            });

        } catch (apiError) {
            this.handleApiError(msg, apiError);
        }
    }

    /**
     * Handle /forecast command
     */
    async handleForecast(msg, args) {
        const city = await this._validateWeatherRequest(msg, args);
        if (!city) return;

        try {
            const tempMessage = await this.reply(msg, '📅 Getting weather forecast...');
            const forecastData = await this.getForecast(city);
            const response = this.formatForecastResponse(forecastData);
            
            // CORRECTED: Use this.bot.bot.editMessageText
            await this.bot.bot.editMessageText(response, { 
                chat_id: tempMessage.chat.id, 
                message_id: tempMessage.message_id, 
                parse_mode: 'HTML' 
            });

            this.log('Forecast command executed', {
                userId: msg.from.id,
                city,
            });

        } catch (apiError) {
            this.handleApiError(msg, apiError);
        }
    }

    /**
     * Fetches current weather from OpenWeatherMap
     */
    async getCurrentWeather(city) {
        const response = await axios.get(`${this.baseUrl}/weather`, {
            params: { q: city, appid: this.apiKey, units: 'metric' },
            timeout: 10000
        });
        return response.data;
    }

    /**
     * Fetches 5-day forecast from OpenWeatherMap
     */
    async getForecast(city) {
        const response = await axios.get(`${this.baseUrl}/forecast`, {
            params: { q: city, appid: this.apiKey, units: 'metric' },
            timeout: 10000
        });
        return response.data;
    }

    /**
     * Formats the weather response with proper HTML escaping
     */
    formatWeatherResponse(data) {
        const { weather, main, wind, sys, name } = data;
        const weatherEmoji = this.getWeatherEmoji(weather[0].main);

        let response = `${weatherEmoji} <b>Weather in ${this._escapeHtml(name)}, ${this._escapeHtml(sys.country)}</b>\n\n`;
        response += `🌡️ <b>Temperature:</b> ${Math.round(main.temp)}°C (feels like ${Math.round(main.feels_like)}°C)\n`;
        response += `☁️ <b>Condition:</b> ${this._escapeHtml(weather[0].description)}\n`;
        response += `💧 <b>Humidity:</b> ${main.humidity}%\n`;
        response += `💨 <b>Wind:</b> ${wind.speed} m/s ${this.getWindDirection(wind.deg)}\n\n`;
        response += `🌅 <b>Sunrise:</b> ${new Date(sys.sunrise * 1000).toLocaleTimeString()}\n`;
        response += `🌇 <b>Sunset:</b> ${new Date(sys.sunset * 1000).toLocaleTimeString()}`;

        return response;
    }

    /**
     * Formats the forecast response with proper HTML escaping
     */
    formatForecastResponse(data) {
        const { city, list } = data;
        let response = `📅 <b>5-Day Forecast for ${this._escapeHtml(city.name)}, ${this._escapeHtml(city.country)}</b>\n\n`;

        const dailyForecasts = list.reduce((acc, item) => {
            const dateKey = new Date(item.dt * 1000).toDateString();
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(item);
            return acc;
        }, {});

        Object.keys(dailyForecasts).slice(0, 5).forEach((dateKey, index, arr) => {
            const forecasts = dailyForecasts[dateKey];
            const date = new Date(dateKey);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
            
            const midday = forecasts.find(f => new Date(f.dt * 1000).getHours() >= 12) || forecasts[0];
            const temp = Math.round(midday.main.temp);
            const emoji = this.getWeatherEmoji(midday.weather[0].main);

            response += `${emoji} <b>${dayName}</b>: ${temp}°C, ${this._escapeHtml(midday.weather[0].description)}`;
            if (index < arr.length - 1) response += '\n\n';
        });

        return response;
    }

    /**
     * Gets an emoji for a given weather condition
     */
    getWeatherEmoji(condition) {
        const map = { 'Clear': '☀️', 'Clouds': '☁️', 'Rain': '🌧️', 'Drizzle': '🌦️', 'Thunderstorm': '⛈️', 'Snow': '❄️', 'Mist': '🌫️', 'Fog': '🌫️' };
        return map[condition] || '🌤️';
    }

    /**
     * Gets a cardinal direction from a degree value
     */
    getWindDirection(degrees) {
        if (degrees === undefined) return '';
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        return directions[Math.round(degrees / 22.5) % 16];
    }
    
    /**
     * Handles common API errors
     * @param {Object} msg - Telegram message object
     * @param {Error} error - The caught API error
     */
    async handleApiError(msg, error) {
        if (error.response?.status === 404) {
            await this.reply(msg, '❌ City not found. Please check the spelling and try again.');
        } else if (error.response?.status === 401) {
            await this.reply(msg, '❌ Weather service authentication failed. Please contact the administrator.');
            this.logError(error, { context: 'Weather API authentication' });
        } else {
            await this.reply(msg, '❌ Failed to get weather information. Please try again later.');
            this.logError(error, { context: 'Weather API request', userId: msg.from.id });
        }
    }

    /**
     * Sends setup instructions if API key is missing
     */
    async sendSetupInstructions(msg) {
        let instructions = `⚙️ <b>Weather Module Setup Required</b>\n\nTo use weather commands, you need an OpenWeatherMap API key.\n\n1. Go to openweathermap.org/api\n2. Get a free API key.\n3. Set it in your <code>.env</code> file:\n\n<code>OPENWEATHER_API_KEY=your_key_here</code>\n\nThen, restart the bot.`;
        await this.reply(msg, instructions);
    }
}

module.exports = WeatherModule;
