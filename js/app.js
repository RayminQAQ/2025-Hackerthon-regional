/**
 * 邊緣節點資訊整合平台 - 主程式
 * 負責初始化應用程式並處理頁面導航
 */

const App = {
    // 初始化
    init() {
        this.setupEventListeners();
        this.activatePage(window.location.hash || '#dashboard');
    },

    // 設置事件監聽器
    setupEventListeners() {
        // 導航選單點擊
        document.querySelectorAll('.sidebar nav ul li a').forEach(link => {
            link.addEventListener('click', (e) => {
                const target = e.target.getAttribute('href');
                this.activatePage(target);
            });
        });

        // 監聽網址 hash 變更
        window.addEventListener('hashchange', () => {
            this.activatePage(window.location.hash);
        });

        // 模態視窗共用功能
        this.setupModals();
    },

    // 設置模態視窗
    setupModals() {
        // 關閉按鈕
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

    // 顯示模態視窗
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    },

    // 隱藏模態視窗
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    },

    // 啟用指定的頁面
    activatePage(target) {
        // 從 target 中移除 # 號
        if (target.startsWith('#')) {
            target = target.substring(1);
        }

        // 如果 target 為空，則預設為儀表板
        if (!target) {
            target = 'dashboard';
        }

        // 隱藏所有頁面
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // 移除所有導航項目的活動狀態
        document.querySelectorAll('.sidebar nav ul li').forEach(item => {
            item.classList.remove('active');
        });

        // 顯示目標頁面
        const targetPage = document.getElementById(target);
        if (targetPage) {
            targetPage.classList.add('active');

            // 設置導航項目的活動狀態
            const navItem = document.querySelector(`.sidebar nav ul li a[href="#${target}"]`);
            if (navItem) {
                navItem.parentElement.classList.add('active');
            }

            // 更新網址 hash（如果需要）
            if (window.location.hash !== `#${target}`) {
                window.location.hash = `#${target}`;
            }
        }
    },

    // 顯示訊息
    showMessage(message, type = 'info') {
        console.log(`[${type}] ${message}`);
        // 在實際應用中，這裡可以實現更好的通知 UI
        alert(message);
    },

    // 顯示錯誤訊息
    showError(message) {
        this.showMessage(message, 'error');
    },

    // 顯示成功訊息
    showSuccess(message) {
        this.showMessage(message, 'success');
    },

    // 產生唯一 ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
};

// 當頁面載入完成時初始化應用程式
document.addEventListener('DOMContentLoaded', () => {
    App.init();
}); 