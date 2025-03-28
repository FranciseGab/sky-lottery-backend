import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import http from "http";
import cors from "cors";
import { io as ClientIO } from "socket.io-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: "*", methods: ["GET", "POST"] }));

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const port = Number(process.env.PORT) || 3000;

app.use(express.static(path.join(__dirname, "..")));

app.get("/game.html", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../html/game.html"));
});

if (port === 3000) {
  let winningNumbers = null;
  let timer = 60;
  let revealPhase = false;
  let connectedSlaves = new Set();
  let potMoney = [0, 0, 0]; 
  let usersBets = {}; 
  let usersNumbers = {};

  const generateWinningNumbers = () => {
    let numbers = new Set();
    while (numbers.size < 6) {
      numbers.add(Math.floor(Math.random() * 46) + 1);
    }
    return [...numbers];
  };

  const checkUserWin = (userId, userNumbers) => {
    const correctNumbers = userNumbers.filter(number => winningNumbers.includes(number)).length;
    
    let message = '';
    if (correctNumbers === 6) {
      message = `All your numbers are correct! You won the full prize!`;
    } else if (correctNumbers > 0) {
      message = `Great! You have ${correctNumbers} correct number${correctNumbers > 1 ? 's' : ''}!`;
    } else {
      message = `Sorry, no correct numbers. Better luck next time!`;
    }

    return { message, correctNumbers };
  };

  const distributePrize = () => {
    const totalPotMoney = potMoney.reduce((acc, curr) => acc + curr, 0);
    const winners = [];

    for (let userId in usersNumbers) {
      const { message, correctNumbers } = checkUserWin(userId, usersNumbers[userId]);
      io.emit("userResult", { userId, message }); 
      if (correctNumbers === 6) {
        winners.push(userId);
      }
    }

    if (winners.length > 0) {
      const prize = totalPotMoney / winners.length; 
      winners.forEach(winner => {
        io.emit("prizeWon", { userId: winner, prize });
        console.log(`User ${winner} won ₱${prize}`);
      });
    } else {
      io.emit("noWinners", "No one won the prize this time.");
    }

    potMoney = [0, 0, 0];
    io.emit("updatePotMoney", potMoney);
  };

  const countdown = () => {
    if (timer > 0) {
      timer--;
    } else {
      if (!revealPhase) {
        winningNumbers = generateWinningNumbers();
        io.emit("updateWinningNumbers", winningNumbers);
        revealPhase = true;
        timer = 30;
      } else {
        distributePrize();
        revealPhase = false;
        timer = 60;
        io.emit("updateWinningNumbers", null);
      }
    }
    io.emit("updateTimer", timer);
    setTimeout(countdown, 1000);
  };

  countdown();

  io.on("connection", (socket) => {
    console.log(`[Client] connected to Master server`);

    socket.emit("updatePotMoney", potMoney);
    socket.emit("updateTimer", timer);
    socket.emit("updateWinningNumbers", winningNumbers);

    socket.on("placeBet", ({ betAmount, userId, userNumbers }) => {
      if (betAmount > 0) {
        let slotIndex = potMoney.findIndex(money => money === 0);
        if (slotIndex === -1) slotIndex = Math.floor(Math.random() * 3);

        potMoney[slotIndex] += betAmount;
        usersBets[userId] = betAmount;
        usersNumbers[userId] = userNumbers; 

        io.emit("updatePotMoney", potMoney);
        console.log(`User ${userId} placed ₱${betAmount}, Updated Pot Money: ${potMoney}`);
      }
    });

    socket.on("registerSlave", (slavePort) => {
      connectedSlaves.add(slavePort);
      console.log(`[Slave] ${slavePort} is connected to Master`);
    });

    socket.on("disconnect", () => {
      console.log(`[Client] disconnected from Master`);
    });
  });
}

if (port !== 3000) {
  const masterServer = ClientIO("http://localhost:3000", {
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 3000,
  });

  let localPotMoney = [0, 0, 0]; 
  let timer = 60;
  let winningNumbers = null;

  masterServer.on("connect", () => {
    masterServer.emit("registerSlave", port);
  });

  masterServer.on("disconnect", () => {
    console.log(`[Slave] ${port} disconnected from Master`);
  });

  masterServer.on("connect_error", (err) => {
    console.log(`[Slave] ${port} Connection Error: ${err.message}`);
  });

  masterServer.on("updatePotMoney", (data) => {
    localPotMoney = data;
    io.emit("updatePotMoney", localPotMoney);
  });

  masterServer.on("updateWinningNumbers", (data) => {
    winningNumbers = data;
    io.emit("updateWinningNumbers", winningNumbers);
  });

  masterServer.on("updateTimer", (data) => {
    timer = data;
    io.emit("updateTimer", timer);
  });

  io.on("connection", (socket) => {
    console.log(`[Client] connected to Slave ${port}`);

    socket.emit("updatePotMoney", localPotMoney);
    socket.emit("updateTimer", timer);
    socket.emit("updateWinningNumbers", winningNumbers);

    socket.on("placeBet", ({ betAmount, userId, userNumbers }) => {
      if (betAmount > 0) {
        console.log(`Relaying bet from Slave ${port} to Master`);
        masterServer.emit("placeBet", { betAmount, userId, userNumbers });
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Client] disconnected from Slave ${port}`);
    });
  });
}

server.listen(port, () => {
  console.log(port === 3000 ? `[Master] server is running on port ${port}` : `[Slave] server is running on ${port}`);
});
