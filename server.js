const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files (like index.html, game.html, etc.) from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Route for the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html')); // Send the index.html file
});

// Handle game routes
app.get('/:gameCode', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html')); // Send the game.html file
});

// WebSocket logic for real-time chat and game updates
io.on('connection', (socket) => {
  socket.on('joinGame', ({ gameCode, username }) => {
    if (!games[gameCode]) {
      games[gameCode] = [];
    }
    games[gameCode].push({ username, ready: false });
    socket.join(gameCode);
    io.in(gameCode).emit('playerUpdate', games[gameCode]);
    io.in(gameCode).emit('chatMessage', `${username} has joined the game!`);
  });

  socket.on('sendMessage', ({ gameCode, message }) => {
    io.in(gameCode).emit('chatMessage', message);
  });

  socket.on('toggleReady', ({ gameCode, username, ready }) => {
    const players = games[gameCode];
    const player = players.find(p => p.username === username);
    if (player) {
      player.ready = ready;
      io.in(gameCode).emit('playerUpdate', players);
    }
  });
});

server.listen(3000, () => {
  console.log('Listening on *:3000');
});
