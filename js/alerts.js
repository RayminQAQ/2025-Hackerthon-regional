/**
 * 邊緣節點資訊整合平台 - 警示設定模組
 * 用於處理警示設定的新增、編輯、刪除等操作
 */

const AlertManager = {
    // 初始化
    init() {
        this.loadAlertsList();
        this.setupEventListeners();
        this.updateDeviceSelector();
    },

    // 設置事件監聽器
    setupEventListeners() {
        // 新增警示表單提交
        document.getElementById('new-alert-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addAlert();
        });

        // 選擇節點後更新感測器選擇器
        document.getElementById('alert-node').addEventListener('change', (e) => {
            this.updateSensorSelector(e.target.value);
        });
    },

    // 更新裝置選擇器
    async updateDeviceSelector() {
        try {
            const devices = await DB.devices.getAll();
            const selector = document.getElementById('alert-node');
            
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
        } catch (error) {
            console.error('更新裝置選擇器失敗:', error);
            this.showError('更新裝置選擇器時發生錯誤');
        }
    },

    // 更新感測器選擇器
    async updateSensorSelector(deviceId) {
        try {
            if (!deviceId) {
                this.resetSensorSelector();
                return;
            }
            
            const device = await DB.devices.get(parseInt(deviceId));
            const selector = document.getElementById('alert-sensor');
            
            // 清除現有選項，但保留預設選項
            while (selector.options.length > 1) {
                selector.remove(1);
            }
            
            // 添加感測器選項
            if (device && device.sensors && device.sensors.length > 0) {
                device.sensors.forEach(sensorType => {
                    const sensorInfo = this.getSensorInfo(sensorType);
                    const option = document.createElement('option');
                    option.value = sensorType;
                    option.textContent = sensorInfo.name;
                    selector.appendChild(option);
                });
            } else {
                selector.innerHTML = '<option value="">該裝置尚未配置感測器</option>';
            }
        } catch (error) {
            console.error('更新感測器選擇器失敗:', error);
            this.showError('更新感測器選擇器時發生錯誤');
        }
    },

    // 重置感測器選擇器
    resetSensorSelector() {
        const selector = document.getElementById('alert-sensor');
        selector.innerHTML = '<option value="">選擇感測器</option>';
    },

    // 新增警示
    async addAlert() {
        try {
            const form = document.getElementById('new-alert-form');
            
            // 收集表單資料
            const deviceId = parseInt(document.getElementById('alert-node').value);
            const sensorType = document.getElementById('alert-sensor').value;
            const condition = document.getElementById('alert-condition').value;
            const threshold = parseFloat(document.getElementById('alert-value').value);
            
            // 檢查必填欄位
            if (!deviceId || !sensorType || !condition || isNaN(threshold)) {
                this.showError('請填寫所有必填欄位');
                return;
            }
            
            // 檢查是否已存在相同的警示設定
            const existingAlerts = await DB.alerts.getByDevice(deviceId);
            const isDuplicate = existingAlerts.some(alert => 
                alert.sensorType === sensorType && 
                alert.condition === condition && 
                alert.threshold === threshold
            );
            
            if (isDuplicate) {
                this.showError('已存在相同的警示設定');
                return;
            }
            
            // 建立警示物件
            const alert = {
                deviceId,
                sensorType,
                condition,
                threshold,
                createdAt: new Date().getTime()
            };
            
            // 新增警示
            await DB.alerts.add(alert);
            
            // 重置表單
            form.reset();
            
            // 重新載入警示列表
            this.loadAlertsList();
            
            // 如果儀表板已初始化，更新儀表板
            if (typeof Dashboard !== 'undefined') {
                Dashboard.updateSummary();
            }
            
            this.showSuccess('警示已成功新增');
        } catch (error) {
            console.error('新增警示失敗:', error);
            this.showError('新增警示時發生錯誤');
        }
    },

    // 刪除警示
    async deleteAlert(alertId) {
        try {
            // 確認刪除
            if (!confirm('確定要刪除此警示設定嗎？')) {
                return;
            }
            
            // 刪除警示
            await DB.alerts.delete(alertId);
            
            // 重新載入警示列表
            this.loadAlertsList();
            
            // 如果儀表板已初始化，更新儀表板
            if (typeof Dashboard !== 'undefined') {
                Dashboard.updateSummary();
            }
            
            this.showSuccess('警示已成功刪除');
        } catch (error) {
            console.error('刪除警示失敗:', error);
            this.showError('刪除警示時發生錯誤');
        }
    },

    // 載入警示列表
    async loadAlertsList() {
        try {
            const alertsList = document.getElementById('alerts-list');
            const alerts = await DB.alerts.getAll();
            
            if (alerts.length === 0) {
                alertsList.innerHTML = `
                    <div class="alert info">
                        <i class="fas fa-info-circle"></i>
                        尚未添加任何警示設定，請使用右側表單新增
                    </div>
                `;
                return;
            }
            
            let html = '';
            
            // 將警示根據裝置分組
            const deviceAlerts = {};
            
            for (const alert of alerts) {
                if (!deviceAlerts[alert.deviceId]) {
                    deviceAlerts[alert.deviceId] = [];
                }
                deviceAlerts[alert.deviceId].push(alert);
            }
            
            // 取得所有裝置
            const devices = await DB.devices.getAll();
            const deviceMap = {};
            devices.forEach(device => {
                deviceMap[device.id] = device;
            });
            
            // 產生警示列表 HTML
            for (const [deviceId, deviceAlertsArray] of Object.entries(deviceAlerts)) {
                const device = deviceMap[deviceId];
                
                if (!device) continue; // 跳過已刪除的裝置
                
                html += `
                    <div class="device-alerts">
                        <h4>${device.name}</h4>
                `;
                
                for (const alert of deviceAlertsArray) {
                    const sensorInfo = this.getSensorInfo(alert.sensorType);
                    const conditionText = this.getConditionText(alert.condition);
                    
                    html += `
                        <div class="alert-item" data-id="${alert.id}">
                            <div class="alert-info">
                                <div class="alert-icon ${this.getAlertIconClass(alert.condition)}">
                                    <i class="${sensorInfo.icon}"></i>
                                </div>
                                <div class="alert-details">
                                    <h4>${sensorInfo.name}</h4>
                                    <p>${conditionText} ${alert.threshold} ${sensorInfo.unit}</p>
                                </div>
                            </div>
                            <div class="alert-actions">
                                <button class="delete-alert" title="刪除警示"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    `;
                }
                
                html += '</div>';
            }
            
            alertsList.innerHTML = html;
            
            // 添加刪除警示的事件監聽器
            document.querySelectorAll('.delete-alert').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const alertItem = e.target.closest('.alert-item');
                    const alertId = parseInt(alertItem.dataset.id);
                    this.deleteAlert(alertId);
                });
            });
        } catch (error) {
            console.error('載入警示列表失敗:', error);
            this.showError('載入警示列表時發生錯誤');
        }
    },

    // 取得感測器資訊
    getSensorInfo(sensorType) {
        const sensorInfoMap = {
            'vibration': {
                name: '環境震動',
                icon: 'fas fa-wave-square',
                unit: 'Hz'
            },
            'soil-moisture': {
                name: '土壤濕度',
                icon: 'fas fa-tint',
                unit: '%'
            },
            'soil-liquefaction': {
                name: '土壤液化',
                icon: 'fas fa-water',
                unit: '%'
            },
            'temperature': {
                name: '溫度',
                icon: 'fas fa-thermometer-half',
                unit: '°C'
            },
            'wind': {
                name: '風力',
                icon: 'fas fa-wind',
                unit: 'm/s'
            },
            'strain': {
                name: '應變',
                icon: 'fas fa-arrows-alt-h',
                unit: 'μm/m'
            },
            'solar': {
                name: '太陽能',
                icon: 'fas fa-sun',
                unit: 'W/m²'
            }
        };
        
        return sensorInfoMap[sensorType] || {
            name: '未知感測器',
            icon: 'fas fa-question-circle',
            unit: ''
        };
    },

    // a取得條件文字
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

    // 取得警示圖示樣式
    getAlertIconClass(condition) {
        switch (condition) {
            case 'greater':
                return 'warning';
            case 'less':
                return 'warning';
            case 'equal':
                return 'warning';
            default:
                return '';
        }
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

// 當頁面載入完成時初始化警示管理
document.addEventListener('DOMContentLoaded', () => {
    // 等待資料庫初始化完成後再初始化警示管理
    setTimeout(() => {
        AlertManager.init();
    }, 1500);
}); 