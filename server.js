import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

// ✅ CORS FIX (IMPORTANT)
const io = new Server(server, {
  cors: {
    origin: "*", // later you can restrict
    methods: ["GET", "POST"]
  }
});

// ✅ Health check (for uptime robot)
app.get("/", (req, res) => {
  res.send("Server is running ✅");
});

// ✅ Queue system
let waitingUsers = [];

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // 🔥 USER REQUESTS MATCH
  socket.on("find-partner", () => {
    console.log("User wants partner:", socket.id);

    // If someone is waiting → match them
    if (waitingUsers.length > 0) {
      const partner = waitingUsers.shift();

      socket.partner = partner;
      partner.partner = socket;

      // Notify both users
      socket.emit("matched", { partnerId: partner.id });
      partner.emit("matched", { partnerId: socket.id });

      console.log("Matched:", socket.id, "with", partner.id);
    } else {
      // No one waiting → add to queue
      waitingUsers.push(socket);
      console.log("User added to queue:", socket.id);
    }
  });

  // 🔥 HANDLE DISCONNECT
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    // Remove from waiting queue
    waitingUsers = waitingUsers.filter(u => u.id !== socket.id);

    // Notify partner if exists
    if (socket.partner) {
      socket.partner.emit("partner-disconnected");
      socket.partner.partner = null;
    }
  });

  // 🔥 OPTIONAL: next user button
  socket.on("next", () => {
    if (socket.partner) {
      socket.partner.emit("partner-disconnected");
      socket.partner.partner = null;
      socket.partner = null;
    }

    // find new partner again
    socket.emit("find-partner");
  });
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
