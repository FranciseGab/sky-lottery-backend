import WebSocket, { WebSocketServer } from "ws";
import express from "express";

const PORT = 3001;
const app = express();

app.use(express.static("C:/Users/Francise Grace/sky-lottory"));

app.get('/game.html', (req, res) => {
  res.sendFile("C:/Users/Francise Grace/sky-lottory/html/game.html");
});

// Create HTTP server
const server = app.listen(PORT, () => {
  console.log(`HTTP Server running on http://localhost:${PORT}`);
});

// Attach WebSocket Server to HTTP server (if needed)
const wss = new WebSocketServer({ server });

// Connect WebSocket to Publisher (3000)
const ws = new WebSocket("ws://localhost:3000");

console.log(`Subscriber 1 WebSocket running on ws://localhost:${PORT}`);

ws.on("open", () => {
  console.log("Connected to Publisher (3000)");
});

ws.on("message", (data) => {
  const update = JSON.parse(data);
  console.log("Update Received in Subscriber 1:", update);

  // Broadcast received data to all connected clients
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(update));
    }
  });
});

ws.on("close", () => {
  console.log("Disconnected from Publisher (3000)");
});
