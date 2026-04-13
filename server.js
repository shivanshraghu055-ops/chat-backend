const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok", online: io.engine.clientsCount }));
  }
  res.writeHead(200);
  res.end("ConnectMP Chat Server");
});

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// City-based waiting queues
const queues = { bhopal: [], indore: [] };
// Maps socket.id → partner socket.id
const partners = {};

function findPartner(socket, city) {
  const queue = queues[city] || [];
  // Remove stale entries & self
  while (queue.length && (!queue[0].connected || queue[0].id === socket.id)) {
    queue.shift();
  }
  if (queue.length) {
    const partner = queue.shift();
    partners[socket.id] = partner.id;
    partners[partner.id] = socket.id;
    socket.emit("matched", { message: `Connected with a stranger from ${city}!` });
    partner.emit("matched", { message: `Connected with a stranger from ${city}!` });
  } else {
    queue.push(socket);
    socket.emit("waiting", { message: "Searching for someone…" });
  }
}

function disconnectPair(socketId) {
  const partnerId = partners[socketId];
  if (partnerId) {
    delete partners[socketId];
    delete partners[partnerId];
    const partnerSocket = io.sockets.sockets.get(partnerId);
    if (partnerSocket) {
      partnerSocket.emit("partner_disconnected");
    }
  }
  // Remove from all queues
  for (const city in queues) {
    queues[city] = queues[city].filter((s) => s.id !== socketId);
  }
}

io.on("connection", (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on("join", ({ city }) => {
    const c = (city || "bhopal").toLowerCase();
    socket.data.city = c;
    findPartner(socket, c);
  });

  socket.on("message", ({ text }) => {
    const partnerId = partners[socket.id];
    if (partnerId) {
      io.to(partnerId).emit("message", { text, from: socket.id });
    }
  });

  socket.on("typing", () => {
    const partnerId = partners[socket.id];
    if (partnerId) io.to(partnerId).emit("typing");
  });

  socket.on("stop_typing", () => {
    const partnerId = partners[socket.id];
    if (partnerId) io.to(partnerId).emit("stop_typing");
  });

  socket.on("skip", () => {
    disconnectPair(socket.id);
    const city = socket.data.city || "bhopal";
    findPartner(socket, city);
  });

  socket.on("report", ({ reason }) => {
    const partnerId = partners[socket.id];
    console.log(`Report: ${socket.id} reported ${partnerId} — ${reason}`);
    // In production, log to DB
  });

  socket.on("disconnect", () => {
    console.log(`Disconnected: ${socket.id}`);
    disconnectPair(socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
