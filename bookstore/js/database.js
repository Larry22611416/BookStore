// 資料庫管理系統 - database.js (修復版)
// 使用 IndexedDB 作為客戶端資料庫

class BookstoreDatabase {
    constructor() {
        this.dbName = 'BookstoreDB';
        this.dbVersion = 1;
        this.db = null;
        this.isReady = false;
    }

    // 初始化資料庫
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('資料庫開啟失敗:', request.error);
                this.isReady = false;
                // 觸發錯誤事件
                window.dispatchEvent(new CustomEvent('databaseError', { detail: request.error }));
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isReady = true;
                console.log('✅ 資料庫連線成功');
                
                // 觸發就緒事件
                window.dispatchEvent(new CustomEvent('databaseReady', { detail: this.db }));
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('🔧 正在建立資料庫結構...');

                // 創建用戶表
                if (!db.objectStoreNames.contains('users')) {
                    const userStore = db.createObjectStore('users', { keyPath: 'email' });
                    userStore.createIndex('userId', 'userId', { unique: true });
                    userStore.createIndex('email', 'email', { unique: true });
                    console.log('📋 已創建用戶表');
                }

                // 創建訂單表
                if (!db.objectStoreNames.contains('orders')) {
                    const orderStore = db.createObjectStore('orders', { keyPath: 'orderNumber' });
                    orderStore.createIndex('userEmail', 'userEmail', { unique: false });
                    orderStore.createIndex('orderDate', 'orderDate', { unique: false });
                    orderStore.createIndex('status', 'status', { unique: false });
                    console.log('📦 已創建訂單表');
                }

                // 創建購物車表
                if (!db.objectStoreNames.contains('carts')) {
                    const cartStore = db.createObjectStore('carts', { keyPath: 'userEmail' });
                    console.log('🛒 已創建購物車表');
                }

                console.log('✅ 資料庫結構建立完成');
            };
        });
    }

    // 檢查資料庫是否就緒
    ensureReady() {
        if (!this.isReady || !this.db) {
            throw new Error('資料庫尚未準備就緒，請稍後再試');
        }
    }

    // 用戶註冊 (修復版本)
    async registerUser(userData) {
        this.ensureReady();
        
        try {
            // 先檢查用戶是否已存在 (使用獨立的事務)
            const existingUser = await this.getUser(userData.email);
            if (existingUser) {
                throw new Error('此電子郵件已經註冊過了');
            }

            // 創建新的事務來添加用戶
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');

            // 創建新用戶資料
            const newUser = {
                userId: 'USER_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                email: userData.email.toLowerCase().trim(),
                password: userData.password, // 實際應用中應該加密
                name: userData.name.trim(),
                phone: userData.phone ? userData.phone.trim() : '',
                address: userData.address ? userData.address.trim() : '',
                registrationDate: new Date().toISOString(),
                lastLoginDate: null,
                isActive: true
            };

            // 使用事務來添加用戶
            const request = store.add(newUser);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log('✅ 用戶註冊成功:', newUser.email);
                    resolve(newUser);
                };
                
                request.onerror = () => {
                    console.error('❌ 用戶註冊失敗:', request.error);
                    reject(new Error('註冊失敗: ' + request.error.message));
                };

                transaction.onerror = () => {
                    console.error('❌ 事務失敗:', transaction.error);
                    reject(new Error('資料庫事務失敗: ' + transaction.error.message));
                };
            });
        } catch (error) {
            console.error('註冊過程發生錯誤:', error);
            throw error;
        }
    }

    // 用戶登入驗證
    async loginUser(email, password) {
        this.ensureReady();
        
        try {
            const user = await this.getUser(email.toLowerCase().trim());
            if (!user) {
                throw new Error('找不到此用戶');
            }

            if (user.password !== password) {
                throw new Error('密碼錯誤');
            }

            if (!user.isActive) {
                throw new Error('帳號已被停用');
            }

            // 更新最後登入時間
            await this.updateUser(user.email, { lastLoginDate: new Date().toISOString() });

            console.log('✅ 用戶登入成功:', email);
            return user;
        } catch (error) {
            console.error('❌ 登入失敗:', error.message);
            throw error;
        }
    }

    // 獲取用戶資料
    async getUser(email) {
        this.ensureReady();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const request = store.get(email.toLowerCase().trim());

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // 更新用戶資料
    async updateUser(email, updateData) {
        this.ensureReady();
        
        try {
            const user = await this.getUser(email);
            if (!user) {
                throw new Error('找不到用戶');
            }

            const updatedUser = { ...user, ...updateData };
            
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            const request = store.put(updatedUser);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log('✅ 用戶資料更新成功');
                    resolve(updatedUser);
                };
                request.onerror = () => {
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('❌ 更新用戶資料失敗:', error);
            throw error;
        }
    }

    // 保存購物車
    async saveCart(userEmail, cartItems) {
        this.ensureReady();
        
        try {
            const transaction = this.db.transaction(['carts'], 'readwrite');
            const store = transaction.objectStore('carts');

            const cartData = {
                userEmail: userEmail.toLowerCase().trim(),
                items: cartItems,
                lastUpdated: new Date().toISOString()
            };

            const request = store.put(cartData);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log('✅ 購物車已保存');
                    resolve(cartData);
                };
                request.onerror = () => {
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('❌ 保存購物車失敗:', error);
            throw error;
        }
    }

    // 獲取購物車
    async getCart(userEmail) {
        this.ensureReady();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['carts'], 'readonly');
            const store = transaction.objectStore('carts');
            const request = store.get(userEmail.toLowerCase().trim());

            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.items : []);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // 創建訂單
    async createOrder(orderData) {
        this.ensureReady();
        
        try {
            const transaction = this.db.transaction(['orders'], 'readwrite');
            const store = transaction.objectStore('orders');

            // 生成訂單編號
            const orderNumber = 'BK' + new Date().getFullYear() + 
                               String(new Date().getMonth() + 1).padStart(2, '0') + 
                               String(new Date().getDate()).padStart(2, '0') + 
                               String(Date.now()).slice(-6);

            const newOrder = {
                orderNumber: orderNumber,
                userEmail: orderData.userEmail.toLowerCase().trim(),
                items: orderData.items,
                totalAmount: orderData.totalAmount,
                paymentMethod: orderData.paymentMethod,
                shippingAddress: orderData.shippingAddress,
                notes: orderData.notes || '',
                orderDate: new Date().toISOString(),
                status: 'processing',
                statusText: '處理中',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const request = store.add(newOrder);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log('✅ 訂單創建成功:', orderNumber);
                    resolve(newOrder);
                };
                request.onerror = () => {
                    console.error('❌ 訂單創建失敗:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('創建訂單過程發生錯誤:', error);
            throw error;
        }
    }

    // 獲取用戶訂單
    async getUserOrders(userEmail) {
        this.ensureReady();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['orders'], 'readonly');
            const store = transaction.objectStore('orders');
            const index = store.index('userEmail');
            const request = index.getAll(userEmail.toLowerCase().trim());

            request.onsuccess = () => {
                const orders = request.result || [];
                // 按日期降序排列
                orders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
                console.log(`✅ 找到 ${orders.length} 筆訂單`);
                resolve(orders);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // 獲取單筆訂單
    async getOrder(orderNumber) {
        this.ensureReady();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['orders'], 'readonly');
            const store = transaction.objectStore('orders');
            const request = store.get(orderNumber);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // 更新訂單狀態
    async updateOrderStatus(orderNumber, status, statusText) {
        this.ensureReady();
        
        try {
            const order = await this.getOrder(orderNumber);
            if (!order) {
                throw new Error('找不到訂單');
            }

            order.status = status;
            order.statusText = statusText;
            order.updatedAt = new Date().toISOString();

            const transaction = this.db.transaction(['orders'], 'readwrite');
            const store = transaction.objectStore('orders');
            const request = store.put(order);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log('✅ 訂單狀態更新成功:', orderNumber);
                    resolve(order);
                };
                request.onerror = () => {
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('❌ 更新訂單狀態失敗:', error);
            throw error;
        }
    }

    // 清空購物車
    async clearCart(userEmail) {
        return await this.saveCart(userEmail, []);
    }

    // 獲取所有用戶（管理員功能）
    async getAllUsers() {
        this.ensureReady();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // 獲取所有訂單（管理員功能）
    async getAllOrders() {
        this.ensureReady();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['orders'], 'readonly');
            const store = transaction.objectStore('orders');
            const request = store.getAll();

            request.onsuccess = () => {
                const orders = request.result || [];
                orders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
                resolve(orders);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // 資料庫狀態檢查 (修復版)
    async checkDatabaseStatus() {
        try {
            // 檢查資料庫是否就緒
            if (!this.isReady || !this.db) {
                return {
                    isConnected: false,
                    error: '資料庫尚未準備就緒'
                };
            }

            const userCount = await this.getAllUsers();
            const orderCount = await this.getAllOrders();
            
            console.log('📊 資料庫狀態:');
            console.log(`   用戶數量: ${userCount.length}`);
            console.log(`   訂單數量: ${orderCount.length}`);
            
            return {
                isConnected: true,
                userCount: userCount.length,
                orderCount: orderCount.length
            };
        } catch (error) {
            console.error('❌ 資料庫狀態檢查失敗:', error);
            return {
                isConnected: false,
                error: error.message
            };
        }
    }

    // 重置所有資料 (開發用)
    async resetAllData() {
        this.ensureReady();
        
        try {
            console.log('🗑️ 開始清空所有資料...');
            
            const transaction = this.db.transaction(['users', 'orders', 'carts'], 'readwrite');
            
            const userStore = transaction.objectStore('users');
            const orderStore = transaction.objectStore('orders');
            const cartStore = transaction.objectStore('carts');
            
            await Promise.all([
                new Promise((resolve, reject) => {
                    const request = userStore.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                }),
                new Promise((resolve, reject) => {
                    const request = orderStore.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                }),
                new Promise((resolve, reject) => {
                    const request = cartStore.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                })
            ]);
            
            console.log('✅ 所有資料已清空');
            
            // 重新初始化測試資料
            await this.initTestData();
            
        } catch (error) {
            console.error('❌ 清空資料失敗:', error);
            throw error;
        }
    }

    // 重置用戶密碼
    async resetUserPassword(email, newPassword) {
        this.ensureReady();
        
        try {
            const user = await this.getUser(email);
            if (!user) {
                throw new Error('找不到此用戶');
            }

            if (!user.isActive) {
                throw new Error('此帳號已被停用');
            }

            // 更新密碼和最後修改時間
            const updatedUser = {
                ...user,
                password: newPassword, // 實際應用中應該加密
                passwordResetAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            const request = store.put(updatedUser);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log('✅ 密碼重置成功:', email);
                    resolve(updatedUser);
                };
                request.onerror = () => {
                    console.error('❌ 密碼重置失敗:', request.error);
                    reject(new Error('密碼重置失敗: ' + request.error.message));
                };
            });
        } catch (error) {
            console.error('❌ 重置密碼過程發生錯誤:', error);
            throw error;
        }
    }

    // 驗證用戶身份（用於密碼重置）
    async verifyUserForPasswordReset(email) {
        this.ensureReady();
        
        try {
            const user = await this.getUser(email);
            if (!user) {
                throw new Error('找不到此電子郵件對應的帳號');
            }

            if (!user.isActive) {
                throw new Error('此帳號已被停用');
            }

            // 返回安全的用戶資訊（不包含密碼）
            const safeUserInfo = {
                userId: user.userId,
                email: user.email,
                name: user.name,
                registrationDate: user.registrationDate,
                isActive: user.isActive
            };

            console.log('✅ 用戶身份驗證成功:', email);
            return safeUserInfo;
        } catch (error) {
            console.error('❌ 用戶身份驗證失敗:', error);
            throw error;
        }
    }

    // 檢查密碼強度
    checkPasswordStrength(password) {
        let strength = 0;
        const checks = {
            length: password.length >= 6,
            lowercase: /[a-z]/.test(password),
            uppercase: /[A-Z]/.test(password),
            numbers: /[0-9]/.test(password),
            symbols: /[^a-zA-Z0-9]/.test(password)
        };

        if (checks.length) strength++;
        if (checks.lowercase && checks.uppercase) strength++;
        if (checks.numbers) strength++;
        if (checks.symbols) strength++;

        let level = 'weak';
        if (strength >= 3) level = 'strong';
        else if (strength >= 2) level = 'medium';

        return {
            level,
            score: strength,
            checks,
            isValid: checks.length && strength >= 1
        };
    }

    // 獲取密碼重置統計（管理員功能）
    async getPasswordResetStats() {
        this.ensureReady();
        
        try {
            const users = await this.getAllUsers();
            const now = new Date();
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            const stats = {
                totalUsers: users.length,
                recentResets: {
                    lastWeek: 0,
                    lastMonth: 0,
                    total: 0
                },
                oldPasswords: 0 // 超過3個月沒更新密碼的用戶數
            };

            users.forEach(user => {
                if (user.passwordResetAt) {
                    const resetDate = new Date(user.passwordResetAt);
                    stats.recentResets.total++;
                    
                    if (resetDate >= oneWeekAgo) {
                        stats.recentResets.lastWeek++;
                    }
                    if (resetDate >= oneMonthAgo) {
                        stats.recentResets.lastMonth++;
                    }
                }

                // 檢查舊密碼（3個月未更新）
                const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                const lastUpdate = user.passwordResetAt ? new Date(user.passwordResetAt) : new Date(user.registrationDate);
                
                if (lastUpdate < threeMonthsAgo) {
                    stats.oldPasswords++;
                }
            });

            return stats;
        } catch (error) {
            console.error('❌ 獲取密碼重置統計失敗:', error);
            throw error;
        }
    }

    // 初始化測試資料（開發用）
    async initTestData() {
        try {
            console.log('🧪 初始化測試資料...');
            
            // 創建測試用戶
            const testUsers = [
                {
                    email: 'test@bookstore.com',
                    password: '123456',
                    name: '測試用戶',
                    phone: '0912345678',
                    address: '台北市信義區測試路123號'
                },
                {
                    email: 'admin@bookstore.com',
                    password: 'admin123',
                    name: '管理員',
                    phone: '0987654321',
                    address: '台北市大安區管理路456號'
                }
            ];

            for (const userData of testUsers) {
                try {
                    await this.registerUser(userData);
                } catch (error) {
                    if (error.message.includes('已經註冊過了')) {
                        console.log(`📋 測試用戶 ${userData.email} 已存在`);
                    } else {
                        console.error(`❌ 創建測試用戶 ${userData.email} 失敗:`, error);
                    }
                }
            }

            console.log('✅ 測試資料初始化完成');
        } catch (error) {
            console.error('❌ 測試資料初始化失敗:', error);
            throw error;
        }
    }
}

// 創建全域資料庫實例
window.bookstoreDB = new BookstoreDatabase();

// 資料庫初始化
document.addEventListener('DOMContentLoaded', async function() {
    try {
        console.log('🚀 正在初始化資料庫...');
        await window.bookstoreDB.init();
        
        // 在開發環境中初始化測試資料
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '') {
            console.log('🧪 開發環境，初始化測試資料');
            await window.bookstoreDB.initTestData();
        }
        
        // 檢查資料庫狀態
        const status = await window.bookstoreDB.checkDatabaseStatus();
        console.log('📊 資料庫就緒:', status);
        
        // 觸發全域事件，讓其他頁面知道資料庫已就緒
        window.dispatchEvent(new CustomEvent('databaseFullyReady', { detail: status }));
        
    } catch (error) {
        console.error('❌ 資料庫初始化失敗:', error);
        
        // 顯示錯誤提示
        const errorNotification = document.createElement('div');
        errorNotification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #f44336;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-size: 14px;
        `;
        errorNotification.textContent = '❌ 資料庫初始化失敗，某些功能可能無法正常使用';
        document.body.appendChild(errorNotification);
        
        setTimeout(() => {
            if (errorNotification.parentNode) {
                errorNotification.remove();
            }
        }, 5000);
        
        // 觸發錯誤事件
        window.dispatchEvent(new CustomEvent('databaseError', { detail: error }));
    }
});

// 匯出供其他模組使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BookstoreDatabase;
}