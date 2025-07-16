// 修復版 Google Books API
// 替換 js/google-books.js 中的相關方法

class GoogleBooksAPI {
    constructor(apiKey = null) {
        this.baseUrl = 'https://www.googleapis.com/books/v1';
        this.apiKey = apiKey;
        this.cache = new Map();
        this.cacheTimeout = 10 * 60 * 1000; // 10分鐘快取
        this.requestDelay = 100; // API 請求間隔
    }

    // 改進的搜尋書籍方法
    async searchBooks(query, maxResults = 20) {
        const cacheKey = `search_${query}_${maxResults}`;
        
        // 檢查快取
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            console.log('📚 從快取載入:', query);
            return cached;
        }

        try {
            // 清理搜尋查詢
            const cleanQuery = this.sanitizeQuery(query);
            
            const params = new URLSearchParams({
                q: cleanQuery,
                maxResults: Math.min(maxResults, 40).toString(), // 限制最大結果數
                printType: 'books',
                orderBy: 'relevance'
            });

            // 優先搜尋中文內容
            if (this.isChineseQuery(cleanQuery)) {
                params.set('langRestrict', 'zh');
            }

            if (this.apiKey) {
                params.append('key', this.apiKey);
            }

            console.log('🔍 搜尋查詢:', cleanQuery);
            
            const response = await this.fetchWithRetry(`${this.baseUrl}/volumes?${params}`);
            
            if (!response.ok) {
                throw new Error(`API 請求失敗: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.items || data.items.length === 0) {
                console.warn('⚠️ 搜尋無結果:', cleanQuery);
                // 嘗試簡化查詢重新搜尋
                if (cleanQuery.includes(' ')) {
                    const simpleQuery = cleanQuery.split(' ')[0];
                    console.log('🔄 嘗試簡化搜尋:', simpleQuery);
                    return await this.searchBooks(simpleQuery, maxResults);
                }
                return [];
            }

            const books = data.items.map(item => this.transformBookData(item));
            
            // 過濾無效結果
            const validBooks = books.filter(book => book.title && book.title !== '未知書名');
            
            console.log(`✅ 搜尋成功: ${validBooks.length}/${books.length} 本有效書籍`);
            
            // 快取結果
            this.saveToCache(cacheKey, validBooks);
            
            return validBooks;

        } catch (error) {
            console.error('❌ 搜尋失敗:', error);
            
            // 如果是網路錯誤，嘗試從快取獲取相似結果
            const fallbackResults = this.getFallbackResults(query);
            if (fallbackResults.length > 0) {
                console.log('🔄 使用備用結果:', fallbackResults.length, '本');
                return fallbackResults;
            }
            
            return [];
        }
    }

    // 修復的根據 ID 獲取書籍詳情方法
    async getBookById(bookId) {
        if (!bookId || bookId === 'book001') {
            throw new Error('無效的書籍 ID');
        }

        const cacheKey = `book_${bookId}`;
        
        // 檢查快取
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            console.log('📖 從快取載入書籍:', bookId);
            return cached;
        }

        try {
            console.log('🔍 正在載入書籍詳情:', bookId);
            
            const params = new URLSearchParams();
            if (this.apiKey) {
                params.append('key', this.apiKey);
            }

            const url = `${this.baseUrl}/volumes/${encodeURIComponent(bookId)}?${params}`;
            const response = await this.fetchWithRetry(url);
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`書籍不存在: ${bookId}`);
                } else if (response.status === 403) {
                    throw new Error('API 配額已用完');
                } else {
                    throw new Error(`API 錯誤: ${response.status} ${response.statusText}`);
                }
            }

            const data = await response.json();
            
            if (!data.volumeInfo) {
                throw new Error('書籍資料格式錯誤');
            }

            const book = this.transformBookData(data);
            
            if (!book.title || book.title === '未知書名') {
                throw new Error('書籍資料不完整');
            }
            
            console.log('✅ 書籍載入成功:', book.title);
            
            // 快取結果
            this.saveToCache(cacheKey, book);
            return book;

        } catch (error) {
            console.error('❌ 載入書籍詳情失敗:', error.message);
            throw error;
        }
    }

    // 改進的資料轉換方法
    transformBookData(item) {
        try {
            const info = item.volumeInfo || {};
            const sale = item.saleInfo || {};
            const images = info.imageLinks || {};

            // 更安全的價格生成
            const basePrice = this.generatePrice(info.title, info.categories);
            const discount = Math.floor(Math.random() * 25) + 75; // 75-99折
            const currentPrice = Math.floor(basePrice * discount / 100);

            return {
                id: item.id || `generated_${Date.now()}`,
                title: this.cleanText(info.title) || '精選好書',
                subtitle: this.cleanText(info.subtitle) || '',
                author: this.formatAuthors(info.authors),
                publisher: this.cleanText(info.publisher) || '知名出版社',
                publishDate: this.formatDate(info.publishedDate),
                description: this.cleanDescription(info.description),
                isbn: this.extractISBN(info.industryIdentifiers),
                pageCount: parseInt(info.pageCount) || 0,
                categories: this.formatCategories(info.categories),
                language: this.detectLanguage(info.language, info.title),
                
                // 圖片處理
                imageUrl: this.getBestImage(images),
                thumbnailUrl: images.thumbnail || '',
                
                // 評分
                rating: this.formatRating(info.averageRating),
                reviewCount: parseInt(info.ratingsCount) || this.generateReviewCount(),
                
                // 價格
                originalPrice: basePrice,
                currentPrice: currentPrice,
                discountRate: `${discount}折`,
                
                // 庫存
                stock: Math.floor(Math.random() * 50) + 10,
                
                // 規格
                specs: this.generateSpecs(info.pageCount, info.categories),
                series: this.extractSeries(info.title, info.publisher),
                
                // 連結
                previewLink: info.previewLink || '',
                infoLink: info.infoLink || '',
                
                // 其他資訊
                source: 'google_books',
                note: '限時優惠，售完為止',
                discountNote: `優惠期限：${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()}`
            };
        } catch (error) {
            console.error('轉換書籍資料失敗:', error);
            return this.getDefaultBookData(item.id);
        }
    }

    // 工具方法：清理文字
    cleanText(text) {
        if (!text) return '';
        return text.replace(/[\r\n\t]+/g, ' ').trim();
    }

    // 工具方法：格式化作者
    formatAuthors(authors) {
        if (!authors || !Array.isArray(authors)) return '知名作家';
        return authors.slice(0, 3).map(author => this.cleanText(author)).join(', ');
    }

    // 工具方法：格式化日期
    formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            return date.getFullYear() + '年';
        } catch {
            return dateString || '';
        }
    }

    // 工具方法：清理描述
    cleanDescription(description) {
        if (!description) return '這是一本值得閱讀的好書，內容豐富精彩。';
        
        // 移除 HTML 標籤
        const cleanDesc = description.replace(/<[^>]*>/g, '').replace(/[\r\n\t]+/g, ' ').trim();
        
        // 限制長度
        if (cleanDesc.length > 500) {
            return cleanDesc.substring(0, 500) + '...';
        }
        
        return cleanDesc || '這是一本值得閱讀的好書，內容豐富精彩。';
    }

    // 工具方法：格式化分類
    formatCategories(categories) {
        if (!categories || !Array.isArray(categories)) return ['圖書'];
        return categories.slice(0, 3).map(cat => this.cleanText(cat));
    }

    // 工具方法：偵測語言
    detectLanguage(lang, title) {
        if (lang === 'zh' || lang === 'zh-TW' || lang === 'zh-CN') return '繁體中文';
        if (title && /[\u4e00-\u9fff]/.test(title)) return '繁體中文';
        return '外文';
    }

    // 工具方法：格式化評分
    formatRating(rating) {
        if (!rating) return (Math.random() * 2 + 3).toFixed(1);
        return Math.max(1, Math.min(5, parseFloat(rating))).toFixed(1);
    }

    // 工具方法：生成評論數
    generateReviewCount() {
        return Math.floor(Math.random() * 200) + 10;
    }

    // 工具方法：生成價格
    generatePrice(title, categories) {
        let basePrice = 299;
        
        if (categories && Array.isArray(categories)) {
            const cats = categories.join(' ').toLowerCase();
            if (cats.includes('business') || cats.includes('professional')) {
                basePrice = Math.floor(Math.random() * 200) + 400; // 400-600
            } else if (cats.includes('fiction') || cats.includes('novel')) {
                basePrice = Math.floor(Math.random() * 150) + 250; // 250-400
            } else if (cats.includes('children') || cats.includes('juvenile')) {
                basePrice = Math.floor(Math.random() * 100) + 150; // 150-250
            }
        }
        
        return basePrice;
    }

    // 工具方法：生成規格
    generateSpecs(pageCount, categories) {
        const pages = pageCount || Math.floor(Math.random() * 300) + 200;
        return `平裝 / ${pages}頁 / 14.8 x 21 cm / 普通級 / 單色印刷`;
    }

    // 工具方法：提取系列
    extractSeries(title, publisher) {
        if (publisher) {
            return `${publisher}精選系列`;
        }
        return 'Google Books';
    }

    // 工具方法：帶重試的請求
    async fetchWithRetry(url, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                if (i > 0) {
                    console.log(`🔄 重試第 ${i} 次:`, url);
                    await this.delay(this.requestDelay * i);
                }
                
                const response = await fetch(url);
                return response;
                
            } catch (error) {
                if (i === retries - 1) throw error;
                console.warn(`⚠️ 請求失敗，準備重試:`, error.message);
            }
        }
    }

    // 工具方法：延遲
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 工具方法：清理查詢
    sanitizeQuery(query) {
        return query.replace(/[^\w\s\u4e00-\u9fff]/g, ' ').trim();
    }

    // 工具方法：判斷是否為中文查詢
    isChineseQuery(query) {
        return /[\u4e00-\u9fff]/.test(query);
    }

    // 工具方法：獲取備用結果
    getFallbackResults(query) {
        const fallbackBooks = [];
        
        // 從快取中尋找相似的搜尋結果
        for (const [key, cached] of this.cache.entries()) {
            if (key.startsWith('search_') && Array.isArray(cached.data)) {
                fallbackBooks.push(...cached.data.slice(0, 3));
            }
        }
        
        return fallbackBooks.slice(0, 10);
    }

    // 工具方法：獲取預設書籍資料
    getDefaultBookData(id) {
        return {
            id: id || 'default',
            title: '精選好書',
            subtitle: '',
            author: '知名作家',
            publisher: '經典出版社',
            publishDate: '2024年',
            description: '這是一本精彩的好書，值得您的收藏。',
            isbn: '',
            pageCount: 300,
            categories: ['圖書'],
            language: '繁體中文',
            imageUrl: 'https://via.placeholder.com/300x400/4CAF50/ffffff?text=精選好書',
            rating: '4.5',
            reviewCount: 50,
            originalPrice: 350,
            currentPrice: 280,
            discountRate: '8折',
            stock: 20,
            specs: '平裝 / 300頁 / 14.8 x 21 cm',
            series: '精選系列',
            previewLink: '',
            source: 'default'
        };
    }

    // 其他現有方法保持不變...
    extractISBN(identifiers = []) {
        const isbn13 = identifiers.find(id => id.type === 'ISBN_13');
        const isbn10 = identifiers.find(id => id.type === 'ISBN_10');
        return isbn13?.identifier || isbn10?.identifier || '';
    }

    getBestImage(images) {
        return images.large || 
               images.medium || 
               images.small || 
               images.thumbnail || 
               'https://via.placeholder.com/300x400/f0f0f0/999999?text=書籍封面';
    }

    saveToCache(key, data) {
        try {
            this.cache.set(key, {
                data: data,
                timestamp: Date.now()
            });
        } catch (error) {
            console.warn('快取保存失敗:', error);
        }
    }

    getFromCache(key) {
        try {
            const cached = this.cache.get(key);
            if (!cached) return null;

            if (Date.now() - cached.timestamp > this.cacheTimeout) {
                this.cache.delete(key);
                return null;
            }

            return cached.data;
        } catch (error) {
            console.warn('快取讀取失敗:', error);
            return null;
        }
    }

    clearCache() {
        this.cache.clear();
    }
}

// 創建全域實例
window.googleBooksAPI = new GoogleBooksAPI();

// 預載推薦書籍
window.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Google Books API 初始化完成');
    
    try {
        console.log('📚 開始預載推薦書籍...');
        
        // 預載熱門分類的書籍
        const categories = ['暢銷書', '文學小說', '心理勵志'];
        const allBooks = [];
        
        for (const category of categories) {
            try {
                const books = await window.googleBooksAPI.searchBooks(category, 5);
                if (books.length > 0) {
                    allBooks.push(...books.slice(0, 3));
                    console.log(`✅ ${category}: ${books.length} 本書籍`);
                }
            } catch (error) {
                console.warn(`⚠️ 載入 ${category} 失敗:`, error.message);
            }
        }
        
        if (allBooks.length > 0) {
            window.recommendedBooks = allBooks;
            console.log(`🎉 預載完成，共 ${allBooks.length} 本推薦書籍`);
        } else {
            // 提供備用推薦書籍
            window.recommendedBooks = [window.googleBooksAPI.getDefaultBookData('rec1')];
            console.log('📖 使用預設推薦書籍');
        }
        
    } catch (error) {
        console.error('❌ 預載推薦書籍失敗:', error);
        window.recommendedBooks = [window.googleBooksAPI.getDefaultBookData('rec1')];
    }
});

// 匯出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoogleBooksAPI;
}