import { db } from './db.js';

class ConfigService {
    constructor() {
        this.cache = new Map();
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        console.log('🔄 Menginisialisasi dan memuat cache konfigurasi...');
        const [rows] = await db.query('SELECT `key`, `value` FROM `bot_config`');
        for (const row of rows) {
            this.cache.set(row.key, row.value);
        }
        this.isInitialized = true;
        console.log(`✅ Cache konfigurasi dimuat dengan ${this.cache.size} item.`);
    }

    get(key, defaultValue = null) {
        return this.cache.get(key) || defaultValue;
    }

    isFeatureEnabled(featureKey) {
        const fullKey = `feature_${featureKey}_enabled`;
        return this.get(fullKey, '0') === '1';
    }

    isMaintenanceMode() {
        return this.get('maintenance_mode_enabled', '0') === '1';
    }

    async set(key, value) {
        // Update cache terlebih dahulu untuk respon yang cepat
        this.cache.set(key, value);
        // Kemudian update database
        await db.query(
            'INSERT INTO `bot_config` (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
            [key, value]
        );
        console.log(`🔧 Konfigurasi diperbarui: ${key} -> ${value}`);
    }
}

// Ekspor sebagai instance singleton
export const configService = new ConfigService();
