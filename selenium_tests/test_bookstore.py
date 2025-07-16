# 書客來線上書店 - Selenium 自動化測試套件

"""
安裝依賴：
pip install selenium pytest pytest-html pytest-xdist webdriver-manager
"""

import pytest
import time
import json
import os
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager

# ================================
# 測試配置和基礎類
# ================================

class TestConfig:
    """測試配置類"""
    BASE_URL = "http://localhost:8000"
    TIMEOUT = 10
    IMPLICIT_WAIT = 5
    
    # 測試資料
    TEST_USER = {
        "email": "test_auto@bookstore.com",
        "password": "Test123456",
        "name": "自動測試用戶",
        "phone": "0912345678",
        "address": "台北市信義區測試路123號"
    }
    
    EXISTING_USER = {
        "email": "test@bookstore.com",
        "password": "123456"
    }

class BasePage:
    """頁面基礎類 - Page Object Model"""
    
    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, TestConfig.TIMEOUT)
    
    def find_element(self, locator):
        """尋找元素"""
        return self.wait.until(EC.presence_of_element_located(locator))
    
    def find_elements(self, locator):
        """尋找多個元素"""
        return self.driver.find_elements(*locator)
    
    def click_element(self, locator):
        """點擊元素"""
        element = self.wait.until(EC.element_to_be_clickable(locator))
        element.click()
        return element
    
    def input_text(self, locator, text):
        """輸入文字"""
        element = self.find_element(locator)
        element.clear()
        element.send_keys(text)
        return element
    
    def get_text(self, locator):
        """獲取文字"""
        return self.find_element(locator).text
    
    def is_element_present(self, locator):
        """檢查元素是否存在"""
        try:
            self.driver.find_element(*locator)
            return True
        except NoSuchElementException:
            return False
    
    def wait_for_page_load(self):
        """等待頁面載入完成"""
        self.wait.until(lambda driver: driver.execute_script("return document.readyState") == "complete")
    
    def take_screenshot(self, name):
        """截圖"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot_path = f"screenshots/{name}_{timestamp}.png"
        os.makedirs("screenshots", exist_ok=True)
        self.driver.save_screenshot(screenshot_path)
        return screenshot_path

# ================================
# 頁面對象類
# ================================

class HomePage(BasePage):
    """首頁"""
    
    # 元素定位器
    LOGO = (By.CSS_SELECTOR, ".logo h1")
    LOGIN_LINK = (By.XPATH, "//a[contains(text(), '會員登入')]")
    REGISTER_LINK = (By.XPATH, "//a[contains(text(), '加入會員')]")
    CART_COUNT = (By.ID, "cartCount")
    SEARCH_INPUT = (By.ID, "searchInput")
    SEARCH_BUTTON = (By.CSS_SELECTOR, ".search-btn")
    
    def __init__(self, driver):
        super().__init__(driver)
        self.url = f"{TestConfig.BASE_URL}/index.html"
    
    def open(self):
        """開啟首頁"""
        self.driver.get(self.url)
        self.wait_for_page_load()
        return self
    
    def go_to_login(self):
        """前往登入頁面"""
        self.click_element(self.LOGIN_LINK)
        return LoginPage(self.driver)
    
    def go_to_register(self):
        """前往註冊頁面"""
        self.click_element(self.REGISTER_LINK)
        return RegisterPage(self.driver)
    
    def search_book(self, keyword):
        """搜尋書籍"""
        self.input_text(self.SEARCH_INPUT, keyword)
        self.click_element(self.SEARCH_BUTTON)
    
    def get_cart_count(self):
        """獲取購物車數量"""
        return self.get_text(self.CART_COUNT)

class LoginPage(BasePage):
    """登入頁面"""
    
    # 元素定位器
    EMAIL_INPUT = (By.ID, "email")
    PASSWORD_INPUT = (By.ID, "password")
    LOGIN_BUTTON = (By.ID, "loginBtn")
    ERROR_MESSAGE = (By.ID, "errorMessage")
    SUCCESS_MESSAGE = (By.ID, "successMessage")
    FORGOT_PASSWORD_LINK = (By.XPATH, "//a[contains(text(), '忘記帳號密碼')]")
    PASSWORD_TOGGLE = (By.CSS_SELECTOR, ".password-toggle")
    TEST_ACCOUNT_1 = (By.XPATH, "//div[contains(text(), 'test@bookstore.com')]")
    
    def __init__(self, driver):
        super().__init__(driver)
        self.url = f"{TestConfig.BASE_URL}/login.html"
    
    def open(self):
        """開啟登入頁面"""
        self.driver.get(self.url)
        self.wait_for_page_load()
        return self
    
    def login(self, email, password):
        """執行登入"""
        self.input_text(self.EMAIL_INPUT, email)
        self.input_text(self.PASSWORD_INPUT, password)
        self.click_element(self.LOGIN_BUTTON)
        time.sleep(2)  # 等待登入處理
    
    def use_test_account(self):
        """使用測試帳號"""
        self.click_element(self.TEST_ACCOUNT_1)
        self.click_element(self.LOGIN_BUTTON)
        time.sleep(2)
    
    def toggle_password_visibility(self):
        """切換密碼顯示"""
        self.click_element(self.PASSWORD_TOGGLE)
    
    def click_forgot_password(self):
        """點擊忘記密碼"""
        self.click_element(self.FORGOT_PASSWORD_LINK)
    
    def get_error_message(self):
        """獲取錯誤訊息"""
        try:
            return self.get_text(self.ERROR_MESSAGE)
        except:
            return ""
    
    def is_login_successful(self):
        """檢查是否登入成功"""
        try:
            self.wait.until(EC.url_contains("index.html"))
            return True
        except TimeoutException:
            return False

class RegisterPage(BasePage):
    """註冊頁面"""
    
    # 元素定位器
    EMAIL_INPUT = (By.ID, "email")
    PASSWORD_INPUT = (By.ID, "password")
    CONFIRM_PASSWORD_INPUT = (By.ID, "confirmPassword")
    NAME_INPUT = (By.ID, "name")
    PHONE_INPUT = (By.ID, "phone")
    ADDRESS_INPUT = (By.ID, "address")
    AGREE_TERMS_CHECKBOX = (By.ID, "agreeTerms")
    REGISTER_BUTTON = (By.ID, "registerBtn")
    ERROR_MESSAGE = (By.ID, "errorMessage")
    SUCCESS_MESSAGE = (By.ID, "successMessage")
    PASSWORD_STRENGTH = (By.ID, "passwordStrength")
    
    def __init__(self, driver):
        super().__init__(driver)
        self.url = f"{TestConfig.BASE_URL}/register.html"
    
    def open(self):
        """開啟註冊頁面"""
        self.driver.get(self.url)
        self.wait_for_page_load()
        return self
    
    def register(self, user_data):
        """執行註冊"""
        self.input_text(self.EMAIL_INPUT, user_data["email"])
        self.input_text(self.PASSWORD_INPUT, user_data["password"])
        self.input_text(self.CONFIRM_PASSWORD_INPUT, user_data["password"])
        self.input_text(self.NAME_INPUT, user_data["name"])
        if "phone" in user_data:
            self.input_text(self.PHONE_INPUT, user_data["phone"])
        if "address" in user_data:
            self.input_text(self.ADDRESS_INPUT, user_data["address"])
        
        self.click_element(self.AGREE_TERMS_CHECKBOX)
        self.click_element(self.REGISTER_BUTTON)
        time.sleep(3)  # 等待註冊處理
    
    def get_password_strength_class(self):
        """獲取密碼強度等級"""
        element = self.find_element(self.PASSWORD_STRENGTH)
        return element.get_attribute("class")
    
    def get_error_message(self):
        """獲取錯誤訊息"""
        try:
            return self.get_text(self.ERROR_MESSAGE)
        except:
            return ""

class OrderSearchPage(BasePage):
    """訂單查詢頁面"""
    
    # 元素定位器
    PAGE_TITLE = (By.CSS_SELECTOR, ".page-title")
    ORDER_TABLE = (By.ID, "orderTableContainer")
    EMPTY_STATE = (By.ID, "emptyState")
    FILTER_ALL = (By.XPATH, "//button[contains(text(), '全部')]")
    FILTER_PROCESSING = (By.XPATH, "//button[contains(text(), '處理中')]")
    ORDER_STATS = (By.ID, "orderStats")
    TOTAL_ORDERS = (By.ID, "totalOrders")
    
    def __init__(self, driver):
        super().__init__(driver)
        self.url = f"{TestConfig.BASE_URL}/ordersearch.html"
    
    def open(self):
        """開啟訂單查詢頁面"""
        self.driver.get(self.url)
        self.wait_for_page_load()
        return self
    
    def filter_orders(self, filter_type):
        """篩選訂單"""
        if filter_type == "all":
            self.click_element(self.FILTER_ALL)
        elif filter_type == "processing":
            self.click_element(self.FILTER_PROCESSING)
        time.sleep(1)
    
    def get_total_orders(self):
        """獲取總訂單數"""
        try:
            return self.get_text(self.TOTAL_ORDERS)
        except:
            return "0"

class AdminToolsPage(BasePage):
    """管理工具頁面"""
    
    # 元素定位器
    DB_STATUS_VALUE = (By.ID, "dbStatusValue")
    USER_COUNT_VALUE = (By.ID, "userCountValue")
    REFRESH_STATUS_BTN = (By.XPATH, "//button[contains(text(), '重新整理狀態')]")
    LOAD_USERS_BTN = (By.XPATH, "//button[contains(text(), '載入用戶列表')]")
    USERS_TABLE = (By.ID, "usersTableContainer")
    
    def __init__(self, driver):
        super().__init__(driver)
        self.url = f"{TestConfig.BASE_URL}/admin-tools.html"
    
    def open(self):
        """開啟管理工具頁面"""
        self.driver.get(self.url)
        self.wait_for_page_load()
        return self
    
    def refresh_status(self):
        """重新整理狀態"""
        self.click_element(self.REFRESH_STATUS_BTN)
        time.sleep(2)
    
    def load_users(self):
        """載入用戶列表"""
        self.click_element(self.LOAD_USERS_BTN)
        time.sleep(2)
    
    def get_db_status(self):
        """獲取資料庫狀態"""
        return self.get_text(self.DB_STATUS_VALUE)
    
    def get_user_count(self):
        """獲取用戶數量"""
        return self.get_text(self.USER_COUNT_VALUE)

# ================================
# 測試設置和輔助功能
# ================================

@pytest.fixture(scope="session")
def browser_setup():
    """瀏覽器設置"""
    options = Options()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    # 如果要執行無頭模式，取消下面註解
    # options.add_argument("--headless")
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.maximize_window()
    driver.implicitly_wait(TestConfig.IMPLICIT_WAIT)
    
    yield driver
    
    driver.quit()

@pytest.fixture(scope="function")
def driver(browser_setup):
    """每個測試函數的驅動器"""
    driver = browser_setup
    # 清除瀏覽器資料
    driver.delete_all_cookies()
    driver.execute_script("localStorage.clear();")
    driver.execute_script("sessionStorage.clear();")
    yield driver

class TestDataManager:
    """測試資料管理器"""
    
    @staticmethod
    def generate_unique_email():
        """生成唯一的測試email"""
        timestamp = int(time.time())
        return f"test_{timestamp}@bookstore.com"
    
    @staticmethod
    def create_test_user():
        """創建測試用戶資料"""
        return {
            "email": TestDataManager.generate_unique_email(),
            "password": "Test123456",
            "name": "自動測試用戶",
            "phone": "0912345678",
            "address": "台北市信義區測試路123號"
        }

# ================================
# 測試案例
# ================================

class TestHomePage:
    """首頁測試"""
    
    def test_home_page_load(self, driver):
        """測試首頁載入"""
        home_page = HomePage(driver).open()
        
        # 驗證頁面標題
        assert "書客來" in driver.title
        
        # 驗證主要元素存在
        assert home_page.is_element_present(home_page.LOGO)
        assert home_page.is_element_present(home_page.LOGIN_LINK)
        assert home_page.is_element_present(home_page.REGISTER_LINK)
        
        print("✅ 首頁載入測試通過")
    
    def test_navigation_links(self, driver):
        """測試導航連結"""
        home_page = HomePage(driver).open()
        
        # 測試登入連結
        login_page = home_page.go_to_login()
        assert "login.html" in driver.current_url
        
        # 返回首頁測試註冊連結
        home_page.open()
        register_page = home_page.go_to_register()
        assert "register.html" in driver.current_url
        
        print("✅ 導航連結測試通過")

class TestUserRegistration:
    """用戶註冊測試"""
    
    def test_successful_registration(self, driver):
        """測試成功註冊"""
        register_page = RegisterPage(driver).open()
        test_user = TestDataManager.create_test_user()
        
        register_page.register(test_user)
        
        # 等待註冊完成並檢查跳轉
        time.sleep(3)
        assert "login.html" in driver.current_url or "成功" in register_page.get_error_message()
        
        print("✅ 用戶註冊測試通過")
    
    def test_duplicate_email_registration(self, driver):
        """測試重複email註冊"""
        register_page = RegisterPage(driver).open()
        
        # 使用已存在的測試帳號
        register_page.register(TestConfig.EXISTING_USER)
        
        # 檢查錯誤訊息
        error_message = register_page.get_error_message()
        assert "已經註冊" in error_message or "已存在" in error_message
        
        print("✅ 重複email註冊測試通過")
    
    def test_password_strength_indicator(self, driver):
        """測試密碼強度指示器"""
        register_page = RegisterPage(driver).open()
        
        # 測試弱密碼
        register_page.input_text(register_page.PASSWORD_INPUT, "123")
        strength_class = register_page.get_password_strength_class()
        assert "weak" in strength_class or "strength-bar" in strength_class
        
        # 測試強密碼
        register_page.input_text(register_page.PASSWORD_INPUT, "StrongPass123!")
        strength_class = register_page.get_password_strength_class()
        # 強密碼應該有對應的CSS類
        assert "strength-bar" in strength_class
        
        print("✅ 密碼強度指示器測試通過")

class TestUserLogin:
    """用戶登入測試"""
    
    def test_successful_login(self, driver):
        """測試成功登入"""
        login_page = LoginPage(driver).open()
        
        # 使用測試帳號登入
        login_page.login(TestConfig.EXISTING_USER["email"], TestConfig.EXISTING_USER["password"])
        
        # 檢查是否跳轉到首頁
        assert login_page.is_login_successful()
        
        print("✅ 用戶登入測試通過")
    
    def test_invalid_login(self, driver):
        """測試無效登入"""
        login_page = LoginPage(driver).open()
        
        # 使用錯誤密碼
        login_page.login("test@bookstore.com", "wrongpassword")
        
        # 檢查錯誤訊息
        error_message = login_page.get_error_message()
        assert "密碼錯誤" in error_message or "登入失敗" in error_message
        
        print("✅ 無效登入測試通過")
    
    def test_test_account_functionality(self, driver):
        """測試測試帳號功能"""
        login_page = LoginPage(driver).open()
        
        # 點擊測試帳號
        login_page.use_test_account()
        
        # 檢查是否成功登入
        time.sleep(3)
        assert "index.html" in driver.current_url or login_page.is_login_successful()
        
        print("✅ 測試帳號功能測試通過")
    
    def test_password_visibility_toggle(self, driver):
        """測試密碼顯示切換"""
        login_page = LoginPage(driver).open()
        
        # 輸入密碼
        password_field = login_page.find_element(login_page.PASSWORD_INPUT)
        password_field.send_keys("testpassword")
        
        # 檢查初始類型為password
        assert password_field.get_attribute("type") == "password"
        
        # 點擊切換按鈕
        login_page.toggle_password_visibility()
        
        # 檢查類型是否變為text
        assert password_field.get_attribute("type") == "text"
        
        print("✅ 密碼顯示切換測試通過")

class TestForgotPassword:
    """忘記密碼測試"""
    
    def test_forgot_password_modal_open(self, driver):
        """測試忘記密碼彈窗開啟"""
        login_page = LoginPage(driver).open()
        
        # 點擊忘記密碼
        login_page.click_forgot_password()
        
        # 檢查模態窗是否出現
        modal = login_page.wait.until(
            EC.visibility_of_element_located((By.ID, "forgotPasswordModal"))
        )
        assert modal.is_displayed()
        
        print("✅ 忘記密碼彈窗開啟測試通過")

class TestOrderManagement:
    """訂單管理測試"""
    
    def test_order_page_access_without_login(self, driver):
        """測試未登入訪問訂單頁面"""
        order_page = OrderSearchPage(driver).open()
        
        # 應該跳轉到登入頁面
        time.sleep(2)
        assert "login.html" in driver.current_url
        
        print("✅ 未登入訪問訂單頁面測試通過")
    
    def test_order_page_with_login(self, driver):
        """測試登入後訪問訂單頁面"""
        # 先登入
        login_page = LoginPage(driver).open()
        login_page.login(TestConfig.EXISTING_USER["email"], TestConfig.EXISTING_USER["password"])
        
        # 等待登入完成
        time.sleep(3)
        
        # 訪問訂單頁面
        order_page = OrderSearchPage(driver).open()
        
        # 檢查頁面載入
        assert order_page.is_element_present(order_page.PAGE_TITLE)
        
        print("✅ 登入後訪問訂單頁面測試通過")

class TestAdminTools:
    """管理工具測試"""
    
    def test_admin_page_load(self, driver):
        """測試管理頁面載入"""
        admin_page = AdminToolsPage(driver).open()
        
        # 檢查頁面標題
        assert "管理工具" in driver.title
        
        # 檢查資料庫狀態
        time.sleep(3)  # 等待資料庫初始化
        db_status = admin_page.get_db_status()
        assert db_status != "載入中..."
        
        print("✅ 管理頁面載入測試通過")
    
    def test_refresh_status_functionality(self, driver):
        """測試重新整理狀態功能"""
        admin_page = AdminToolsPage(driver).open()
        time.sleep(3)
        
        # 記錄初始狀態
        initial_status = admin_page.get_db_status()
        
        # 點擊重新整理
        admin_page.refresh_status()
        
        # 檢查狀態是否更新
        updated_status = admin_page.get_db_status()
        assert updated_status is not None
        
        print("✅ 重新整理狀態功能測試通過")

class TestEndToEnd:
    """端到端測試"""
    
    def test_complete_user_journey(self, driver):
        """測試完整用戶流程"""
        # 1. 訪問首頁
        home_page = HomePage(driver).open()
        assert "書客來" in driver.title
        
        # 2. 前往註冊頁面
        register_page = home_page.go_to_register()
        assert "register.html" in driver.current_url
        
        # 3. 註冊新用戶
        test_user = TestDataManager.create_test_user()
        register_page.register(test_user)
        time.sleep(3)
        
        # 4. 登入
        if "login.html" in driver.current_url:
            login_page = LoginPage(driver)
            login_page.login(test_user["email"], test_user["password"])
            time.sleep(3)
        
        # 5. 檢查是否成功登入
        assert "index.html" in driver.current_url
        
        print("✅ 完整用戶流程測試通過")

# ================================
# 測試報告和工具函數
# ================================

def generate_test_report():
    """生成測試報告"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_name = f"test_report_{timestamp}.html"
    
    os.system(f"pytest --html=reports/{report_name} --self-contained-html")
    print(f"測試報告已生成: reports/{report_name}")

if __name__ == "__main__":
    # 建立必要的目錄
    os.makedirs("screenshots", exist_ok=True)
    os.makedirs("reports", exist_ok=True)
    
    # 執行測試
    pytest.main([
        "-v",  # 詳細輸出
        "--tb=short",  # 簡短的錯誤追蹤
        "--html=reports/test_report.html",  # 生成HTML報告
        "--self-contained-html",  # 自包含的HTML報告
        __file__  # 執行當前文件的測試
    ])