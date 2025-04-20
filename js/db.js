/**
 * 邊緣節點資訊整合平台 - 資料庫模組
 * 使用 IndexedDB 進行本地資料儲存
 */

const DB = {
    // 資料庫名稱與版本
    dbName: 'EdgeNodeDB',
    dbVersion: 2,  // 版本增加，確保索引更新
    db: null,

    // 初始化資料庫
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            // 資料庫升級或創建時調用
            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 建立裝置資料表
                if (!db.objectStoreNames.contains('devices')) {
                    const deviceStore = db.createObjectStore('devices', { keyPath: 'id', autoIncrement: true });
                    deviceStore.createIndex('name', 'name', { unique: false });
                    deviceStore.createIndex('location', 'location', { unique: false });
                }

                // 建立感測資料表
                if (!db.objectStoreNames.contains('sensorData')) {
                    const sensorStore = db.createObjectStore('sensorData', { keyPath: 'id', autoIncrement: true });
                    sensorStore.createIndex('deviceId', 'deviceId', { unique: false });
                    sensorStore.createIndex('timestamp', 'timestamp', { unique: false });
                    // 新增複合索引，用於查詢特定裝置的特定感測器資料
                    sensorStore.createIndex('deviceId_sensorType', ['deviceId', 'sensorType'], { unique: false });
                }

                // 建立警示設定資料表
                if (!db.objectStoreNames.contains('alerts')) {
                    const alertStore = db.createObjectStore('alerts', { keyPath: 'id', autoIncrement: true });
                    alertStore.createIndex('deviceId', 'deviceId', { unique: false });
                    alertStore.createIndex('sensorType', 'sensorType', { unique: false });
                }

                // 建立系統設定資料表
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('資料庫連接成功');
                
                // 檢查是否需要初始化預設資料
                this.initializeDefaultData().then(() => {
                    resolve();
                }).catch(error => {
                    console.error('初始化預設資料失敗:', error);
                    resolve(); // 即使初始化預設資料失敗，仍然視為資料庫連接成功
                });
            };

            request.onerror = (event) => {
                console.error('資料庫錯誤:', event.target.error);
                reject(event.target.error);
            };
        });
    },
    
    // 初始化預設資料
    async initializeDefaultData() {
        try {
            // 檢查是否已有裝置資料
            const devices = await this.devices.getAll();
            
            // 如果沒有裝置資料，新增三個預設裝置
            if (devices.length === 0) {
                console.log('初始化預設裝置資料');
                
                // 預設裝置1：環境監測站
                const device1 = {
                    name: '環境監測站-北區',
                    location: '台北市內湖區',
                    sensors: ['temperature', 'vibration', 'wind', 'solar'],
                    createdAt: new Date().getTime(),
                    updatedAt: new Date().getTime()
                };
                
                // 預設裝置2：土壤監測站
                const device2 = {
                    name: '土壤監測站-中區',
                    location: '台中市西屯區',
                    sensors: ['soil-moisture', 'soil-liquefaction', 'temperature'],
                    createdAt: new Date().getTime() - 86400000, // 1天前
                    updatedAt: new Date().getTime() - 3600000  // 1小時前
                };
                
                // 預設裝置3：結構監測站
                const device3 = {
                    name: '結構監測站-南區',
                    location: '高雄市前鎮區',
                    sensors: ['vibration', 'strain', 'wind'],
                    createdAt: new Date().getTime() - 172800000, // 2天前
                    updatedAt: new Date().getTime() - 7200000  // 2小時前
                };
                
                // 新增預設裝置
                const device1Id = await this.devices.add(device1);
                const device2Id = await this.devices.add(device2);
                const device3Id = await this.devices.add(device3);
                
                // 為每個裝置產生模擬感測資料
                await this.generateMockSensorData(device1Id, device1.sensors);
                await this.generateMockSensorData(device2Id, device2.sensors);
                await this.generateMockSensorData(device3Id, device3.sensors);
                
                console.log('預設裝置資料初始化完成');
                
                // 新增預設警示設定
                const alerts = [
                    {
                        deviceId: device1Id,
                        sensorType: 'temperature',
                        condition: 'greater',
                        threshold: 35,
                        createdAt: new Date().getTime()
                    },
                    {
                        deviceId: device2Id,
                        sensorType: 'soil-moisture',
                        condition: 'less',
                        threshold: 20,
                        createdAt: new Date().getTime()
                    },
                    {
                        deviceId: device3Id,
                        sensorType: 'vibration',
                        condition: 'greater',
                        threshold: 80,
                        createdAt: new Date().getTime()
                    }
                ];
                
                for (const alert of alerts) {
                    await this.alerts.add(alert);
                }
                
                console.log('預設警示設定初始化完成');
            }
        } catch (error) {
            console.error('初始化預設資料失敗:', error);
            throw error;
        }
    },
    
    // 產生模擬感測資料
    async generateMockSensorData(deviceId, sensorTypes) {
        const now = new Date().getTime();
        const sensorInfoMap = {
            'vibration': { minValue: 5, maxValue: 70, unit: 'Hz' },
            'soil-moisture': { minValue: 20, maxValue: 85, unit: '%' },
            'soil-liquefaction': { minValue: 0, maxValue: 30, unit: '%' },
            'temperature': { minValue: 15, maxValue: 32, unit: '°C' },
            'wind': { minValue: 2, maxValue: 15, unit: 'm/s' },
            'strain': { minValue: 100, maxValue: 1000, unit: 'μm/m' },
            'solar': { minValue: 100, maxValue: 1200, unit: 'W/m²' }
        };
        
        // 為每個感測器類型產生3筆資料（最近3小時的資料）
        for (const sensorType of sensorTypes) {
            const sensorInfo = sensorInfoMap[sensorType] || { minValue: 0, maxValue: 100, unit: '' };
            
            for (let i = 0; i < 3; i++) {
                const value = parseFloat((Math.random() * (sensorInfo.maxValue - sensorInfo.minValue) + sensorInfo.minValue).toFixed(2));
                const timestamp = now - (i * 3600000); // 每小時一筆資料
                
                const sensorData = {
                    deviceId,
                    sensorType,
                    value,
                    timestamp
                };
                
                await this.sensorData.add(sensorData);
            }
        }
        
        console.log(`已為裝置 ${deviceId} 產生模擬感測資料`);
    },

    // 一般交易處理函式
    async transaction(storeName, mode, callback) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('資料庫尚未初始化'));
                return;
            }

            const transaction = this.db.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);

            try {
                const result = callback(store);
                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    },

    // 裝置相關操作
    devices: {
        // 取得所有裝置
        async getAll() {
            return DB.transaction('devices', 'readonly', (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.getAll();
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            });
        },

        // 新增裝置
        async add(device) {
            return DB.transaction('devices', 'readwrite', (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.add(device);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            });
        },

        // 更新裝置
        async update(device) {
            return DB.transaction('devices', 'readwrite', (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.put(device);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            });
        },

        // 刪除裝置
        async delete(id) {
            return DB.transaction('devices', 'readwrite', (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.delete(id);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            });
        },

        // 取得指定裝置
        async get(id) {
            return DB.transaction('devices', 'readonly', (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.get(id);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            });
        }
    },

    // 感測資料相關操作
    sensorData: {
        // 新增感測資料
        async add(data) {
            // 確保有時間戳記
            if (!data.timestamp) {
                data.timestamp = new Date().getTime();
            }

            return DB.transaction('sensorData', 'readwrite', (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.add(data);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            });
        },

        // 取得指定裝置的最新感測資料
        async getLatestByDevice(deviceId) {
            return DB.transaction('sensorData', 'readonly', (store) => {
                return new Promise((resolve, reject) => {
                    const index = store.index('deviceId');
                    const request = index.openCursor(IDBKeyRange.only(deviceId), 'prev');
                    
                    const results = {};
                    
                    request.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            const data = cursor.value;
                            
                            // 如果還沒記錄該類型的感測器資料，則記錄
                            if (!results[data.sensorType]) {
                                results[data.sensorType] = data;
                            }
                            
                            // 檢查是否已收集到所有類型的感測器資料
                            if (Object.keys(results).length >= 7) { // 7 種感測器類型
                                resolve(results);
                            } else {
                                cursor.continue();
                            }
                        } else {
                            resolve(results);
                        }
                    };
                    
                    request.onerror = () => reject(request.error);
                });
            });
        },

        // 取得指定裝置和感測器類型的最新資料
        async getLatestByDeviceAndType(deviceId, sensorType) {
            return DB.transaction('sensorData', 'readonly', (store) => {
                return new Promise((resolve, reject) => {
                    const index = store.index('deviceId_sensorType');
                    const range = IDBKeyRange.only([deviceId, sensorType]);
                    
                    // 使用 openCursor 並倒序以獲取最新的數據
                    const request = index.openCursor(range, 'prev');
                    
                    request.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            // 第一個就是最新的
                            resolve(cursor.value);
                        } else {
                            // 沒有找到數據
                            resolve(null);
                        }
                    };
                    
                    request.onerror = (event) => reject(event.target.error);
                });
            });
        },

        // 清除指定裝置的所有感測資料
        async deleteByDevice(deviceId) {
            return DB.transaction('sensorData', 'readwrite', (store) => {
                return new Promise((resolve, reject) => {
                    const index = store.index('deviceId');
                    const request = index.openCursor(IDBKeyRange.only(deviceId));
                    
                    request.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            cursor.delete();
                            cursor.continue();
                        } else {
                            resolve();
                        }
                    };
                    
                    request.onerror = () => reject(request.error);
                });
            });
        }
    },

    // 警示設定相關操作
    alerts: {
        // 取得所有警示設定
        async getAll() {
            return DB.transaction('alerts', 'readonly', (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.getAll();
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            });
        },

        // 新增警示設定
        async add(alert) {
            return DB.transaction('alerts', 'readwrite', (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.add(alert);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            });
        },

        // 更新警示設定
        async update(alert) {
            return DB.transaction('alerts', 'readwrite', (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.put(alert);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            });
        },

        // 刪除警示設定
        async delete(id) {
            return DB.transaction('alerts', 'readwrite', (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.delete(id);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            });
        },

        // 取得指定裝置的所有警示設定
        async getByDevice(deviceId) {
            return DB.transaction('alerts', 'readonly', (store) => {
                return new Promise((resolve, reject) => {
                    const index = store.index('deviceId');
                    const request = index.getAll(IDBKeyRange.only(deviceId));
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            });
        },

        // 檢查是否觸發警示
        async checkAlert(deviceId, sensorType, value) {
            const alerts = await this.getByDevice(deviceId);
            const triggeredAlerts = [];

            for (const alert of alerts) {
                if (alert.sensorType === sensorType) {
                    let isTriggered = false;

                    switch (alert.condition) {
                        case 'greater':
                            isTriggered = value > alert.threshold;
                            break;
                        case 'less':
                            isTriggered = value < alert.threshold;
                            break;
                        case 'equal':
                            isTriggered = value === alert.threshold;
                            break;
                    }

                    if (isTriggered) {
                        triggeredAlerts.push(alert);
                    }
                }
            }

            return triggeredAlerts;
        }
    },

    // 系統設定相關操作
    settings: {
        // 取得設定值
        async get(key) {
            return DB.transaction('settings', 'readonly', (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.get(key);
                    request.onsuccess = () => resolve(request.result ? request.result.value : null);
                    request.onerror = () => reject(request.error);
                });
            });
        },

        // 設定值
        async set(key, value) {
            return DB.transaction('settings', 'readwrite', (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.put({ key, value });
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            });
        },

        // 取得所有設定
        async getAll() {
            return DB.transaction('settings', 'readonly', (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.getAll();
                    request.onsuccess = () => {
                        const settings = {};
                        request.result.forEach(item => {
                            settings[item.key] = item.value;
                        });
                        resolve(settings);
                    };
                    request.onerror = () => reject(request.error);
                });
            });
        },

        // 刪除設定
        async delete(key) {
            return DB.transaction('settings', 'readwrite', (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.delete(key);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            });
        }
    },

    // 匯出所有資料
    async exportData() {
        const devices = await this.devices.getAll();
        const alerts = await this.alerts.getAll();
        const settings = await this.settings.getAll();

        // 取得所有感測資料
        const sensorData = await this.transaction('sensorData', 'readonly', (store) => {
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        });

        return {
            devices,
            sensorData,
            alerts,
            settings
        };
    },

    // 匯入資料
    async importData(data) {
        // 清除現有資料
        await this.clearAllData();

        // 匯入裝置資料
        if (data.devices && Array.isArray(data.devices)) {
            for (const device of data.devices) {
                await this.devices.add(device);
            }
        }

        // 匯入感測資料
        if (data.sensorData && Array.isArray(data.sensorData)) {
            for (const sensorData of data.sensorData) {
                await this.sensorData.add(sensorData);
            }
        }

        // 匯入警示設定
        if (data.alerts && Array.isArray(data.alerts)) {
            for (const alert of data.alerts) {
                await this.alerts.add(alert);
            }
        }

        // 匯入系統設定
        if (data.settings) {
            for (const [key, value] of Object.entries(data.settings)) {
                await this.settings.set(key, value);
            }
        }
    },

    // 清除所有資料
    async clearAllData() {
        const storeNames = ['devices', 'sensorData', 'alerts', 'settings'];
        
        for (const storeName of storeNames) {
            await this.transaction(storeName, 'readwrite', (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            });
        }
    }
};

// 初始化資料庫
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await DB.init();
        console.log('資料庫初始化完成');
    } catch (error) {
        console.error('資料庫初始化失敗:', error);
    }
}); 