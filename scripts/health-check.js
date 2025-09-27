#!/usr/bin/env node

/**
 * Health Check Script
 * 
 * Performs health checks on the bot and its dependencies.
 * Can be used for monitoring, Docker health checks, and deployment verification.
 * 
 * Usage:
 *   node scripts/health-check.js [options]
 * 
 * Options:
 *   --port <port>     Port to check (default: from config)
 *   --host <host>     Host to check (default: localhost)
 *   --timeout <ms>    Request timeout (default: 5000)
 *   --token <token>   Health check token
 *   --verbose         Verbose output
 *   --json            JSON output format
 *   --exit-code       Exit with non-zero code on failure
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const path = require('path');

// Load configuration
const configPath = path.join(__dirname, '../src/utils/config.js');
let config = {};

try {
    // Try to load config if available
    const configModule = require(configPath);
    config = configModule.config || {};
} catch (error) {
    // Fallback to environment variables
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    config = {
        PORT: process.env.PORT || 3000,
        HOST: process.env.HOST || 'localhost',
        HEALTH_CHECK_TOKEN: process.env.HEALTH_CHECK_TOKEN,
        NODE_ENV: process.env.NODE_ENV || 'development',
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN
    };
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    port: config.PORT || 3000,
    host: 'localhost',
    timeout: 5000,
    token: config.HEALTH_CHECK_TOKEN,
    verbose: false,
    json: false,
    exitCode: false
};

for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
        case '--port':
            options.port = parseInt(args[++i], 10);
            break;
        case '--host':
            options.host = args[++i];
            break;
        case '--timeout':
            options.timeout = parseInt(args[++i], 10);
            break;
        case '--token':
            options.token = args[++i];
            break;
        case '--verbose':
            options.verbose = true;
            break;
        case '--json':
            options.json = true;
            break;
        case '--exit-code':
            options.exitCode = true;
            break;
        case '--help':
            console.log(`
Health Check Script for Modular Telegram Bot

Usage: node scripts/health-check.js [options]

Options:
  --port <port>     Port to check (default: ${options.port})
  --host <host>     Host to check (default: ${options.host})
  --timeout <ms>    Request timeout (default: ${options.timeout})
  --token <token>   Health check token
  --verbose         Verbose output
  --json            JSON output format
  --exit-code       Exit with non-zero code on failure
  --help            Show this help message

Examples:
  node scripts/health-check.js
  node scripts/health-check.js --port 8080 --verbose
  node scripts/health-check.js --json --exit-code
            `);
            process.exit(0);
    }
}

/**
 * Make HTTP request
 * @param {string} url - URL to request
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Response data
 */
function makeRequest(url, requestOptions = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const req = client.request({
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            timeout: options.timeout,
            headers: {
                'User-Agent': 'HealthCheck/1.0',
                ...requestOptions.headers
            }
        }, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: jsonData
                    });
                } catch (error) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: data
                    });
                }
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

/**
 * Check bot health endpoint
 * @returns {Promise<Object>} Health check result
 */
async function checkBotHealth() {
    const url = `http://${options.host}:${options.port}/health`;
    const headers = {};
    
    if (options.token) {
        headers['x-health-token'] = options.token;
    }
    
    try {
        const response = await makeRequest(url, { headers });
        
        return {
            name: 'Bot Health Endpoint',
            status: response.statusCode === 200 ? 'healthy' : 'unhealthy',
            statusCode: response.statusCode,
            responseTime: Date.now(),
            data: response.data,
            error: response.statusCode !== 200 ? `HTTP ${response.statusCode}` : null
        };
    } catch (error) {
        return {
            name: 'Bot Health Endpoint',
            status: 'unhealthy',
            statusCode: null,
            responseTime: null,
            data: null,
            error: error.message
        };
    }
}

/**
 * Check root endpoint
 * @returns {Promise<Object>} Root check result
 */
async function checkRootEndpoint() {
    const url = `http://${options.host}:${options.port}/`;
    
    try {
        const response = await makeRequest(url);
        
        return {
            name: 'Root Endpoint',
            status: response.statusCode === 200 ? 'healthy' : 'unhealthy',
            statusCode: response.statusCode,
            data: response.data,
            error: response.statusCode !== 200 ? `HTTP ${response.statusCode}` : null
        };
    } catch (error) {
        return {
            name: 'Root Endpoint',
            status: 'unhealthy',
            statusCode: null,
            data: null,
            error: error.message
        };
    }
}

/**
 * Check Telegram Bot API
 * @returns {Promise<Object>} Telegram API check result
 */
async function checkTelegramAPI() {
    if (!config.TELEGRAM_BOT_TOKEN) {
        return {
            name: 'Telegram Bot API',
            status: 'skipped',
            error: 'No bot token configured'
        };
    }
    
    const url = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/getMe`;
    
    try {
        const response = await makeRequest(url);
        
        if (response.data && response.data.ok) {
            return {
                name: 'Telegram Bot API',
                status: 'healthy',
                statusCode: response.statusCode,
                data: {
                    botId: response.data.result.id,
                    botUsername: response.data.result.username,
                    botName: response.data.result.first_name
                }
            };
        } else {
            return {
                name: 'Telegram Bot API',
                status: 'unhealthy',
                statusCode: response.statusCode,
                error: response.data ? response.data.description : 'Invalid response'
            };
        }
    } catch (error) {
        return {
            name: 'Telegram Bot API',
            status: 'unhealthy',
            error: error.message
        };
    }
}

/**
 * Check system resources
 * @returns {Object} System check result
 */
function checkSystemResources() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Convert to MB
    const memoryMB = {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
    };
    
    // Check if memory usage is concerning (>500MB RSS)
    const memoryStatus = memoryMB.rss > 500 ? 'warning' : 'healthy';
    
    return {
        name: 'System Resources',
        status: memoryStatus,
        data: {
            uptime: Math.round(process.uptime()),
            memory: memoryMB,
            cpu: cpuUsage,
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch
        }
    };
}

/**
 * Run all health checks
 * @returns {Promise<Object>} Complete health check results
 */
async function runHealthChecks() {
    const startTime = Date.now();
    
    if (options.verbose && !options.json) {
        console.log('🔍 Running health checks...\n');
    }
    
    const checks = await Promise.all([
        checkBotHealth(),
        checkRootEndpoint(),
        checkTelegramAPI(),
        Promise.resolve(checkSystemResources())
    ]);
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Determine overall status
    const hasUnhealthy = checks.some(check => check.status === 'unhealthy');
    const hasWarning = checks.some(check => check.status === 'warning');
    
    let overallStatus = 'healthy';
    if (hasUnhealthy) {
        overallStatus = 'unhealthy';
    } else if (hasWarning) {
        overallStatus = 'warning';
    }
    
    return {
        timestamp: new Date().toISOString(),
        overallStatus,
        totalTime,
        checks,
        summary: {
            total: checks.length,
            healthy: checks.filter(c => c.status === 'healthy').length,
            unhealthy: checks.filter(c => c.status === 'unhealthy').length,
            warning: checks.filter(c => c.status === 'warning').length,
            skipped: checks.filter(c => c.status === 'skipped').length
        }
    };
}

/**
 * Format output for console
 * @param {Object} results - Health check results
 */
function formatConsoleOutput(results) {
    const statusEmoji = {
        healthy: '✅',
        unhealthy: '❌',
        warning: '⚠️',
        skipped: '⏭️'
    };
    
    console.log(`🏥 Health Check Results (${results.totalTime}ms)\n`);
    console.log(`Overall Status: ${statusEmoji[results.overallStatus]} ${results.overallStatus.toUpperCase()}\n`);
    
    results.checks.forEach(check => {
        console.log(`${statusEmoji[check.status]} ${check.name}: ${check.status.toUpperCase()}`);
        
        if (options.verbose) {
            if (check.error) {
                console.log(`   Error: ${check.error}`);
            }
            if (check.statusCode) {
                console.log(`   Status Code: ${check.statusCode}`);
            }
            if (check.data && typeof check.data === 'object') {
                console.log(`   Data: ${JSON.stringify(check.data, null, 2).replace(/\n/g, '\n   ')}`);
            }
        }
        
        console.log('');
    });
    
    console.log(`Summary: ${results.summary.healthy} healthy, ${results.summary.unhealthy} unhealthy, ${results.summary.warning} warning, ${results.summary.skipped} skipped`);
}

/**
 * Main function
 */
async function main() {
    try {
        const results = await runHealthChecks();
        
        if (options.json) {
            console.log(JSON.stringify(results, null, 2));
        } else {
            formatConsoleOutput(results);
        }
        
        // Exit with appropriate code
        if (options.exitCode) {
            const exitCode = results.overallStatus === 'unhealthy' ? 1 : 0;
            process.exit(exitCode);
        }
        
    } catch (error) {
        if (options.json) {
            console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                overallStatus: 'error',
                error: error.message
            }, null, 2));
        } else {
            console.error('❌ Health check failed:', error.message);
        }
        
        if (options.exitCode) {
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    runHealthChecks,
    checkBotHealth,
    checkRootEndpoint,
    checkTelegramAPI,
    checkSystemResources
};

