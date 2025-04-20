/**
 * 邊緣節點資訊整合平台 - 設定模組
 * 用於處理系統設定的儲存、載入、匯入、匯出等操作
 */

const SettingsManager = {
    // 初始化
    init() {
        this.loadSettings();
        this.setupEventListeners();
    },

    // 設置事件監聽器
    setupEventListeners() {
        // API 設定表單提交
        document.getElementById('api-settings-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveApiSettings();
        });

        // 匯出資料按鈕
        document.getElementById('export-data-btn').addEventListener('click', () => {
            this.exportData();
        });

        // 匯入資料按鈕
        document.getElementById('import-data-btn').addEventListener('click', () => {
            this.importData();
        });

        // 清除資料按鈕
        document.getElementById('clear-data-btn').addEventListener('click', () => {
            this.clearData();
        });
    },

    // 載入設定
    async loadSettings() {
        try {
            // 載入 API 金鑰
            const apiKey = await DB.settings.get('chatgpt_api_key');
            if (apiKey) {
                document.getElementById('chatgpt-api-key').value = apiKey;
            }
        } catch (error) {
            console.error('載入設定失敗:', error);
            this.showError('載入設定時發生錯誤');
        }
    },

    // 儲存 API 設定
    async saveApiSettings() {
        try {
            const apiKey = document.getElementById('chatgpt-api-key').value.trim();
            
            // 儲存到資料庫
            await DB.settings.set('chatgpt_api_key', apiKey);
            
            // 更新 CONFIG 物件
            CONFIG.api.chatgpt.key = apiKey;
            
            this.showSuccess('API 設定已成功儲存');
        } catch (error) {
            console.error('儲存 API 設定失敗:', error);
            this.showError('儲存 API 設定時發生錯誤');
        }
    },

    // 匯出資料
    async exportData() {
        try {
            // 取得所有資料
            const data = await DB.exportData();
            
            // 將資料轉換為 JSON 字串
            const jsonData = JSON.stringify(data, null, 2);
            
            // 建立下載連結
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `edge-node-data-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            
            // 清理
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 0);
            
            this.showSuccess('資料已成功匯出');
        } catch (error) {
            console.error('匯出資料失敗:', error);
            this.showError('匯出資料時發生錯誤');
        }
    },

    // 匯入資料
    importData() {
        // 建立檔案選擇元素
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'application/json';
        
        fileInput.addEventListener('change', async (e) => {
            try {
                if (e.target.files.length === 0) return;
                
                const file = e.target.files[0];
                const reader = new FileReader();
                
                reader.onload = async (event) => {
                    try {
                        // 解析 JSON 資料
                        const jsonData = JSON.parse(event.target.result);
                        
                        // 確認匯入
                        if (confirm('匯入資料將會覆蓋現有資料，確定要繼續嗎？')) {
                            // 匯入資料
                            await DB.importData(jsonData);
                            
                            // 重新載入所有資料
                            this.reloadAllData();
                            
                            this.showSuccess('資料已成功匯入');
                        }
                    } catch (error) {
                        console.error('解析匯入資料失敗:', error);
                        this.showError('解析匯入資料時發生錯誤，請確認檔案格式是否正確');
                    }
                };
                
                reader.readAsText(file);
            } catch (error) {
                console.error('匯入資料失敗:', error);
                this.showError('匯入資料時發生錯誤');
            }
        });
        
        // 觸發檔案選擇視窗
        fileInput.click();
    },

    // 清除資料
    async clearData() {
        try {
            // 確認清除
            if (!confirm('確定要清除所有資料嗎？此操作將刪除所有裝置、感測資料、警示設定，且無法恢復。')) {
                return;
            }
            
            // 再次確認
            if (!confirm('再次確認：你確定要永久刪除所有資料嗎？')) {
                return;
            }
            
            // 清除所有資料
            await DB.clearAllData();
            
            // 重新載入所有資料
            this.reloadAllData();
            
            this.showSuccess('所有資料已成功清除');
        } catch (error) {
            console.error('清除資料失敗:', error);
            this.showError('清除資料時發生錯誤');
        }
    },

    // 重新載入所有資料
    reloadAllData() {
        // 重新載入設定
        this.loadSettings();
        
        // 如果儀表板已初始化，更新儀表板
        if (typeof Dashboard !== 'undefined') {
            Dashboard.updateSummary();
            Dashboard.loadNodesList();
        }
        
        // 如果裝置管理已初始化，更新裝置列表
        if (typeof DeviceManager !== 'undefined') {
            DeviceManager.loadDevicesList();
        }
        
        // 如果警示管理已初始化，更新警示列表
        if (typeof AlertManager !== 'undefined') {
            AlertManager.loadAlertsList();
            AlertManager.updateDeviceSelector();
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
        alert(message);
    }
};

// 當頁面載入完成時初始化設定管理
document.addEventListener('DOMContentLoaded', () => {
    // 等待資料庫初始化完成後再初始化設定管理
    setTimeout(() => {
        SettingsManager.init();
    }, 1500);
}); 