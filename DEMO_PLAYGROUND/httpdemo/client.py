import urllib.request
import urllib.error
import json

# Define the target server URL (matches our previous server script)
BASE_URL = "http://localhost:6969"

def run_client():
    # 1. Perform initial GET request
    print("--- Sending Initial GET Request ---")
    try:
        # Requesting the /api/status endpoint from our server
        with urllib.request.urlopen(f"{BASE_URL}") as response:
            status_code = response.getcode()
            response_body = response.read().decode('utf-8')
            
            print(f"Server Status Code: {status_code}")
            print(f"Server Response: {response_body}\n")
    except urllib.error.URLError as e:
        print(f"Could not connect to server: {e}")
        print("Make sure your Python server script is running in another terminal window.")
        return

    # 2. Loop for continuous POST requests
    print("--- Entering Interactive POST Loop ---")
    print("Type whatever you want to send to the server, then press Enter.")
    print("Type 'exit' or press Ctrl+C to quit.\n")
    
    while True:
        try:
            # Prompt user for input text
            user_text = input("Enter text to POST: ")
            
            # Check for exit condition
            if user_text.strip().lower() == 'exit':
                print("Exiting client.")
                break
                
            # If the user just hits enter without text, skip it
            if not user_text.strip():
                continue

            # Prepare the JSON payload to match our server's expected dictionary format
            payload = {"text": user_text}
            json_data = json.dumps(payload).encode('utf-8')

            # Create a POST Request object
            # Note: Providing 'data' automatically converts the request method from GET to POST
            req = urllib.request.Request(
                url=f"{BASE_URL}/api/data",
                data=json_data,
                headers={'Content-Type': 'application/json'}
            )

            # Send the request and wait for the response
            with urllib.request.urlopen(req) as response:
                server_reply = response.read().decode('utf-8')
                print(f"-> Server Reply: {server_reply}\n")

        except urllib.error.HTTPError as e:
            print(f"-> HTTP Error from server: {e.code} - {e.reason}")
            # Try to read the error body if available
            try:
                print(f"-> Error details: {e.read().decode('utf-8')}\n")
            except Exception:
                print("")
        except urllib.error.URLError as e:
            print(f"-> Connection Error: {e.reason}\n")
        except (KeyboardInterrupt, EOFError):
            print("\nExiting client.")
            break

if __name__ == "__main__":
    run_client()

