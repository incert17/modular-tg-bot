/**
 * Validation Utilities
 * 
 * Provides input validation helpers, command argument parsing,
 * and user permission checks for the bot system.
 * 
 * @module utils/validators
 */

const { isAdmin } = require('./config');

/**
 * Parse command and arguments from message text
 * @param {string} text - Message text
 * @returns {Object} Parsed command object
 */
function parseCommand(text) {
    if (!text || !text.startsWith('/')) {
        return null;
    }

    const parts = text.trim().split(/\s+/);
    const commandPart = parts[0];
    const args = parts.slice(1);

    // Handle bot username in command (e.g., /start@botname)
    const [command, botUsername] = commandPart.split('@');

    return {
        command: command.toLowerCase(),
        args,
        botUsername,
        raw: text,
        fullCommand: commandPart
    };
}

/**
 * Validate command arguments
 * @param {Array} args - Command arguments
 * @param {Object} schema - Validation schema
 * @returns {Object} Validation result
 */
function validateArgs(args, schema) {
    const result = {
        valid: true,
        errors: [],
        parsed: {}
    };

    // Check minimum arguments
    if (schema.minArgs && args.length < schema.minArgs) {
        result.valid = false;
        result.errors.push(`Minimum ${schema.minArgs} arguments required, got ${args.length}`);
        return result;
    }

    // Check maximum arguments
    if (schema.maxArgs && args.length > schema.maxArgs) {
        result.valid = false;
        result.errors.push(`Maximum ${schema.maxArgs} arguments allowed, got ${args.length}`);
        return result;
    }

    // Validate each argument
    if (schema.args) {
        schema.args.forEach((argSchema, index) => {
            const arg = args[index];
            const argName = argSchema.name || `arg${index}`;

            // Check required arguments
            if (argSchema.required && (arg === undefined || arg === '')) {
                result.valid = false;
                result.errors.push(`Argument '${argName}' is required`);
                return;
            }

            // Skip validation if argument is not provided and not required
            if (arg === undefined || arg === '') {
                if (argSchema.default !== undefined) {
                    result.parsed[argName] = argSchema.default;
                }
                return;
            }

            // Type validation
            let parsedValue = arg;
            switch (argSchema.type) {
                case 'number':
                    parsedValue = parseFloat(arg);
                    if (isNaN(parsedValue)) {
                        result.valid = false;
                        result.errors.push(`Argument '${argName}' must be a number`);
                        return;
                    }
                    break;

                case 'integer':
                    parsedValue = parseInt(arg, 10);
                    if (isNaN(parsedValue)) {
                        result.valid = false;
                        result.errors.push(`Argument '${argName}' must be an integer`);
                        return;
                    }
                    break;

                case 'boolean':
                    parsedValue = ['true', '1', 'yes', 'on'].includes(arg.toLowerCase());
                    break;

                case 'string':
                default:
                    parsedValue = String(arg);
                    break;
            }

            // Range validation for numbers
            if (argSchema.type === 'number' || argSchema.type === 'integer') {
                if (argSchema.min !== undefined && parsedValue < argSchema.min) {
                    result.valid = false;
                    result.errors.push(`Argument '${argName}' must be at least ${argSchema.min}`);
                    return;
                }
                if (argSchema.max !== undefined && parsedValue > argSchema.max) {
                    result.valid = false;
                    result.errors.push(`Argument '${argName}' must be at most ${argSchema.max}`);
                    return;
                }
            }

            // Length validation for strings
            if (argSchema.type === 'string') {
                if (argSchema.minLength && parsedValue.length < argSchema.minLength) {
                    result.valid = false;
                    result.errors.push(`Argument '${argName}' must be at least ${argSchema.minLength} characters`);
                    return;
                }
                if (argSchema.maxLength && parsedValue.length > argSchema.maxLength) {
                    result.valid = false;
                    result.errors.push(`Argument '${argName}' must be at most ${argSchema.maxLength} characters`);
                    return;
                }
            }

            // Pattern validation
            if (argSchema.pattern && !argSchema.pattern.test(parsedValue)) {
                result.valid = false;
                result.errors.push(`Argument '${argName}' format is invalid`);
                return;
            }

            // Enum validation
            if (argSchema.enum && !argSchema.enum.includes(parsedValue)) {
                result.valid = false;
                result.errors.push(`Argument '${argName}' must be one of: ${argSchema.enum.join(', ')}`);
                return;
            }

            result.parsed[argName] = parsedValue;
        });
    }

    return result;
}

/**
 * Check if user has permission to execute command
 * @param {Object} msg - Telegram message object
 * @param {string} permission - Required permission level
 * @returns {boolean} Whether user has permission
 */
function hasPermission(msg, permission) {
    const userId = msg.from.id;

    switch (permission) {
        case 'admin':
            return isAdmin(userId);
        
        case 'private':
            return msg.chat.type === 'private';
        
        case 'group':
            return ['group', 'supergroup'].includes(msg.chat.type);
        
        case 'public':
        default:
            return true;
    }
}

/**
 * Validate user input for security
 * @param {string} input - User input
 * @returns {Object} Validation result
 */
function validateUserInput(input) {
    const result = {
        valid: true,
        sanitized: input,
        warnings: []
    };

    if (!input || typeof input !== 'string') {
        result.valid = false;
        return result;
    }

    // Check for potential security issues
    const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /eval\s*\(/i,
        /expression\s*\(/i
    ];

    dangerousPatterns.forEach(pattern => {
        if (pattern.test(input)) {
            result.warnings.push('Potentially dangerous content detected');
        }
    });

    // Basic sanitization
    result.sanitized = input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .trim();

    return result;
}

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @returns {boolean} Whether URL is valid
 */
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} Whether email is valid
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate phone number (basic)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} Whether phone number is valid
 */
function isValidPhone(phone) {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
}

/**
 * Rate limiting check
 * @param {string} userId - User ID
 * @param {string} action - Action being performed
 * @param {number} limit - Rate limit (requests per minute)
 * @returns {Object} Rate limit result
 */
const rateLimitStore = new Map();

function checkRateLimit(userId, action = 'default', limit = 30) {
    const key = `${userId}:${action}`;
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    if (!rateLimitStore.has(key)) {
        rateLimitStore.set(key, []);
    }

    const requests = rateLimitStore.get(key);
    
    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    rateLimitStore.set(key, validRequests);

    // Check if limit exceeded
    if (validRequests.length >= limit) {
        return {
            allowed: false,
            remaining: 0,
            resetTime: Math.min(...validRequests) + 60000
        };
    }

    // Add current request
    validRequests.push(now);
    rateLimitStore.set(key, validRequests);

    return {
        allowed: true,
        remaining: limit - validRequests.length,
        resetTime: now + 60000
    };
}

/**
 * Clean up old rate limit entries
 */
function cleanupRateLimit() {
    const now = Date.now();
    const cutoff = now - 120000; // 2 minutes ago

    for (const [key, requests] of rateLimitStore.entries()) {
        const validRequests = requests.filter(timestamp => timestamp > cutoff);
        if (validRequests.length === 0) {
            rateLimitStore.delete(key);
        } else {
            rateLimitStore.set(key, validRequests);
        }
    }
}

// Clean up rate limit store every 5 minutes
setInterval(cleanupRateLimit, 300000);

module.exports = {
    parseCommand,
    validateArgs,
    hasPermission,
    validateUserInput,
    isValidUrl,
    isValidEmail,
    isValidPhone,
    checkRateLimit,
    cleanupRateLimit
};

