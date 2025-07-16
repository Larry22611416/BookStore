# ================================
# 測試配置類 (test_config.py)
# ================================

class TestEnvironment:
    """測試環境配置"""
    
    ENVIRONMENTS = {
        "local": {
            "base_url": "http://localhost:8000",
            "timeout": 10,
            "implicit_wait": 5
        },
        "staging": {
            "base_url": "https://staging.bookstore.com",
            "timeout": 15,
            "implicit_wait": 8
        },
        "production": {
            "base_url": "https://bookstore.com",
            "timeout": 20,
            "implicit_wait": 10
        }
    }
    
    @classmethod
    def get_config(cls, env="local"):
        return cls.ENVIRONMENTS.get(env, cls.ENVIRONMENTS["local"])

class BrowserConfig:
    """瀏覽器配置"""
    
    @staticmethod
    def get_chrome_options(headless=False):
        options = Options()
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")
        
        if headless:
            options.add_argument("--headless")
        
        # 停用瀏覽器通知
        prefs = {
            "profile.default_content_setting_values.notifications": 2,
            "profile.default_content_settings.popups": 0
        }
        options.add_experimental_option("prefs", prefs)
        
        return options
    
    @staticmethod
    def get_firefox_options(headless=False):
        options = FirefoxOptions()
        if headless:
            options.add_argument("--headless")
        return options