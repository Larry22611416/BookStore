import time
import json
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By

class TestUtils:
    """測試工具類"""
    
    @staticmethod
    def wait_for_element_text(driver, locator, expected_text, timeout=10):
        """等待元素包含指定文字"""
        wait = WebDriverWait(driver, timeout)
        return wait.until(EC.text_to_be_present_in_element(locator, expected_text))
    
    @staticmethod
    def wait_for_url_contains(driver, url_part, timeout=10):
        """等待URL包含指定內容"""
        wait = WebDriverWait(driver, timeout)
        return wait.until(EC.url_contains(url_part))
    
    @staticmethod
    def scroll_to_element(driver, element):
        """滾動到指定元素"""
        driver.execute_script("arguments[0].scrollIntoView(true);", element)
        time.sleep(0.5)
    
    @staticmethod
    def highlight_element(driver, element):
        """高亮顯示元素（用於除錯）"""
        driver.execute_script(
            "arguments[0].style.border='3px solid red'", 
            element
        )
    
    @staticmethod
    def save_page_source(driver, filename):
        """保存頁面原始碼"""
        os.makedirs("debug", exist_ok=True)
        with open(f"debug/{filename}.html", "w", encoding="utf-8") as f:
            f.write(driver.page_source)
    
    @staticmethod
    def clear_browser_data(driver):
        """清除瀏覽器資料"""
        driver.delete_all_cookies()
        driver.execute_script("localStorage.clear();")
        driver.execute_script("sessionStorage.clear();")
        driver.execute_script("""
            if ('indexedDB' in window) {
                indexedDB.databases().then(databases => {
                    databases.forEach(db => {
                        indexedDB.deleteDatabase(db.name);
                    });
                });
            }
        """)
