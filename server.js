import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();

// Allow all origins (important for frontend connection)
app.use(cors());

const server = http.createServer(app);

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Socket connection
io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  // Join all users to same room (simple working solution)
  socket.join("global");

  // When message is sent
  socket.on("sendMessage", (data) => {
    console.log("📩 Message received:", data);

    // Send message to ALL users (including sender)
    io.to("global").emit("receiveMessage", data);
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

// Basic route (to check server)
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

// IMPORTANT: Render uses process.env.PORT
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
