from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from urllib.parse import urljoin
import time


BASE_URL = "https://engage.apps.cmich.edu"
ORGANIZATIONS_URL = f"{BASE_URL}/organizations"


options = webdriver.ChromeOptions()
options.add_argument("--window-size=1920,1080")

# Leave this disabled while developing
# options.add_argument("--headless=new")

driver = webdriver.Chrome(options=options)


try:
    print("Opening organizations page...")

    driver.get(ORGANIZATIONS_URL)

    WebDriverWait(driver, 20).until(
        EC.presence_of_element_located(
            (By.ID, "react-app")
        )
    )

    # Give React time to populate organizations
    time.sleep(5)

    print("Loaded:", driver.title)
    print()


    # --------------------------------------------------
    # Find organization links
    # --------------------------------------------------

    links = driver.find_elements(
        By.CSS_SELECTOR,
        'a[href*="/organization/"]'
    )

    organizations = {}

    for link in links:

        href = link.get_attribute("href")

        if not href:
            continue

        # Remove query strings / fragments if present
        href = href.split("?")[0]
        href = href.split("#")[0]

        # Only actual organization pages
        if "/organization/" not in href:
            continue

        text = link.text.strip()

        # Dictionary automatically removes duplicates
        organizations[href] = text


    print(
        f"Found {len(organizations)} organization URLs\n"
    )

    for i, (url, text) in enumerate(
        organizations.items(),
        start=1
    ):
        print(f"[{i}] {text!r}")
        print(f"    {url}")


    # --------------------------------------------------
    # DISCOVERY:
    # Open the first organization
    # --------------------------------------------------

    if organizations:

        first_url = next(iter(organizations))

        print("\n--------------------------------")
        print("Opening first organization:")
        print(first_url)
        print("--------------------------------\n")

        driver.get(first_url)

        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located(
                (By.TAG_NAME, "body")
            )
        )

        time.sleep(3)

        print("TITLE:")
        print(driver.title)

        print("\nVISIBLE TEXT:")
        print("=" * 80)

        body = driver.find_element(
            By.TAG_NAME,
            "body"
        )

        print(body.text)

        print("=" * 80)


        # --------------------------------------------------
        # Print links found on organization page
        # --------------------------------------------------

        print("\nLINKS ON ORGANIZATION PAGE:\n")

        page_links = driver.find_elements(
            By.TAG_NAME,
            "a"
        )

        for i, link in enumerate(page_links):

            text = link.text.strip()
            href = link.get_attribute("href")

            if text or href:
                print(
                    f"[{i}] "
                    f"text={text!r} "
                    f"href={href!r}"
                )


        # --------------------------------------------------
        # Print buttons
        # --------------------------------------------------

        print("\nBUTTONS ON ORGANIZATION PAGE:\n")

        buttons = driver.find_elements(
            By.TAG_NAME,
            "button"
        )

        for i, button in enumerate(buttons):

            print(
                f"[{i}] "
                f"text={button.text!r} "
                f"id={button.get_attribute('id')!r} "
                f"aria-label="
                f"{button.get_attribute('aria-label')!r}"
            )


    input("\nPress Enter to quit...")


finally:
    driver.quit()