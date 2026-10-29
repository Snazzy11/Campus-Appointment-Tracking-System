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

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from back_end.app.schemas.rso_schema import RSOBase

# from ...back_end.app.database.models import rso
from scraper import scrape_v1
from scraper.scrape_v1 import RSO

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
        email_element = driver.find_element(
            By.XPATH,
            "/html/body/div[2]/div/div/div/div/div[1]/div/div[2]/div/div[3]/div/div[2]/div[2]",
        )
        email_contact = email_element.text
        self.assertTrue(email_contact.__contains__("P:"))

    def test_phone_number_validation(self):
        rso_example_one = {
            "id": 1,
            "name": "Action Replay CMICH",
            "description": "random description that is so cool and awesome ",
            "link": "https://engage.apps.cmich.edu/organization/actionreplay",
            "email": "actionreplayCMICH@gmail.com",
            "phone": " 989-774-4000",
            "location": "None",
        }

        rso_object = RSOBase(**rso_example_one)
        self.assertTrue(rso_object.validate_phone)

    def test_no_location_present(self):
        # example with no location on the website
        print("Testing link with no location present")
        URL = "https://engage.apps.cmich.edu/organization/appeal-dance-team"
        rso_example = scrape_v1.RSO(1, "test", "test desc", URL)
        driver.get(URL)
        scrape_v1.addLocation(rso_example)
        self.assertEqual(rso_example.location, "None")


if __name__ == "__main__":
    unittest.main()
    driver.quit()