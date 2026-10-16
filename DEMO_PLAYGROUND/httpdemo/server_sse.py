# This version uses ThreadingHTTPServer to allow multiple simultaneous SSE connections without freezing the server.
# It automatically pushes new messages to all connected clients in real-time.
# It uses built in HTTP protocols and does not require a modern browser to support WebSockets. Instead, it uses Server-Sent Events (SSE) which is widely supported.

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import time

# Shared storage for messages
MESSAGES_DB = []

class SSERequestHandler(BaseHTTPRequestHandler):
    
    def add_message(self, sender_ip, text):
        """Appends a message to the global list."""
        message_entry = {
            "sender": sender_ip,
            "text": text
        }
        MESSAGES_DB.append(message_entry)
        print(f"[CHAT UPDATE] {sender_ip}: {text}")

    def do_GET(self):
        # 1. Route: The Root (Web Page with JavaScript Frontend)
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
            
            # The client-side JavaScript listens to the SSE stream via EventSource
            html = """
            <!DOCTYPE html>
            <html>
            <head>
                <title>SSE Chat Room</title>
                <style>
                    body { font-family: sans-serif; margin: 20px; }
                    #chat-box { border: 1px solid #ccc; padding: 10px; max-width: 500px; height: 300px; overflow-y: auto; background: #f9f9f9; }
                    .msg { margin-bottom: 8px; }
                </style>
            </head>
            <body>
                <h1>Python SSE Chat Room</h1>
                <div id="chat-box"></div>
                <p><small>Listening to real-time updates via Server-Sent Events...</small></p>

                <script>
                    const chatBox = document.getElementById('chat-box');
                    
                    // Open a persistent SSE connection to the server
                    const eventSource = new EventSource('/api/stream');
                    
                    // This triggers automatically whenever the server pushes data
                    eventSource.onmessage = function(event) {
                        const msgData = JSON.parse(event.data);
                        
                        // Clear the "no messages" state if it's the first message
                        if(chatBox.innerHTML.includes('No messages')) chatBox.innerHTML = '';
                        
                        // Append the new message dynamically without a page refresh
                        const newMsg = document.createElement('div');
                        newMsg.className = 'msg';
                        newMsg.innerHTML = `<strong>[${msgData.sender}]:</strong> ${msgData.text}`;
                        chatBox.appendChild(newMsg);
                        
                        // Auto-scroll to the bottom
                        chatBox.scrollTop = chatBox.scrollHeight;
                    };
                    
                    eventSource.onerror = function() {
                        console.log("Stream disconnected. Browser will auto-reconnect...");
                    };
                </script>
            </body>
            </html>
            """
            self.wfile.write(html.encode('utf-8'))
            
        # 2. Route: The Live SSE Stream Endpoint
        elif self.path == '/api/stream':
            # SSE headers tell the browser to keep the connection open and stop caching
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Connection', 'keep-alive')
            self.end_headers()
            
            # Track which messages this specific connection has already seen
            last_seen_index = 0
            
            print(f"[SSE CONNECTED] Client started stream: {self.client_address}")
            
            # Infinite Loop: Keep the connection open indefinitely
            while True:
                try:
                    # Check if there are any new messages in the global database
                    while last_seen_index < len(MESSAGES_DB):
                        msg = MESSAGES_DB[last_seen_index]
                        
                        # SSE requires a strict format: "data: <your_string>\n\n"
                        sse_payload = f"data: {json.dumps(msg)}\n\n"
                        
                        self.wfile.write(sse_payload.encode('utf-8'))
                        self.wfile.flush() # Instantly force data over the network
                        
                        last_seen_index += 1
                    
                    # Sleep briefly to avoid slamming the CPU in a tight loop
                    time.sleep(0.5)
                    
                except (ConnectionResetError, BrokenPipeError):
                    # Gracefully detect when the user closes the browser tab
                    print(f"[SSE DISCONNECTED] Client closed stream: {self.client_address}")
                    break

        else:
            self.send_error(404, "Page Not Found")

    def do_POST(self):
        # 3. Route: Accept text payloads from your custom client script
        if self.path == '/api/data':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data_received = json.loads(post_data.decode('utf-8'))
                message_text = data_received.get("text", "").strip()
                
                if message_text:
                    # Append it to the list; our infinite GET loop will notice it instantly
                    self.add_message(self.client_address[0], message_text)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode('utf-8'))
                
            except json.JSONDecodeError:
                self.send_error(400, "Bad Request")
        else:
            self.send_error(404)

def run(port=6969):
    # Note: Built-in HTTPServer is single-threaded. It will freeze if multiple browser tabs open SSE streams simultaneously.
    # For testing, we use standard HTTPServer but keep it to one active browser view.
    server_address = ('', port)
    httpd = ThreadingHTTPServer(server_address, SSERequestHandler)
    print(f"Chat server running on http://localhost:{port}...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
        httpd.server_close()

if __name__ == '__main__':
    run()
