const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const games = {};

// Serve static files (including CSS, JS, and HTML files)
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve game.html for any game routes
app.get('/:gameCode', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

// WebSocket logic
io.on('connection', (socket) => {
    socket.on('joinGame', ({ gameCode, username, isHost }) => {
        if (!games[gameCode]) {
          games[gameCode] = [];
        }

        // If the user already exists (based on socket ID), update them
        let player = games[gameCode].find(p => p.id === socket.id);

        if (!player) {
          // Add the new player to the game with the socket ID
          const playerUsername = isHost ? `${username} [Owner]` : username;
          player = { id: socket.id, username: playerUsername, ready: false };
          games[gameCode].push(player);
        }

        socket.join(gameCode);
        io.in(gameCode).emit('playerUpdate', games[gameCode]);
        io.in(gameCode).emit('chatMessage', `${player.username} has joined the game!`);
      });

  socket.on('sendMessage', ({ gameCode, message }) => {
    io.in(gameCode).emit('chatMessage', message);
  });

  socket.on('leaveGame', ({ gameCode, username }) => {
    socket.leave(gameCode);
    
    if (games[gameCode]) {
      games[gameCode] = games[gameCode].filter(player => player.id !== socket.id);
      io.in(gameCode).emit('playerUpdate', games[gameCode]);
      io.in(gameCode).emit('chatMessage', `System: ${username} has left the game.`);
    }
  });

  // Handle game start
  socket.on('startGame', ({ gameCode }) => {
    io.in(gameCode).emit('gameStarting');
  });

  // Handle toggling ready status
  socket.on('toggleReady', ({ gameCode, username, ready }) => {
    const players = games[gameCode];
    const player = players.find(p => p.username === username);

    if (player) {
      player.ready = ready;
      io.in(gameCode).emit('playerUpdate', players);
    }
  });

  socket.on('disconnect', () => {
    // Handle disconnection logic here if needed
  });
});

server.listen(3000, () => {
  console.log('Listening on localhost:3000');
});
