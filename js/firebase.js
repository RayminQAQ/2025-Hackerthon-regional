/**
 * 邊緣節點資訊整合平台 - Firebase 整合模組
 * 用於與 Firebase 連接並檢查危險狀態
 */

const FirebaseService = {
    // Firebase 配置
    // 請將下方配置替換為您的 Firebase 項目配置
    // 可以從 Firebase 控制台 > 專案設定 > 一般 > 您的應用程式 > Firebase SDK snippet > 配置中取得
    config: {
        apiKey: "YOUR_API_KEY", // 請替換為您的 API Key
        authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID", // 請替換為您的專案 ID
        databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com", // 請替換為您的 Realtime Database URL
        storageBucket: "YOUR_PROJECT_ID.appspot.com",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
    },
    
    /*
    * Firebase Realtime Database 資料結構格式範例:
    * 
    * {
    *   "danger": {
    *     "active": true,
    *     "message": "高雄地區發生地震！請立即疏散。",
    *     "location": "高雄市前鎮區",
    *     "timestamp": 1618842000000
    *   }
    * }
    */
    
    // Firebase 應用實例
    app: null,
    
    // Firebase 實時數據庫
    database: null,
    
    // 監聽器
    listeners: {},
    
    // 初始化 Firebase
    init() {
        try {
            // 檢查是否已載入 Firebase SDK
            if (typeof firebase === 'undefined') {
                console.error('Firebase SDK 尚未載入，請確保已引入 Firebase JS SDK');
                return false;
            }
            
            // 初始化 Firebase
            if (!firebase.apps.length) {
                this.app = firebase.initializeApp(this.config);
            } else {
                this.app = firebase.app();
            }
            
            // 取得實時數據庫參考
            this.database = firebase.database();
            
            console.log('Firebase 初始化成功');
            
            // 開始監聽危險狀態
            this.startDangerMonitoring();
            
            return true;
        } catch (error) {
            console.error('Firebase 初始化失敗:', error);
            return false;
        }
    },
    
    // 開始監聽危險狀態
    startDangerMonitoring() {
        try {
            // 參考到危險狀態資料
            const dangerRef = this.database.ref('danger');
            
            // 添加監聽器
            this.listeners.danger = dangerRef.on('value', (snapshot) => {
                const dangerStatus = snapshot.val();
                
                if (dangerStatus && dangerStatus.active === true) {
                    // 顯示警告
                    this.showDangerWarning(dangerStatus);
                } else {
                    // 移除警告
                    this.hideDangerWarning();
                }
            });
            
            console.log('開始監聽危險狀態');
        } catch (error) {
            console.error('監聽危險狀態失敗:', error);
        }
    },
    
    // 顯示危險警告
    showDangerWarning(dangerData) {
        try {
            // 檢查是否已有警告元素
            let warningElement = document.getElementById('danger-warning');
            
            // 如果尚未有警告元素，創建一個
            if (!warningElement) {
                warningElement = document.createElement('div');
                warningElement.id = 'danger-warning';
                warningElement.className = 'danger-warning-container';
                
                // 設置樣式
                warningElement.style.position = 'fixed';
                warningElement.style.top = '50%';
                warningElement.style.left = '50%';
                warningElement.style.transform = 'translate(-50%, -50%)';
                warningElement.style.backgroundColor = 'rgba(220, 53, 69, 0.95)';
                warningElement.style.color = 'white';
                warningElement.style.padding = '20px';
                warningElement.style.borderRadius = '8px';
                warningElement.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
                warningElement.style.zIndex = '9999';
                warningElement.style.textAlign = 'center';
                warningElement.style.maxWidth = '80%';
                
                // 添加到頁面
                document.body.appendChild(warningElement);
            }
            
            // 設置內容
            const message = dangerData.message || '檢測到立即性危險！請立即採取行動。';
            const location = dangerData.location || '未知位置';
            const time = dangerData.timestamp ? new Date(dangerData.timestamp).toLocaleString() : new Date().toLocaleString();
            
            warningElement.innerHTML = `
                <div class="warning-icon">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 15px;"></i>
                </div>
                <h3 style="margin: 0 0 10px 0;">緊急警告</h3>
                <p style="margin: 0 0 15px 0; font-size: 18px;">${message}</p>
                <div style="font-size: 14px; opacity: 0.8;">
                    <div>位置: ${location}</div>
                    <div>時間: ${time}</div>
                </div>
                <button id="close-warning" style="
                    margin-top: 15px;
                    padding: 8px 15px;
                    background-color: rgba(255, 255, 255, 0.3);
                    border: 1px solid white;
                    color: white;
                    border-radius: 4px;
                    cursor: pointer;
                ">關閉</button>
            `;
            
            // 添加關閉按鈕事件
            document.getElementById('close-warning').addEventListener('click', () => {
                this.hideDangerWarning();
            });
            
            // 播放警告聲音（可選）
            this.playWarningSound();
        } catch (error) {
            console.error('顯示危險警告失敗:', error);
        }
    },
    
    // 隱藏危險警告
    hideDangerWarning() {
        const warningElement = document.getElementById('danger-warning');
        if (warningElement) {
            warningElement.remove();
        }
    },
    
    // 播放警告聲音
    playWarningSound() {
        try {
            const audio = new Audio('assets/sounds/alarm.mp3');
            audio.play();
        } catch (error) {
            console.error('播放警告聲音失敗:', error);
        }
    },
    
    // 停止所有監聽器
    stopListening() {
        try {
            if (this.database && this.listeners.danger) {
                this.database.ref('danger').off('value', this.listeners.danger);
                delete this.listeners.danger;
            }
        } catch (error) {
            console.error('停止監聽失敗:', error);
        }
    }
};

// 當頁面載入完成時初始化 Firebase
document.addEventListener('DOMContentLoaded', () => {
    // 等待資料庫初始化完成後再初始化 Firebase
    setTimeout(() => {
        FirebaseService.init();
    }, 2000);
}); 