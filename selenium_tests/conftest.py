import pytest
import os
import json
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.firefox.service import Service as FirefoxService
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from webdriver_manager.chrome import ChromeDriverManager
from webdriver_manager.firefox import GeckoDriverManager

# ================================
# Pytest Fixtures (conftest.py)
# ================================

def pytest_addoption(parser):
    """添加命令行選項"""
    parser.addoption(
        "--browser", 
        action="store", 
        default="chrome", 
        help="Browser to run tests: chrome or firefox"
    )
    parser.addoption(
        "--headless", 
        action="store_true", 
        default=False, 
        help="Run tests in headless mode"
    )
    parser.addoption(
        "--env", 
        action="store", 
        default="local", 
        help="Environment to run tests: local, staging, production"
    )

@pytest.fixture(scope="session")
def test_config(request):
    """測試配置fixture"""
    env = request.config.getoption("--env")
    return TestEnvironment.get_config(env)

@pytest.fixture(scope="session")
def browser_setup(request, test_config):
    """瀏覽器設置fixture"""
    browser = request.config.getoption("--browser")
    headless = request.config.getoption("--headless")
    
    if browser.lower() == "chrome":
        options = BrowserConfig.get_chrome_options(headless)
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
    elif browser.lower() == "firefox":
        options = BrowserConfig.get_firefox_options(headless)
        service = FirefoxService(GeckoDriverManager().install())
        driver = webdriver.Firefox(service=service, options=options)
    else:
        raise ValueError(f"Unsupported browser: {browser}")
    
    driver.maximize_window()
    driver.implicitly_wait(test_config["implicit_wait"])
    
    yield driver
    
    driver.quit()

@pytest.fixture(scope="function")
def clean_driver(browser_setup):
    """清潔的驅動器fixture"""
    driver = browser_setup
    
    # 清除瀏覽器資料
    driver.delete_all_cookies()
    driver.execute_script("localStorage.clear();")
    driver.execute_script("sessionStorage.clear();")
    
    yield driver

@pytest.fixture(scope="function")
def screenshot_on_failure(request, clean_driver):
    """測試失敗時自動截圖"""
    yield
    
    if request.node.rep_call.failed:
        # 建立截圖目錄
        os.makedirs("screenshots/failures", exist_ok=True)
        
        # 生成截圖檔名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        test_name = request.node.name
        screenshot_path = f"screenshots/failures/{test_name}_{timestamp}.png"
        
        # 截圖
        clean_driver.save_screenshot(screenshot_path)
        print(f"截圖已保存: {screenshot_path}")

@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Hook用於獲取測試結果"""
    outcome = yield
    rep = outcome.get_result()
    setattr(item, "rep_" + rep.when, rep)