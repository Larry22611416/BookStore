import random
import string
from faker import Faker

class TestDataFactory:
    """測試資料工廠"""
    
    def __init__(self):
        self.fake = Faker('zh_TW')
    
    def generate_user_data(self):
        """生成用戶資料"""
        timestamp = int(time.time())
        random_suffix = ''.join(random.choices(string.ascii_lowercase, k=4))
        
        return {
            "email": f"test_{timestamp}_{random_suffix}@bookstore.com",
            "password": "Test123456!",
            "name": self.fake.name(),
            "phone": self.fake.phone_number(),
            "address": self.fake.address()
        }
    
    def generate_book_data(self):
        """生成書籍資料"""
        return {
            "title": self.fake.catch_phrase() + " 測試書籍",
            "author": self.fake.name(),
            "price": random.randint(100, 1000),
            "category": random.choice(["文學", "商業", "科技", "藝術", "歷史"])
        }
    
    def generate_order_data(self, user_email):
        """生成訂單資料"""
        books = [self.generate_book_data() for _ in range(random.randint(1, 3))]
        total_amount = sum(book["price"] for book in books)
        
        return {
            "userEmail": user_email,
            "items": books,
            "totalAmount": total_amount,
            "paymentMethod": random.choice(["credit_card", "atm", "convenience_store", "line_pay"]),
            "shippingAddress": self.fake.address()
        }