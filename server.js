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

  socket.on('leaveGame', ({ gameCode, username }) => {
    socket.leave(gameCode);
    
    if (games[gameCode]) {
      games[gameCode] = games[gameCode].filter(player => player.username !== username);
      io.in(gameCode).emit('playerUpdate', games[gameCode]);
      io.in(gameCode).emit('chatMessage', `System: ${username} has left the game.`);
    }
  });
  
  // Handle game start
  socket.on('startGame', ({ gameCode }) => {
    io.in(gameCode).emit('gameStarting');
  });
  
  socket.on('toggleReady', ({ gameCode, username, ready }) => {
    const players = games[gameCode];
    
    // Check if players array exists for the gameCode
    if (!players) {
      console.error(`No players found for gameCode: ${gameCode}`);
      return;
    }

    const player = players.find(p => p.username === username);

    // Check if the player exists in the game
    if (!player) {
      console.error(`Player ${username} not found in gameCode: ${gameCode}`);
      return;
    }

    player.ready = ready;
    io.in(gameCode).emit('playerUpdate', players);
  });
});

server.listen(3000, () => {
  console.log('Listening on localhost:3000');
});
