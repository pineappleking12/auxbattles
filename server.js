const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const axios = require('axios'); // To make HTTP requests

const games = {};
const prompts = [
    "Best Frank Ocean song", 
    "Best Drake song", 
    "Best KSI song"
];

const SPOTIFY_CLIENT_ID = 'e13a6cf593714dde85b170a81eccad0f';  // Replace with your Spotify Client ID
const SPOTIFY_CLIENT_SECRET = '3d403943b2e24d06950cbba74e60a60a';  // Replace with your Spotify Client Secret
let spotifyAccessToken = '';

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

// Spotify Authentication: Fetch token
app.get('/spotify-token', async (req, res) => {
    try {
        const response = await axios.post('https://accounts.spotify.com/api/token', 
        'grant_type=client_credentials', 
        {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        spotifyAccessToken = response.data.access_token;
        res.status(200).json({ token: spotifyAccessToken });
    } catch (error) {
        console.error('Error fetching Spotify token:', error);
        res.status(500).json({ message: 'Error fetching Spotify token' });
    }
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinGame', ({ gameCode, username, isHost, type }) => {
        if (!games[gameCode]) {
            games[gameCode] = { players: [], responses: [], type: type || 'private' };  // Set game type and empty responses array
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

                    // Start the 15-second timer for responses
                    startPromptTimer(gameCode);
                }
            }, 1000);
        }
    });

    // Collect responses from players
    socket.on('submitResponse', ({ gameCode, response }) => {
        const player = games[gameCode].players.find(p => p.id === socket.id);
        if (player) {
            games[gameCode].responses.push({ username: player.username, response });
            console.log(`Response from ${player.username}: ${response}`);
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

    // Function to start the 15-second prompt timer
    function startPromptTimer(gameCode) {
        let timer = 15;
        const timerInterval = setInterval(() => {
            if (timer > 0) {
                io.in(gameCode).emit('timerUpdate', timer);
                timer--;
            } else {
                clearInterval(timerInterval);

                // After timer ends, show all responses
                io.in(gameCode).emit('timerEnd', games[gameCode].responses);
                games[gameCode].responses = []; // Reset responses for the next round
            }
        }, 1000);
    }
});

// Start the server
server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
