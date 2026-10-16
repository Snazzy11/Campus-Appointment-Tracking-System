from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from urllib.parse import urljoin
import time
from dataclasses import dataclass
from selenium.common.exceptions import NoSuchElementException

BASE_URL = "https://engage.apps.cmich.edu"
ORGANIZATIONS_URL = f"{BASE_URL}/organizations"
options = webdriver.ChromeOptions()
options.add_argument("--window-size=1920,1080")

# Leave this disabled while developing
# options.add_argument("--headless=new")

driver = webdriver.Chrome(options=options)

organizations = {}
RSOs = [] 
id_count = 0

@dataclass
class RSO:
    id: int
    name: str
    description: str
    link: str
    
    def __init__(self, id: int, name: str, description: str , link: str):
        self.id = id
        self.name = name
        self.description = description
        self.link = link

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
    
    while(loading_sites):
        try:
            load_button = driver.find_element(By.XPATH, "//span[contains(text(), 'Load More')]")
            if load_button:
                load_button.click()
                time.sleep(1)
                print("Load More button clicked")
        except NoSuchElementException:
            print("Load button was not loaded, continue on with scraping the URLs");
            loading_sites = False;
        
        
    # Find organization links

    links = driver.find_elements(
        By.CSS_SELECTOR,
        'a[href*="/organization/"]'
    )

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
        RSOs.append(RSO(id_count, name, desc, href))

    print(
        f"Found {len(organizations)} organization URLs\n"
    )
    
    for rso in RSOs:
        print(rso.name + "\n" + rso.link + "\n\n")
    
    #after revealing all url links, it goes through each one and get info from them.

    # if organizations:

    #     url = next(iter(organizations))

    #     print("\n--------------------------------")
    #     print("Opening organization:")
    #     print(url)
    #     print("--------------------------------\n")

    #     driver.get(url)

    #     WebDriverWait(driver, 5).until(
    #         EC.presence_of_element_located(
    #             (By.TAG_NAME, "body")
    #         )
    #     )

    #     print("=" * 80)


    #     # --------------------------------------------------
    #     # Print links found on organization page
    #     # --------------------------------------------------

    #     print("\nLINKS ON ORGANIZATION PAGE:\n")

    #     page_links = driver.find_elements(
    #         By.TAG_NAME,
    #         "a"
    #     )

    #     for i, link in enumerate(page_links):

    #         text = link.text.strip()
    #         href = link.get_attribute("href")

    #         if text or href:
    #             print(
    #                 f"[{i}] "
    #                 f"text={text!r} "
    #                 f"href={href!r}"
    #             )


        # # --------------------------------------------------
        # # Print buttons
        # # --------------------------------------------------

        # print("\nBUTTONS ON ORGANIZATION PAGE:\n")

        # buttons = driver.find_elements(
        #     By.TAG_NAME,
        #     "button"
        # )

        # for i, button in enumerate(buttons):

        #     print(
        #         f"[{i}] "
        #         f"text={button.text!r} "
        #         f"id={button.get_attribute('id')!r} "
        #         f"aria-label="
        #         f"{button.get_attribute('aria-label')!r}"
        #     )


    input("\nPress Enter to quit...")


finally:
    driver.quit()