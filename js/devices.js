/**
 * 邊緣節點資訊整合平台 - 裝置管理模組
 * 用於處理裝置的新增、編輯、刪除等操作
 */

const DeviceManager = {
    // 初始化
    init() {
        this.loadDevicesList();
        this.setupEventListeners();
    },

    // 設置事件監聽器
    setupEventListeners() {
        // 新增裝置按鈕
        document.getElementById('add-device-btn').addEventListener('click', () => {
            this.showAddDeviceModal();
        });

        // 新增裝置表單提交
        document.getElementById('add-device-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addDevice();
        });

        // 模態視窗關閉按鈕
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.remove('active');
            });
        });

        // 點擊模態視窗外部關閉
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    },

    // 顯示新增裝置模態視窗
    showAddDeviceModal() {
        // 重置表單
        document.getElementById('add-device-form').reset();
        
        // 修改標題和提交按鈕文字
        const modal = document.getElementById('add-device-modal');
        modal.querySelector('.modal-header h3').textContent = '新增裝置';
        modal.querySelector('button[type="submit"]').textContent = '新增';
        
        // 移除編輯模式的裝置 ID
        modal.querySelector('form').removeAttribute('data-device-id');
        
        // 顯示模態視窗
        modal.classList.add('active');
    },

    // 顯示編輯裝置模態視窗
    async showEditDeviceModal(deviceId) {
        try {
            // 獲取裝置資料
            const device = await DB.devices.get(deviceId);
            if (!device) {
                this.showError('找不到指定的裝置');
                return;
            }
            
            // 填充表單
            const form = document.getElementById('add-device-form');
            form.reset();
            
            form.setAttribute('data-device-id', deviceId);
            document.getElementById('device-name').value = device.name;
            document.getElementById('device-location').value = device.location;
            
            // 選中感測器類型
            if (device.sensors && device.sensors.length > 0) {
                const checkboxes = form.querySelectorAll('input[name="sensor-type"]');
                checkboxes.forEach(checkbox => {
                    if (device.sensors.includes(checkbox.value)) {
                        checkbox.checked = true;
                    }
                });
            }
            
            // 修改標題和提交按鈕文字
            const modal = document.getElementById('add-device-modal');
            modal.querySelector('.modal-header h3').textContent = '編輯裝置';
            modal.querySelector('button[type="submit"]').textContent = '儲存';
            
            // 顯示模態視窗
            modal.classList.add('active');
        } catch (error) {
            console.error('顯示編輯裝置模態視窗失敗:', error);
            this.showError('顯示編輯裝置模態視窗時發生錯誤');
        }
    },

    // 新增或更新裝置
    async addDevice() {
        try {
            const form = document.getElementById('add-device-form');
            const deviceId = form.getAttribute('data-device-id');
            const isEditing = !!deviceId;
            
            // 收集表單資料
            const name = document.getElementById('device-name').value.trim();
            const location = document.getElementById('device-location').value.trim();
            
            // 檢查必填欄位
            if (!name || !location) {
                this.showError('請填寫所有必填欄位');
                return;
            }
            
            // 收集選中的感測器類型
            const selectedSensors = [];
            form.querySelectorAll('input[name="sensor-type"]:checked').forEach(checkbox => {
                selectedSensors.push(checkbox.value);
            });
            
            // 建立裝置物件
            const device = {
                name,
                location,
                sensors: selectedSensors,
                createdAt: isEditing ? undefined : new Date().getTime(),
                updatedAt: new Date().getTime()
            };
            
            // 新增或更新裝置
            if (isEditing) {
                // 更新現有裝置
                device.id = parseInt(deviceId);
                await DB.devices.update(device);
                this.showSuccess('裝置已成功更新');
            } else {
                // 新增裝置
                await DB.devices.add(device);
                this.showSuccess('裝置已成功新增');
            }
            
            // 關閉模態視窗
            document.getElementById('add-device-modal').classList.remove('active');
            
            // 重新載入裝置列表
            this.loadDevicesList();
            
            // 如果儀表板已初始化，更新儀表板
            if (typeof Dashboard !== 'undefined') {
                Dashboard.updateSummary();
                Dashboard.loadNodesList();
            }
        } catch (error) {
            console.error('新增/更新裝置失敗:', error);
            this.showError('新增/更新裝置時發生錯誤');
        }
    },

    // 編輯裝置
    editDevice(deviceId) {
        this.showEditDeviceModal(deviceId);
    },

    // 刪除裝置
    async deleteDevice(deviceId) {
        try {
            // 確認刪除
            if (!confirm('確定要刪除此裝置嗎？此操作將會刪除該裝置的所有資料，且無法恢復。')) {
                return;
            }
            
            // 刪除裝置
            await DB.devices.delete(deviceId);
            
            // 刪除相關感測資料
            await DB.sensorData.deleteByDevice(deviceId);
            
            // 刪除相關警示設定
            const alerts = await DB.alerts.getByDevice(deviceId);
            for (const alert of alerts) {
                await DB.alerts.delete(alert.id);
            }
            
            // 重新載入裝置列表
            this.loadDevicesList();
            
            // 如果儀表板已初始化，更新儀表板
            if (typeof Dashboard !== 'undefined') {
                Dashboard.updateSummary();
                Dashboard.loadNodesList();
            }
            
            this.showSuccess('裝置已成功刪除');
        } catch (error) {
            console.error('刪除裝置失敗:', error);
            this.showError('刪除裝置時發生錯誤');
        }
    },

    // 載入裝置列表
    async loadDevicesList() {
        try {
            const devicesContainer = document.getElementById('devices-container');
            const devices = await DB.devices.getAll();
            
            if (devices.length === 0) {
                devicesContainer.innerHTML = `
                    <div class="alert info">
                        <i class="fas fa-info-circle"></i>
                        尚未添加任何裝置，請點擊「新增裝置」按鈕添加
                    </div>
                `;
                return;
            }
            
            let html = '';
            
            for (const device of devices) {
                // 計算每個感測器的標籤
                let sensorsHtml = '';
                if (device.sensors && device.sensors.length > 0) {
                    device.sensors.forEach(sensor => {
                        const sensorInfo = this.getSensorInfo(sensor);
                        sensorsHtml += `
                            <div class="sensor-tag">
                                <i class="${sensorInfo.icon}"></i> ${sensorInfo.name}
                            </div>
                        `;
                    });
                } else {
                    sensorsHtml = '<div class="alert info">尚未配置感測器</div>';
                }
                
                // 裝置狀態
                const statusClass = this.getStatusClass(device);
                const statusText = this.getStatusText(device);
                
                html += `
                    <div class="device-card" data-id="${device.id}">
                        <div class="device-header">
                            <h3>${device.name}</h3>
                            <span class="status ${statusClass}" title="${statusText}"></span>
                        </div>
                        <div class="device-content">
                            <div class="device-info">
                                <p><i class="fas fa-map-marker-alt"></i> ${device.location}</p>
                                <p><i class="fas fa-calendar-alt"></i> 新增時間: ${new Date(device.createdAt).toLocaleString()}</p>
                                <p><i class="fas fa-clock"></i> 最後更新: ${new Date(device.updatedAt || device.createdAt).toLocaleString()}</p>
                            </div>
                            <div class="device-sensors">
                                ${sensorsHtml}
                            </div>
                            <div class="device-footer">
                                <button class="secondary view-device-data"><i class="fas fa-chart-line"></i> 查看資料</button>
                                <button class="edit-device"><i class="fas fa-edit"></i> 編輯</button>
                                <button class="danger delete-device"><i class="fas fa-trash"></i> 刪除</button>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            devicesContainer.innerHTML = html;
            
            // 添加裝置操作的事件監聽器
            this.setupDeviceActions();
        } catch (error) {
            console.error('載入裝置列表失敗:', error);
            this.showError('載入裝置列表時發生錯誤');
        }
    },

    // 設置裝置操作的事件監聽器
    setupDeviceActions() {
        // 查看裝置資料
        document.querySelectorAll('.view-device-data').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deviceCard = e.target.closest('.device-card');
                const deviceId = parseInt(deviceCard.dataset.id);
                
                // 切換到儀表板頁面並選擇該裝置
                document.querySelector('.sidebar nav ul li a[href="#dashboard"]').click();
                document.getElementById('node-selector').value = deviceId;
                
                // 觸發 change 事件以顯示該裝置的感測器資料
                const event = new Event('change');
                document.getElementById('node-selector').dispatchEvent(event);
            });
        });
        
        // 編輯裝置
        document.querySelectorAll('.edit-device').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deviceCard = e.target.closest('.device-card');
                const deviceId = parseInt(deviceCard.dataset.id);
                this.editDevice(deviceId);
            });
        });
        
        // 刪除裝置
        document.querySelectorAll('.delete-device').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deviceCard = e.target.closest('.device-card');
                const deviceId = parseInt(deviceCard.dataset.id);
                this.deleteDevice(deviceId);
            });
        });
    },

    // 取得感測器資訊
    getSensorInfo(sensorType) {
        const sensorInfoMap = {
            'vibration': {
                name: '環境震動',
                icon: 'fas fa-wave-square'
            },
            'soil-moisture': {
                name: '土壤濕度',
                icon: 'fas fa-tint'
            },
            'soil-liquefaction': {
                name: '土壤液化',
                icon: 'fas fa-water'
            },
            'temperature': {
                name: '溫度',
                icon: 'fas fa-thermometer-half'
            },
            'wind': {
                name: '風力',
                icon: 'fas fa-wind'
            },
            'strain': {
                name: '應變',
                icon: 'fas fa-arrows-alt-h'
            },
            'solar': {
                name: '太陽能',
                icon: 'fas fa-sun'
            }
        };
        
        return sensorInfoMap[sensorType] || {
            name: '未知感測器',
            icon: 'fas fa-question-circle'
        };
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

// 當頁面載入完成時初始化裝置管理
document.addEventListener('DOMContentLoaded', () => {
    // 等待資料庫初始化完成後再初始化裝置管理
    setTimeout(() => {
        DeviceManager.init();
    }, 1500);
}); 