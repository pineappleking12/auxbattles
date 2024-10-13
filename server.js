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
];

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/:gameCode', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

// Serve the online.html for listing public games
app.get('/online.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'online.html'));
});

// Route to fetch public games
app.get('/publicGames', (req, res) => {
    try {
        const publicGames = Object.keys(games)
            .filter(code => games[code].type === 'public')
            .map(code => ({ code, creatorUsername: games[code].players[0].username }));
        
        console.log('Public games:', publicGames);  // Log the public games
        
        res.status(200).json(publicGames); // Send the public games list as a JSON response
    } catch (error) {
        console.error('Error fetching public games:', error);
        res.status(500).json({ message: 'Server error fetching public games.' });
    }
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinGame', ({ gameCode, username, isHost, type }) => {
        if (!games[gameCode]) {
            games[gameCode] = { players: [], type: type || 'private' };  // Set game type
        }

        const playerUsername = isHost ? `${username} [Owner]` : username;
        const player = { id: socket.id, username: playerUsername, ready: false };
        games[gameCode].players.push(player);

        socket.join(gameCode);
        console.log('Player joined game:', { gameCode, player });

        io.in(gameCode).emit('playerUpdate', games[gameCode].players);
        io.in(gameCode).emit('chatMessage', `${player.username} has joined the game!`);
    });

    socket.on('sendMessage', ({ gameCode, message }) => {
        io.in(gameCode).emit('chatMessage', message);
    });

    socket.on('leaveGame', ({ gameCode, username }) => {
        socket.leave(gameCode);
        if (games[gameCode]) {
            games[gameCode].players = games[gameCode].players.filter(player => player.id !== socket.id);
            io.in(gameCode).emit('playerUpdate', games[gameCode].players);
            io.in(gameCode).emit('chatMessage', `System: ${username} has left the game.`);
        }
    });

    socket.on('startGame', ({ gameCode }) => {
        const players = games[gameCode].players;

        if (players.length < 3) {
            io.in(gameCode).emit('chatMessage', 'Cannot start the game. Need at least 3 players to start.');
        } else {
            let countdown = 3;
            const countdownInterval = setInterval(() => {
                if (countdown > 0) {
                    io.in(gameCode).emit('chatMessage', `Game starts in ${countdown}...`);
                    countdown--;
                } else {
                    clearInterval(countdownInterval);
                    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
                    io.in(gameCode).emit('gameStarting', { prompt: randomPrompt });
                }
            }, 1000);
        }
    });

    socket.on('toggleReady', ({ gameCode, username, ready }) => {
        const players = games[gameCode].players;
        const player = players.find(p => p.username === username);
        if (player) {
            player.ready = ready;
            io.in(gameCode).emit('playerUpdate', players);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start the server
server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
