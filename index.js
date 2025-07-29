const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://client-fky8gkon9-masas-projects-e538d05a.vercel.app",
    process.env.CLIENT_URL
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    message: 'Whiteboard server is running!',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        canvas: [],
        users: new Set()
      });
    }
    
    rooms.get(roomId).users.add(socket.id);
    
    socket.emit('canvas-state', rooms.get(roomId).canvas);
    
    socket.to(roomId).emit('user-joined', socket.id);
    
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on('draw', (data) => {
    const { roomId, drawData } = data;
    console.log(`Draw event received for room ${roomId}:`, drawData);
    
    if (rooms.has(roomId)) {
      rooms.get(roomId).canvas.push(drawData);
      socket.to(roomId).emit('draw', drawData);
      console.log(`Draw data broadcasted to room ${roomId}`);
    }
  });

  socket.on('clear-canvas', (roomId) => {
    if (rooms.has(roomId)) {
      rooms.get(roomId).canvas = [];
      io.to(roomId).emit('canvas-cleared');
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    rooms.forEach((room, roomId) => {
      if (room.users.has(socket.id)) {
        room.users.delete(socket.id);
        socket.to(roomId).emit('user-left', socket.id);
        
        if (room.users.size === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});