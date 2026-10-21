# ignore this, this is testing a specific case where the phone number is on the element where emails are...

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from urllib.parse import urljoin
import time
from dataclasses import dataclass
from selenium.common.exceptions import NoSuchElementException
import unittest

BASE_URL = ""
ORGANIZATIONS_URL = f"{BASE_URL}/organizations"

options = webdriver.ChromeOptions()
options.add_argument("--window-size=1920,1080")

driver = webdriver.Chrome(options=options)
# driver.get(BASE_URL)
# # test code here, this is a certain test case
# try:
#     email_element = driver.find_element(By.XPATH, "/html/body/div[2]/div/div/div/div/div[1]/div/div[2]/div/div[3]/div/div[2]/div[2]")
#     email_contact = email_element.text
    
#     print("Has P: in contact text: " + str(email_contact.__contains__("P:")))
#     print(email_element.text)        
# except NoSuchElementException:
#     print("Not found")
# finally:
#     driver.quit()

class RSOTests(unittest.TestCase):
    def test_email_case(self):
        driver.get("https://engage.apps.cmich.edu/organization/athleteservices")
        email_element = driver.find_element(By.XPATH, "/html/body/div[2]/div/div/div/div/div[1]/div/div[2]/div/div[3]/div/div[2]/div[2]")
        email_contact = email_element.text
        self.assertTrue(email_contact.__contains__("P:"))
        
if __name__ == "__main__":
    unittest.main()