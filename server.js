// In server.js, ensuring prompt is correctly sent to all clients
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const games = {};
const prompts = [
    "Best Frank Ocean song", 
    "Best Drake song", 
    "Best KSI song"
]; // List of prompts

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/:gameCode', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

// Handle Socket.IO connections
io.on('connection', (socket) => {
    socket.on('joinGame', ({ gameCode, username, isHost }) => {
        if (!games[gameCode]) {
            games[gameCode] = [];
        }

        // Ensure username is captured correctly
        const playerUsername = isHost ? `${username} [Owner]` : username;
        const player = { id: socket.id, username: playerUsername, ready: false };
        games[gameCode].push(player);

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

    socket.on('startGame', ({ gameCode }) => {
      const players = games[gameCode];
      if (players.length < 2) {
          io.in(gameCode).emit('chatMessage', 'Cannot start the game. Need at least 2 players to start.');
      } else {
          let countdown = 3;
  
          // Emit countdown messages every second
          const countdownInterval = setInterval(() => {
              if (countdown > 0) {
                  io.in(gameCode).emit('chatMessage', `Game starts in ${countdown}...`);
                  countdown--;
              } else {
                  clearInterval(countdownInterval);
  
                  // Randomize the prompt from the list
                  const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
                  
              }
          }, 1000);
      }
  });
  
  
  

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

// Start the server
server.listen(3000, () => {
    console.log('Listening on localhost:3000');
});
