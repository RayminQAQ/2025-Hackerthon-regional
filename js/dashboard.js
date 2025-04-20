/**
 * 邊緣節點資訊整合平台 - 儀表板模組
 * 用於處理儀表板頁面的顯示和互動功能
 */

const Dashboard = {
    // 初始化
    init() {
        this.updateSummary();
        this.loadNodesList();
        this.setupEventListeners();
        
        // 如果開啟了模擬資料生成，定期更新資料
        if (CONFIG.system.generateMockData) {
            this.startDataGeneration();
        }
    },

    // 設置事件監聽器
    setupEventListeners() {
        // 重新整理按鈕
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.updateSummary();
            this.loadNodesList();
            this.showSensorData();
        });

        // 新增節點按鈕 (使用裝置管理的模態視窗)
        document.getElementById('add-node-btn').addEventListener('click', () => {
            const modal = document.getElementById('add-device-modal');
            modal.classList.add('active');
        });

        // 節點選擇器變更
        document.getElementById('node-selector').addEventListener('change', (e) => {
            const deviceId = parseInt(e.target.value);
            if (deviceId) {
                this.showSensorData(deviceId);
            } else {
                document.getElementById('sensor-readings').innerHTML = `
                    <div class="alert info">
                        <i class="fas fa-info-circle"></i>
                        請選擇一個節點以查看感測器資料
                    </div>
                `;
            }
        });
    },

    // 更新摘要資訊
    async updateSummary() {
        try {
            // 取得裝置數量
            const devices = await DB.devices.getAll();
            document.getElementById('connected-nodes').textContent = devices.length;

            // 取得警示數量
            const alerts = await DB.alerts.getAll();
            document.getElementById('alert-count').textContent = alerts.length;

            // 更新節點選擇器
            this.updateNodeSelector(devices);
        } catch (error) {
            console.error('更新摘要失敗:', error);
            this.showError('更新摘要資訊時發生錯誤');
        }
    },

    // 更新節點選擇器
    updateNodeSelector(devices) {
        const selector = document.getElementById('node-selector');
        
        // 清除現有選項，但保留預設選項
        while (selector.options.length > 1) {
            selector.remove(1);
        }
        
        // 添加裝置選項
        if (devices && devices.length > 0) {
            devices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.id;
                option.textContent = device.name;
                selector.appendChild(option);
            });
        }
    },

    // 載入節點列表
    async loadNodesList() {
        try {
            const nodesList = document.getElementById('nodes-list');
            const devices = await DB.devices.getAll();
            
            if (devices.length === 0) {
                nodesList.innerHTML = `
                    <div class="alert info">
                        <i class="fas fa-info-circle"></i>
                        尚未添加任何裝置，請點擊「新增節點」按鈕添加
                    </div>
                `;
                return;
            }
            
            let html = '';
            
            for (const device of devices) {
                // 根據裝置狀態設置樣式
                const statusClass = this.getStatusClass(device);
                const statusText = this.getStatusText(device);
                
                html += `
                    <div class="node-item" data-id="${device.id}">
                        <div class="node-status">
                            <span class="status ${statusClass}" title="${statusText}"></span>
                        </div>
                        <div class="node-info">
                            <span class="node-name">${device.name}</span>
                            <span class="node-location">${device.location}</span>
                        </div>
                        <div class="node-actions">
                            <button class="view-node" title="查看詳情"><i class="fas fa-eye"></i></button>
                            <button class="edit-node" title="編輯節點"><i class="fas fa-edit"></i></button>
                            <button class="delete-node" title="刪除節點"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `;
            }
            
            nodesList.innerHTML = html;
            
            // 添加節點操作的事件監聽器
            this.setupNodeActions();
        } catch (error) {
            console.error('載入節點列表失敗:', error);
            this.showError('載入節點列表時發生錯誤');
        }
    },

    // 設置節點操作的事件監聽器
    setupNodeActions() {
        // 查看節點詳情
        document.querySelectorAll('.view-node').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const nodeItem = e.target.closest('.node-item');
                const deviceId = parseInt(nodeItem.dataset.id);
                this.showNodeDetails(deviceId);
            });
        });
        
        // 編輯節點
        document.querySelectorAll('.edit-node').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const nodeItem = e.target.closest('.node-item');
                const deviceId = parseInt(nodeItem.dataset.id);
                // 調用裝置管理模組的編輯功能
                if (typeof DeviceManager !== 'undefined') {
                    DeviceManager.editDevice(deviceId);
                }
            });
        });
        
        // 刪除節點
        document.querySelectorAll('.delete-node').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const nodeItem = e.target.closest('.node-item');
                const deviceId = parseInt(nodeItem.dataset.id);
                
                // 確認刪除
                if (confirm('確定要刪除此節點嗎？此操作將會刪除該節點的所有資料，且無法恢復。')) {
                    this.deleteNode(deviceId);
                }
            });
        });
    },

    // 刪除節點
    async deleteNode(deviceId) {
        try {
            // 刪除裝置
            await DB.devices.delete(deviceId);
            
            // 刪除相關感測資料
            await DB.sensorData.deleteByDevice(deviceId);
            
            // 刪除相關警示設定
            const alerts = await DB.alerts.getByDevice(deviceId);
            for (const alert of alerts) {
                await DB.alerts.delete(alert.id);
            }
            
            // 重新載入節點列表和摘要
            this.updateSummary();
            this.loadNodesList();
            
            // 顯示成功訊息
            this.showSuccess('節點已成功刪除');
        } catch (error) {
            console.error('刪除節點失敗:', error);
            this.showError('刪除節點時發生錯誤');
        }
    },

    // 顯示節點詳情
    async showNodeDetails(deviceId) {
        try {
            const device = await DB.devices.get(deviceId);
            if (!device) {
                this.showError('找不到指定的節點');
                return;
            }
            
            // 取得該裝置的警示設定
            const alerts = await DB.alerts.getByDevice(deviceId);
            
            const modal = document.getElementById('node-detail-modal');
            const content = document.getElementById('node-detail-content');
            
            // 先顯示載入中狀態
            content.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> 載入中...</div>';
            modal.classList.add('active');
            
            let sensorsHtml = '';
            let isEmpty = true;
            
            // 產生感測器資料 HTML
            if (device.sensors && device.sensors.length > 0) {
                sensorsHtml = '<div class="sensor-readings">';
                
                // 使用 Promise.all 同時獲取所有感測器的最新數值
                const sensorPromises = device.sensors.map(async sensorType => {
                    const sensorInfo = this.getSensorInfo(sensorType);
                    const sensorData = await this.getLatestSensorValue(sensorType, deviceId);
                    
                    return `
                        <div class="sensor-card">
                            <div class="sensor-icon"><i class="${sensorInfo.icon}"></i></div>
                            <div class="sensor-name">${sensorInfo.name}</div>
                            <div class="sensor-value">${sensorData.value}</div>
                            <div class="sensor-unit">${sensorInfo.unit}</div>
                        </div>
                    `;
                });
                
                const sensorCards = await Promise.all(sensorPromises);
                sensorsHtml += sensorCards.join('') + '</div>';
                isEmpty = sensorCards.length === 0;
            }
            
            if (isEmpty) {
                sensorsHtml = `
                    <div class="alert info">
                        <i class="fas fa-info-circle"></i>
                        該節點尚未有任何感測資料
                    </div>
                `;
            }
            
            // 產生警示設定 HTML
            let alertsHtml = '';
            
            if (alerts && alerts.length > 0) {
                alertsHtml = '<div class="node-detail-alerts"><h5>警示設定</h5><ul>';
                
                alerts.forEach(alert => {
                    const sensorInfo = this.getSensorInfo(alert.sensorType);
                    const conditionText = this.getConditionText(alert.condition);
                    
                    alertsHtml += `
                        <li>
                            <i class="${sensorInfo.icon}"></i>
                            ${sensorInfo.name} ${conditionText} ${alert.threshold} ${sensorInfo.unit}
                        </li>
                    `;
                });
                
                alertsHtml += '</ul></div>';
            }
            
            // 產生節點詳情 HTML
            content.innerHTML = `
                <div class="node-detail-header">
                    <div class="node-icon"><i class="fas fa-microchip"></i></div>
                    <div class="node-title">
                        <h4>${device.name}</h4>
                        <p>${device.location}</p>
                    </div>
                </div>
                
                <div class="node-detail-info">
                    <div class="info-item">
                        <i class="fas fa-calendar-alt"></i>
                        <span>新增時間: ${new Date(device.createdAt).toLocaleString()}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-clock"></i>
                        <span>最後更新: ${new Date(device.updatedAt || device.createdAt).toLocaleString()}</span>
                    </div>
                </div>
                
                <div class="node-detail-sensors">
                    <h5>感測器資料</h5>
                    ${sensorsHtml}
                </div>
                
                ${alertsHtml}
            `;
            
            // 設置關閉按鈕
            modal.querySelector('.close-modal').addEventListener('click', () => {
                modal.classList.remove('active');
            });
        } catch (error) {
            console.error('顯示節點詳情失敗:', error);
            this.showError('顯示節點詳情時發生錯誤');
        }
    },

    // 顯示感測器數據
    async showSensorData(deviceId) {
        try {
            const container = document.getElementById('sensor-readings');
            
            if (!deviceId) {
                // 從選擇器中取得值
                const selector = document.getElementById('node-selector');
                deviceId = parseInt(selector.value);
                
                if (!deviceId) {
                    container.innerHTML = `
                        <div class="alert info">
                            <i class="fas fa-info-circle"></i>
                            請選擇一個節點以查看感測器資料
                        </div>
                    `;
                    return;
                }
            }
            
            // 取得裝置資訊
            const device = await DB.devices.get(deviceId);
            if (!device) {
                this.showError('找不到指定的節點');
                return;
            }
            
            // 如果裝置沒有感測器，顯示提示訊息
            if (!device.sensors || device.sensors.length === 0) {
                container.innerHTML = `
                    <div class="alert info">
                        <i class="fas fa-info-circle"></i>
                        該節點尚未配置任何感測器
                    </div>
                `;
                return;
            }
            
            // 先顯示載入中的狀態
            container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> 載入中...</div>';
            
            // 產生感測器資料 HTML
            let html = '<div class="sensor-readings">';
            
            // 使用 Promise.all 同時獲取所有感測器的最新數值
            const sensorPromises = device.sensors.map(async sensorType => {
                const sensorInfo = this.getSensorInfo(sensorType);
                const sensorData = await this.getLatestSensorValue(sensorType, deviceId);
                
                return `
                    <div class="sensor-card">
                        <div class="sensor-icon"><i class="${sensorInfo.icon}"></i></div>
                        <div class="sensor-name">${sensorInfo.name}</div>
                        <div class="sensor-value">${sensorData.value}</div>
                        <div class="sensor-unit">${sensorInfo.unit}</div>
                    </div>
                `;
            });
            
            const sensorCards = await Promise.all(sensorPromises);
            html += sensorCards.join('') + '</div>';
            container.innerHTML = html;
        } catch (error) {
            console.error('顯示感測器資料失敗:', error);
            this.showError('顯示感測器資料時發生錯誤');
        }
    },

    // 開始生成模擬資料
    startDataGeneration() {
        if (this.dataGenerationInterval) {
            clearInterval(this.dataGenerationInterval);
        }
        
        // 定期生成模擬資料
        this.dataGenerationInterval = setInterval(async () => {
            try {
                const devices = await DB.devices.getAll();
                
                for (const device of devices) {
                    if (device.sensors && device.sensors.length > 0) {
                        for (const sensorType of device.sensors) {
                            await this.generateSensorData(device.id, sensorType);
                        }
                    }
                }
                
                // 更新當前選擇的節點的感測器資料顯示
                const selector = document.getElementById('node-selector');
                if (selector.value) {
                    this.showSensorData(parseInt(selector.value));
                }
            } catch (error) {
                console.error('生成模擬資料失敗:', error);
            }
        }, CONFIG.system.dataUpdateInterval);
    },

    // 停止生成模擬資料
    stopDataGeneration() {
        if (this.dataGenerationInterval) {
            clearInterval(this.dataGenerationInterval);
            this.dataGenerationInterval = null;
        }
    },

    // 生成感測器模擬資料
    async generateSensorData(deviceId, sensorType) {
        try {
            // 取得該感測器的基本資訊
            const sensorInfo = this.getSensorInfo(sensorType);
            
            // 產生隨機值，在有效範圍內
            const value = this.generateRandomValue(sensorInfo.minValue, sensorInfo.maxValue);
            
            // 建立感測資料物件
            const sensorData = {
                deviceId,
                sensorType,
                value,
                timestamp: new Date().getTime()
            };
            
            // 儲存感測資料
            await DB.sensorData.add(sensorData);
            
            // 檢查是否觸發警示
            const triggeredAlerts = await DB.alerts.checkAlert(deviceId, sensorType, value);
            if (triggeredAlerts.length > 0) {
                for (const alert of triggeredAlerts) {
                    this.showAlert(deviceId, sensorType, value, alert);
                }
            }
            
            return sensorData;
        } catch (error) {
            console.error('生成感測器資料失敗:', error);
            throw error;
        }
    },

    // 產生隨機值
    generateRandomValue(min, max) {
        return parseFloat((Math.random() * (max - min) + min).toFixed(2));
    },

    // 取得感測器資訊
    getSensorInfo(sensorType) {
        const sensorInfoMap = {
            'vibration': {
                name: '環境震動',
                icon: 'fas fa-wave-square',
                unit: 'Hz',
                minValue: 0,
                maxValue: 100
            },
            'soil-moisture': {
                name: '土壤濕度',
                icon: 'fas fa-tint',
                unit: '%',
                minValue: 0,
                maxValue: 100
            },
            'soil-liquefaction': {
                name: '土壤液化',
                icon: 'fas fa-water',
                unit: '%',
                minValue: 0,
                maxValue: 100
            },
            'temperature': {
                name: '溫度',
                icon: 'fas fa-thermometer-half',
                unit: '°C',
                minValue: -20,
                maxValue: 50
            },
            'wind': {
                name: '風力',
                icon: 'fas fa-wind',
                unit: 'm/s',
                minValue: 0,
                maxValue: 30
            },
            'strain': {
                name: '應變',
                icon: 'fas fa-arrows-alt-h',
                unit: 'μm/m',
                minValue: 0,
                maxValue: 2000
            },
            'solar': {
                name: '太陽能',
                icon: 'fas fa-sun',
                unit: 'W/m²',
                minValue: 0,
                maxValue: 1500
            }
        };
        
        return sensorInfoMap[sensorType] || {
            name: '未知感測器',
            icon: 'fas fa-question-circle',
            unit: '',
            minValue: 0,
            maxValue: 100
        };
    },

    // 取得最新的感測器數值
    async getLatestSensorValue(sensorType, deviceId) {
        try {
            // 從資料庫中取得最新的感測器資料
            const latestData = await DB.sensorData.getLatestByDeviceAndType(deviceId, sensorType);
            
            if (latestData) {
                return {
                    value: latestData.value,
                    timestamp: latestData.timestamp
                };
            } else {
                // 如果沒有資料，回傳模擬資料
                const sensorInfo = this.getSensorInfo(sensorType);
                return {
                    value: this.generateRandomValue(sensorInfo.minValue, sensorInfo.maxValue),
                    timestamp: new Date().getTime()
                };
            }
        } catch (error) {
            console.error(`取得感測器資料失敗: ${sensorType}`, error);
            
            // 發生錯誤時回傳模擬資料
            const sensorInfo = this.getSensorInfo(sensorType);
            return {
                value: this.generateRandomValue(sensorInfo.minValue, sensorInfo.maxValue),
                timestamp: new Date().getTime()
            };
        }
    },

    // 取得裝置狀態樣式
    getStatusClass(device) {
        // 在實際應用中，狀態應該根據裝置的通訊狀態來決定
        // 這裡先使用模擬的狀態
        const random = Math.random();
        
        if (random > 0.8) {
            return 'warning';
        } else if (random > 0.95) {
            return 'error';
        } else {
            return 'online';
        }
    },

    // 取得裝置狀態文字
    getStatusText(device) {
        const statusClass = this.getStatusClass(device);
        
        switch (statusClass) {
            case 'online':
                return '在線';
            case 'offline':
                return '離線';
            case 'warning':
                return '警告';
            case 'error':
                return '錯誤';
            default:
                return '未知狀態';
        }
    },

    // 取得條件文字
    getConditionText(condition) {
        switch (condition) {
            case 'greater':
                return '大於';
            case 'less':
                return '小於';
            case 'equal':
                return '等於';
            default:
                return '未知條件';
        }
    },

    // 顯示警示
    showAlert(deviceId, sensorType, value, alert) {
        // 在實際應用中，這裡應該顯示警示通知或記錄警示
        console.log(`警示: 裝置 ${deviceId} 的 ${sensorType} 感測器值 ${value} ${this.getConditionText(alert.condition)} ${alert.threshold}`);
    },

    // 顯示錯誤訊息
    showError(message) {
        console.error(message);
        // 在實際應用中，這裡應該顯示錯誤通知
        alert(message);
    },

    // 顯示成功訊息
    showSuccess(message) {
        console.log(message);
        // 在實際應用中，這裡應該顯示成功通知
    }
};

// 當頁面載入完成時初始化儀表板
document.addEventListener('DOMContentLoaded', () => {
    // 等待資料庫和配置初始化完成後再初始化儀表板
    setTimeout(() => {
        Dashboard.init();
    }, 1500);
}); 