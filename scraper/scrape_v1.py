from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from urllib.parse import urljoin
import time
from dataclasses import dataclass
from selenium.common.exceptions import NoSuchElementException

ORGANIZATIONS_URL = "https://engage.apps.cmich.edu/organizations"

options = webdriver.ChromeOptions()
options.add_argument("--window-size=1920,1080")

# Leave this disabled while developing
# options.add_argument("--headless=new")

driver = webdriver.Chrome(options=options)

organizations = {}
# RSOs = []
RSOs = {} 
id_count = 0

# TODO: translate RSO object to a model... make it in models/RSO.py?
@dataclass
class RSO:
    id: int
    name: str
    description: str
    link: str
    email: str
    phone: str
    location:  str
    def __init__(self, id: int, name: str, description: str , link: str):
        self.id = id
        self.name = name
        self.description = description
        self.link = link
        self.email = ""
        self.phone = ""
        self.location = ""

    def setEmailContact(self, email):
        self.email = email
    
    def setPhoneContact(self, phone):
        self.phone = phone
        
    def setLocation(self, location):
        self.location = location
    
try:
    print("Opening organizations page...")

    driver.get(ORGANIZATIONS_URL)

    WebDriverWait(driver, 20).until(
        EC.presence_of_element_located(
            (By.ID, "react-app")
        )
    )

    # Give React time to populate organizations
    # time.sleep(5)

    print("Loaded:", driver.title)

    loading_sites = True
    
    print("Loading all sites in Organizations page...")
    while(loading_sites):
        try:
            load_button = driver.find_element(By.XPATH, "//span[contains(text(), 'Load More')]")
            if load_button:
                load_button.click()
                time.sleep(1)
        except NoSuchElementException:
            print("Load button was not loaded, continue on with scraping the URLs");
            loading_sites = False;
        
        
    # Find organization links

    links = driver.find_elements(
        By.CSS_SELECTOR,
        'a[href*="/organization/"]'
    )

    print("Reading organizations and making RSO objects...")
    for link in links:
        href = link.get_attribute("href");

        if not href:
            continue

        # Remove query strings / fragments if present
        href = href.split("?")[0]
        href = href.split("#")[0]

        # Skips links that don't have the /organization/ path inside of it
        if "/organization/" not in href:
            continue

        text = link.text.strip()

        # Dictionary automatically removes duplicates
        organizations[href] = text
        info = text.split("\n");
        
        # Store info into a RSO object
        name = info[0]
        desc = info[1]
        id_count = id_count + 1
        
        #TODO: implement sqlachemy to make sqlalchemy objects
        # RSOs.append(RSO(id_count, name, desc, href))
        RSOs[id_count] = RSO(id_count, name, desc, href)

    print(
        f"Found {len(organizations)} organization URLs and created {len(RSOs)} RSO objects\n"
    )
    
    successful_attempt_count = 0
    failed_attempt_count = 0

    # after revealing all url links, it goes through each one and get info from them. if they're found then add them to the rso object. if not, then they will be empty strings
    for rso in RSOs.values():
        print("Loading " + rso.name + " link. . .\n")
        driver.get(rso.link)
        
        # email check
        try:
            email_element = driver.find_element(By.XPATH, "/html/body/div[2]/div/div/div/div/div[1]/div/div[2]/div/div[3]/div/div[2]/div[2]")
            
            # for a specific case if that element has a phone number instead of an email
            if not email_element.text.__contains__("P: "):
                email_contact = email_element.text.split("E: ")[1]
                rso.setEmailContact(email_contact)
            
            rso.setEmailContact("None")
        except NoSuchElementException:
            print(f"{rso.id} STATUS: Email wasn't found")
            rso.setEmailContact("None")

        # phone number check
        try:
            phone_number_element = driver.find_element(By.XPATH, "/html/body/div[2]/div/div/div/div/div[1]/div/div[2]/div/div[3]/div/div[2]/div[3]")
            phone_contact = phone_number_element.text.split("P:")[1]
            rso.setPhoneContact(phone_contact)
        except NoSuchElementException:
            print(f"{rso.id} STATUS: Phone Number wasn't found")
            rso.setPhoneContact("None")
            
        # location check
        try:
            location_element = driver.find_element(By.XPATH, "/html/body/div[2]/div/div/div/div/div[1]/div/div[2]/div/div[3]/div/div[2]/div[1]")
            location = location_element.text.split("Address")[1]
            if location == "" or location == " ":
                print(f"{rso.id} : Location var was empty")
                rso.setLocation("None")
            else: 
                rso.setLocation(location)
            
        except NoSuchElementException:
            print(f"{rso.id} STATUS: Location wasn't found")
            rso.setLocation("None")
        
        # summary for attempt
        print(f"\nID: {rso.id}\nEMAIL: {rso.email}\nPHONE: {rso.phone}\nLOCATION: {rso.location}\n")    
        
        
    # success_rate = round(float(successful_attempt_count/len(RSOs))) * 100
    # print("\n\n\n_______Summary_______\nSuccessful contact count: " + str(successful_attempt_count) + "\nFailure contact count: " + str(failed_attempt_count) + "\nSuccess rate: " + str(round(float(successful_attempt_count/len(RSOs)), 2)))
    
    for rso in RSOs.values():
        print(str(rso))
        
finally:
    driver.quit()