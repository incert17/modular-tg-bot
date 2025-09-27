/**
 * Module Loader
 * 
 * Handles dynamic loading of bot modules from the modules directory.
 * Manages module lifecycle, registration, and event handling.
 * 
 * @module core/ModuleLoader
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Module Loader class
 */
class ModuleLoader {
    /**
     * Create a new ModuleLoader instance
     * @param {Bot} bot - Bot instance
     */
    constructor(bot) {
        this.bot = bot;
        this.modules = new Map();
        this.modulesDir = path.join(__dirname, '../modules');
        this.eventListeners = new Map();
    }

    /**
     * Load all modules from the modules directory
     */
    async loadModules() {
        try {
            // Ensure modules directory exists
            if (!fs.existsSync(this.modulesDir)) {
                logger.warn('Modules directory does not exist:', this.modulesDir);
                return;
            }

            // Get all JavaScript files in modules directory
            const files = fs.readdirSync(this.modulesDir)
                .filter(file => file.endsWith('.js'))
                .sort(); // Load modules in alphabetical order

            logger.logBotActivity('Loading modules', { 
                modulesDir: this.modulesDir,
                moduleFiles: files 
            });

            // Load each module
            for (const file of files) {
                await this.loadModule(file);
            }

            logger.logBotActivity('All modules loaded', { 
                loadedCount: this.modules.size,
                failedCount: files.length - this.modules.size
            });

        } catch (error) {
            logger.logError(error, { context: 'Module loading' });
            throw error;
        }
    }

    /**
     * Load a single module
     * @param {string} filename - Module filename
     */
    async loadModule(filename) {
        const modulePath = path.join(this.modulesDir, filename);
        const moduleName = path.basename(filename, '.js');

        try {
            logger.logModuleActivity(moduleName, 'Loading module', { path: modulePath });

            // Clear require cache to allow hot reloading
            delete require.cache[require.resolve(modulePath)];

            // Require the module
            const ModuleClass = require(modulePath);

            // Validate module class
            if (typeof ModuleClass !== 'function') {
                throw new Error('Module must export a class constructor');
            }

            // Create module instance
            const moduleInstance = new ModuleClass(this.bot);

            // Validate module instance
            if (!moduleInstance.name) {
                throw new Error('Module must have a name property');
            }

            // Check for duplicate module names
            if (this.modules.has(moduleInstance.name)) {
                throw new Error(`Module with name '${moduleInstance.name}' already exists`);
            }

            // Initialize module
            if (typeof moduleInstance.init === 'function') {
                await moduleInstance.init();
            }

            // Register module
            this.modules.set(moduleInstance.name, {
                instance: moduleInstance,
                filename,
                loadTime: new Date(),
                enabled: true
            });

            logger.logModuleActivity(moduleName, 'Module loaded successfully', {
                moduleName: moduleInstance.name,
                version: moduleInstance.version || '1.0.0',
                description: moduleInstance.description || 'No description'
            });

        } catch (error) {
            logger.logError(error, { 
                context: 'Module loading',
                moduleName,
                filename,
                path: modulePath
            });
            
            // Don't throw error for individual module failures
            // This allows other modules to continue loading
        }
    }

    /**
     * Unload a module
     * @param {string} moduleName - Module name
     */
    async unloadModule(moduleName) {
        try {
            const moduleInfo = this.modules.get(moduleName);
            if (!moduleInfo) {
                throw new Error(`Module '${moduleName}' not found`);
            }

            const { instance, filename } = moduleInfo;

            logger.logModuleActivity(moduleName, 'Unloading module');

            // Call module cleanup if available
            if (typeof instance.cleanup === 'function') {
                await instance.cleanup();
            }

            // Remove from modules map
            this.modules.delete(moduleName);

            // Clear require cache
            const modulePath = path.join(this.modulesDir, filename);
            delete require.cache[require.resolve(modulePath)];

            logger.logModuleActivity(moduleName, 'Module unloaded successfully');

        } catch (error) {
            logger.logError(error, { 
                context: 'Module unloading',
                moduleName
            });
            throw error;
        }
    }

    /**
     * Reload a module
     * @param {string} moduleName - Module name
     */
    async reloadModule(moduleName) {
        try {
            const moduleInfo = this.modules.get(moduleName);
            if (!moduleInfo) {
                throw new Error(`Module '${moduleName}' not found`);
            }

            const { filename } = moduleInfo;

            logger.logModuleActivity(moduleName, 'Reloading module');

            // Unload the module
            await this.unloadModule(moduleName);

            // Load the module again
            await this.loadModule(filename);

            logger.logModuleActivity(moduleName, 'Module reloaded successfully');

        } catch (error) {
            logger.logError(error, { 
                context: 'Module reloading',
                moduleName
            });
            throw error;
        }
    }

    /**
     * Enable a module
     * @param {string} moduleName - Module name
     */
    enableModule(moduleName) {
        const moduleInfo = this.modules.get(moduleName);
        if (!moduleInfo) {
            throw new Error(`Module '${moduleName}' not found`);
        }

        moduleInfo.enabled = true;
        logger.logModuleActivity(moduleName, 'Module enabled');
    }

    /**
     * Disable a module
     * @param {string} moduleName - Module name
     */
    disableModule(moduleName) {
        const moduleInfo = this.modules.get(moduleName);
        if (!moduleInfo) {
            throw new Error(`Module '${moduleName}' not found`);
        }

        moduleInfo.enabled = false;
        logger.logModuleActivity(moduleName, 'Module disabled');
    }

    /**
     * Get loaded modules
     * @param {boolean} enabledOnly - Return only enabled modules
     * @returns {Array} Array of module information
     */
    getLoadedModules(enabledOnly = false) {
        const modules = Array.from(this.modules.entries()).map(([name, info]) => ({
            name,
            filename: info.filename,
            loadTime: info.loadTime,
            enabled: info.enabled,
            version: info.instance.version || '1.0.0',
            description: info.instance.description || 'No description',
            commands: info.instance.commands || []
        }));

        return enabledOnly ? modules.filter(m => m.enabled) : modules;
    }

    /**
     * Get module by name
     * @param {string} moduleName - Module name
     * @returns {Object|null} Module information
     */
    getModule(moduleName) {
        const moduleInfo = this.modules.get(moduleName);
        return moduleInfo ? {
            name: moduleName,
            filename: moduleInfo.filename,
            loadTime: moduleInfo.loadTime,
            enabled: moduleInfo.enabled,
            instance: moduleInfo.instance
        } : null;
    }

    /**
     * Check if module is loaded
     * @param {string} moduleName - Module name
     * @returns {boolean} Whether module is loaded
     */
    isModuleLoaded(moduleName) {
        return this.modules.has(moduleName);
    }

    /**
     * Check if module is enabled
     * @param {string} moduleName - Module name
     * @returns {boolean} Whether module is enabled
     */
    isModuleEnabled(moduleName) {
        const moduleInfo = this.modules.get(moduleName);
        return moduleInfo ? moduleInfo.enabled : false;
    }

    /**
     * Get module statistics
     * @returns {Object} Module statistics
     */
    getStats() {
        const modules = Array.from(this.modules.values());
        
        return {
            totalModules: modules.length,
            enabledModules: modules.filter(m => m.enabled).length,
            disabledModules: modules.filter(m => !m.enabled).length,
            oldestModule: modules.reduce((oldest, current) => 
                !oldest || current.loadTime < oldest.loadTime ? current : oldest, null),
            newestModule: modules.reduce((newest, current) => 
                !newest || current.loadTime > newest.loadTime ? current : newest, null)
        };
    }

    /**
     * Emit event to all modules
     * @param {string} event - Event name
     * @param {...any} args - Event arguments
     */
    emit(event, ...args) {
        for (const [moduleName, moduleInfo] of this.modules.entries()) {
            if (!moduleInfo.enabled) continue;

            try {
                const { instance } = moduleInfo;
                
                // Check if module has event handler
                const handlerName = `on${event.charAt(0).toUpperCase()}${event.slice(1)}`;
                if (typeof instance[handlerName] === 'function') {
                    instance[handlerName](...args);
                }

                // Check for generic event handler
                if (typeof instance.onEvent === 'function') {
                    instance.onEvent(event, ...args);
                }

            } catch (error) {
                logger.logError(error, { 
                    context: 'Module event handling',
                    moduleName,
                    event
                });
            }
        }
    }

    /**
     * Register event listener
     * @param {string} event - Event name
     * @param {Function} listener - Event listener function
     * @param {string} moduleName - Module name (for tracking)
     */
    on(event, listener, moduleName = 'unknown') {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }

        this.eventListeners.get(event).push({
            listener,
            moduleName
        });

        logger.logModuleActivity(moduleName, 'Event listener registered', { event });
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} listener - Event listener function
     */
    off(event, listener) {
        const listeners = this.eventListeners.get(event);
        if (!listeners) return;

        const index = listeners.findIndex(l => l.listener === listener);
        if (index !== -1) {
            const removed = listeners.splice(index, 1)[0];
            logger.logModuleActivity(removed.moduleName, 'Event listener removed', { event });
        }
    }

    /**
     * Get module loading errors
     * @returns {Array} Array of loading errors
     */
    getLoadingErrors() {
        // This would be implemented to track loading errors
        // For now, return empty array
        return [];
    }
}

module.exports = ModuleLoader;

