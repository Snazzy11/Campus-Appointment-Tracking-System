# Basic HTTP Server with Chat Functionality
# This server allows clients to send messages via POST requests and view the chat history via a simple web page.
# It uses the built-in HTTPServer and BaseHTTPRequestHandler classes from Python's http.server module.
# This is step 1 of a simple chat application. The server stores messages in memory and serves them to clients upon explicit request.

from http.server import BaseHTTPRequestHandler, HTTPServer
import json

# Global storage for messages (shared across all request handler instances)
MESSAGES_DB = []

class ChatRequestHandler(BaseHTTPRequestHandler):
    
    # New Method: Handles updating the chat list
    def add_message(self, sender_ip, text):
        """Appends a dictionary containing the sender and text to the global chat list."""
        message_entry = {
            "sender": sender_ip,
            "text": text
        }
        MESSAGES_DB.append(message_entry)
        print(f"[CHAT UPDATE] {sender_ip}: {text}")

    # 1. Handle GET Requests
    def do_GET(self):
        # Route: Homepage (dynamically displays the chat)
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
            
            # Build the dynamic HTML content
            html = "<h1>Simple Python Chat Room</h1>"
            html += "<h3>Messages:</h3>"
            html += "<div style='border: 1px solid #ccc; padding: 10px; max-width: 500px; max-height: 400px; overflow-y: auto;'>"
            
            if not MESSAGES_DB:
                html += "<p style='color: gray;'>No messages yet. Send one via the client!</p>"
            else:
                html += "<ul style='list-style-type: none; padding-left: 0;'>"
                for msg in MESSAGES_DB:
                    html += f"<li style='margin-bottom: 8px;'><strong>[{msg['sender']}]:</strong> {msg['text']}</li>"
                html += "</ul>"
            
            html += "</div>"
            html += "<p><small>Refresh the page to see new messages.</small></p>"
            
            self.wfile.write(html.encode('utf-8'))
            
        # Route: API endpoint (optional, left from before)
        elif self.path == '/api/status':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            response = {"status": "running", "chat_length": len(MESSAGES_DB)}
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        else:
            self.send_error(404, "Page Not Found")

    # 2. Handle POST Requests
    def do_POST(self):
        if self.path == '/api/data':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data_received = json.loads(post_data.decode('utf-8'))
                message_text = data_received.get("text", "").strip()
                
                if message_text:
                    # Capture the sender's IP address from client_address
                    sender_ip = self.client_address[0]
                    
                    # Call the new method to update the chat database
                    self.add_message(sender_ip, message_text)
                
                # Respond to the client
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                
                response = {
                    "status": "success",
                    "message": "Message posted to chat room."
                }
                self.wfile.write(json.dumps(response).encode('utf-8'))
                
            except json.JSONDecodeError:
                self.send_error(400, "Bad Request: Invalid JSON")
        else:
            self.send_error(404, "Endpoint Not Found")

def run(port=6969):
    server_address = ('', port)
    httpd = HTTPServer(server_address, ChatRequestHandler)
    print(f"Chat server running on http://localhost:{port}...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
        httpd.server_close()

if __name__ == '__main__':
    run()
