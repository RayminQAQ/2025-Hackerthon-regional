/**
 * 邊緣節點資訊整合平台 - 配置文件
 * 用於存儲 API 金鑰和其他配置信息
 */

const CONFIG = {
    // API 相關設定
    api: {
        // ChatGPT API 金鑰設定
        chatgpt: {
            key: null,
            endpoint: 'https://api.openai.com/v1/chat/completions',
            model: 'gpt-3.5-turbo',
        }
    },

    // 系統設置
    system: {
        // 模擬資料更新頻率（毫秒）
        dataUpdateInterval: 10000,
        // 自動產生模擬資料
        generateMockData: true
    },
    
    // 載入配置
    async load() {
        try {
            // 從 IndexedDB 中讀取 API 金鑰
            const apiKey = await DB.settings.get('chatgpt_api_key');
            if (apiKey) {
                this.api.chatgpt.key = apiKey;
                console.log('已載入 ChatGPT API 金鑰');
            }
            
            // 讀取其他設定
            const dataUpdateInterval = await DB.settings.get('data_update_interval');
            if (dataUpdateInterval) {
                this.system.dataUpdateInterval = parseInt(dataUpdateInterval);
            }
            
            const generateMockData = await DB.settings.get('generate_mock_data');
            if (generateMockData !== null) {
                this.system.generateMockData = generateMockData;
            }
            
            return true;
        } catch (error) {
            console.error('載入配置失敗:', error);
            return false;
        }
    },
    
    // 保存配置
    async save() {
        try {
            // 保存 API 金鑰
            await DB.settings.set('chatgpt_api_key', this.api.chatgpt.key);
            
            // 保存其他設定
            await DB.settings.set('data_update_interval', this.system.dataUpdateInterval);
            await DB.settings.set('generate_mock_data', this.system.generateMockData);
            
            return true;
        } catch (error) {
            console.error('保存配置失敗:', error);
            return false;
        }
    },
    
    // 檢查 API 金鑰是否可用
    isApiKeySet() {
        return !!this.api.chatgpt.key;
    },
    
    // 使用 ChatGPT API 進行預測
    async predictWithChatGPT(messages) {
        if (!this.isApiKeySet()) {
            throw new Error('ChatGPT API 金鑰未設定');
        }
        
        try {
            const response = await fetch(this.api.chatgpt.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.api.chatgpt.key}`
                },
                body: JSON.stringify({
                    model: this.api.chatgpt.model,
                    messages: messages,
                    temperature: 0.7
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(`API 錯誤: ${error.error?.message || '未知錯誤'}`);
            }
            
            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('ChatGPT API 調用失敗:', error);
            throw error;
        }
    }
};

// 初始化配置
document.addEventListener('DOMContentLoaded', async () => {
    // 當資料庫初始化後載入配置
    setTimeout(async () => {
        try {
            await CONFIG.load();
            console.log('配置載入完成');
        } catch (error) {
            console.error('配置載入失敗:', error);
        }
    }, 1000); // 延遲 1 秒等待資料庫初始化
}); 