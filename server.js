const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const waitingUsers = [];

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("find-partner", (data) => {
    console.log("Find partner request from:", socket.id);

    // Remove from waiting list if already there
    const existingIdx = waitingUsers.findIndex((u) => u.id === socket.id);
    if (existingIdx !== -1) waitingUsers.splice(existingIdx, 1);

    // Find someone else waiting
    const waiting = waitingUsers.find((u) => u.id !== socket.id);

    if (waiting) {
      // Remove matched user from queue
      waitingUsers.splice(waitingUsers.indexOf(waiting), 1);

      // Pair them
      socket.partner = waiting;
      waiting.partner = socket;

      console.log("Matched:", socket.id, "<->", waiting.id);
      socket.emit("matched");
      waiting.emit("matched");
    } else {
      // No one available, add to queue
      waitingUsers.push(socket);
      socket.emit("waiting");
      console.log("User added to queue:", socket.id, "| Queue size:", waitingUsers.length);
    }
  });

  socket.on("sendMessage", (data) => {
    console.log("Message from", socket.id, ":", data);
    if (socket.partner) {
      socket.partner.emit("receiveMessage", data);
    }
  });

  socket.on("message", (data) => {
    console.log("Message (alt) from", socket.id, ":", data);
    if (socket.partner) {
      socket.partner.emit("receiveMessage", data);
    }
  });

  socket.on("typing", () => {
    if (socket.partner) {
      socket.partner.emit("typing");
    }
  });

  socket.on("skip", () => {
    console.log("Skip from:", socket.id);
    if (socket.partner) {
      socket.partner.emit("partner-disconnected");
      socket.partner.partner = null;
    }
    socket.partner = null;
  });

  socket.on("report", () => {
    console.log("Report from:", socket.id);
    if (socket.partner) {
      socket.partner.emit("partner-disconnected");
      socket.partner.partner = null;
    }
    socket.partner = null;
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    // Remove from waiting queue
    const idx = waitingUsers.findIndex((u) => u.id === socket.id);
    if (idx !== -1) waitingUsers.splice(idx, 1);

    // Notify partner
    if (socket.partner) {
      socket.partner.emit("partner-disconnected");
      socket.partner.partner = null;
    }
  });
});

app.get("/", (req, res) => {
  res.send("Chat backend is running!");
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
