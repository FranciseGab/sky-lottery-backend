import { WebSocketServer } from "ws";
import express from "express";

const PORT = 3000;
const app = express();

app.use(express.static("C:/Users/Francise Grace/sky-lottory"));

app.get('/game.html', (req, res) => {
  res.sendFile("C:/Users/Francise Grace/sky-lottory/html/game.html");
});

const server = app.listen(PORT, () => {
  console.log(`The Http server is running on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

let potMoney = 0;
let timer = 120;
let history = [];

console.log(`The Websocket Server is running on ws://localhost:${PORT}`);

const generateWinningNumbers = () => {
  let numbers = new Set();
  while (numbers.size < 6) {
    numbers.add(Math.floor(Math.random() * 99) + 1);
  }
  return [...numbers];
};

let winningNumbers = generateWinningNumbers();

const broadcast = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(data));
    }
  });
};

setInterval(() => {
  if (timer > 0) {
    timer--;
  } else {
    winningNumbers = generateWinningNumbers();
    history.push({ date: new Date().toLocaleString(), numbers: winningNumbers });

    timer = 120;
  }

  broadcast({ potMoney, timer, history, winningNumbers });
}, 1000);

wss.on("connection", (ws) => {
  console.log("Subscriber connected!");
  ws.send(JSON.stringify({ potMoney, timer, history }));

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.action === "bet" && typeof data.amount === "number" && data.amount > 0) {
        potMoney += data.amount; 
        console.log(`New bet received: ${data.amount}`);
        broadcast({ potMoney, timer, history });
      }

    } catch (error) {
      console.error("Invalid message received:", error);
    }
  });

  ws.on("close", () => {
    console.log("Subscriber disconnected!");
  });
});

