import subprocess
import sys
import argparse
from datetime import datetime

class TestRunner:
    """測試執行器"""
    
    def __init__(self):
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    def run_smoke_tests(self, browser="chrome", headless=False):
        """執行冒煙測試"""
        cmd = [
            "pytest", 
            "-v",
            "-m", "smoke",
            f"--browser={browser}",
            f"--html=reports/smoke_test_{self.timestamp}.html",
            "--self-contained-html"
        ]
        
        if headless:
            cmd.append("--headless")
        
        return subprocess.run(cmd)
    
    def run_regression_tests(self, browser="chrome", headless=False):
        """執行回歸測試"""
        cmd = [
            "pytest", 
            "-v",
            f"--browser={browser}",
            f"--html=reports/regression_test_{self.timestamp}.html",
            "--self-contained-html",
            "--tb=short"
        ]
        
        if headless:
            cmd.append("--headless")
        
        return subprocess.run(cmd)
    
    def run_parallel_tests(self, browser="chrome", workers=2):
        """執行平行測試"""
        cmd = [
            "pytest", 
            "-v",
            "-n", str(workers),
            f"--browser={browser}",
            f"--html=reports/parallel_test_{self.timestamp}.html",
            "--self-contained-html"
        ]
        
        return subprocess.run(cmd)

def main():
    parser = argparse.ArgumentParser(description="書客來自動化測試執行器")
    parser.add_argument("--type", choices=["smoke", "regression", "parallel"], 
                       default="regression", help="測試類型")
    parser.add_argument("--browser", choices=["chrome", "firefox"], 
                       default="chrome", help="瀏覽器類型")
    parser.add_argument("--headless", action="store_true", help="無頭模式")
    parser.add_argument("--workers", type=int, default=2, help="平行執行的worker數量")
    
    args = parser.parse_args()
    
    runner = TestRunner()
    
    print(f"🚀 開始執行 {args.type} 測試...")
    print(f"瀏覽器: {args.browser}")
    print(f"無頭模式: {args.headless}")
    
    if args.type == "smoke":
        result = runner.run_smoke_tests(args.browser, args.headless)
    elif args.type == "regression":
        result = runner.run_regression_tests(args.browser, args.headless)
    elif args.type == "parallel":
        result = runner.run_parallel_tests(args.browser, args.workers)
    
    if result.returncode == 0:
        print("✅ 測試執行完成")
    else:
        print("❌ 測試執行失敗")
    
    return result.returncode

if __name__ == "__main__":
    sys.exit(main())