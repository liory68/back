const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const httpServer = http.createServer(app);

// Use environment variables
const port = process.env.PORT || 5000;
const frontendUrl = process.env.FRONTEND_URL || "https://front-delta-sepia.vercel.app";

// Update CORS configuration
app.use(cors({
  origin: frontendUrl,
  credentials: true
}));

app.use(express.json());

const uri = process.env.ATLAS_URI;
const mongooseOptions = {
  serverSelectionTimeoutMS: 5000,
};

mongoose.connect(uri, mongooseOptions)
  .then(() => {
    console.log("MongoDB database connection established successfully");
    console.log("Database name:", mongoose.connection.name);
    console.log("Connected to:", mongoose.connection.host);
  })
  .catch(err => {
    console.error("MongoDB connection error: ", err);
    process.exit(1);
  });

// Add this line to log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} request for '${req.url}' - Origin: ${req.headers.origin}`);
  next();
});

const playersRouter = require('./routes/players');
const questionsRouter = require('./routes/questions');

console.log('Registering routes...');
app.use('/players', playersRouter);
app.use('/questions', questionsRouter);
console.log('Routes registered');

app.get('/', (req, res) => {
  res.json({ message: "Welcome to the game server!" });
});

// Modify the error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

app.get('/test', (req, res) => {
  res.json({ message: "Server is running!" });
});

const Player = require('./models/player.model');
const Question = require('./models/question.model');

const activeGames = new Map();

// Update Socket.IO CORS configuration
const io = socketIo(httpServer, {
  cors: {
    origin: frontendUrl,
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('createGame', async (playerData, callback) => {
    console.log('Received createGame request:', playerData);
    try {
      const gameId = Math.random().toString(36).substring(7);
      const game = {
        id: gameId,
        players: [],
        currentQuestion: null
      };
      activeGames.set(gameId, game);
      socket.join(gameId);
      
      // Add player to the game
      const newPlayer = new Player({
        name: playerData.name,
        score: 0,
        color: playerData.color,
        lastActive: new Date()
      });
      await newPlayer.save();
      game.players.push(newPlayer);
      
      // Fetch initial question
      game.currentQuestion = await getRandomQuestion();
      
      console.log('Game created successfully:', gameId);
      callback({ success: true, gameId, player: newPlayer, question: game.currentQuestion });
      io.to(gameId).emit('playerList', game.players);
    } catch (error) {
      console.error('Error in createGame:', error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on('joinGame', async (gameId, playerData, callback) => {
    console.log('Received joinGame request:', gameId, playerData);
    try {
      let game = activeGames.get(gameId);
      if (!game) {
        game = {
          id: gameId,
          players: [],
          currentQuestion: await getRandomQuestion(),
          sockets: new Map(),
          questionCount: 0
        };
        activeGames.set(gameId, game);
      }
      
      // Check if player already exists in the game
      let existingPlayer = game.players.find(p => p.name === playerData.name);
      if (existingPlayer) {
        // If player exists, update their socket and return the existing player
        game.sockets.set(socket.id, existingPlayer._id);
        callback({ success: true, player: existingPlayer, question: game.currentQuestion });
        socket.join(gameId);
        io.to(gameId).emit('playerList', game.players);
        return;
      }
      
      socket.join(gameId);
      
      // Add player to the game
      const newPlayer = new Player({
        name: playerData.name,
        score: 0,
        color: playerData.color,
        lastActive: new Date()
      });
      await newPlayer.save();
      game.players.push(newPlayer);
      game.sockets.set(socket.id, newPlayer._id);
      
      console.log('Player joined game successfully:', newPlayer);
      callback({ success: true, player: newPlayer, question: game.currentQuestion });
      io.to(gameId).emit('playerList', game.players);

      // Set up disconnect handler for this socket
      socket.on('disconnect', () => {
        console.log('Player disconnected from game:', gameId);
        const playerId = game.sockets.get(socket.id);
        game.sockets.delete(socket.id);
        if (playerId) {
          game.players = game.players.filter(p => p._id.toString() !== playerId.toString());
          io.to(gameId).emit('playerList', game.players);
          
          // If no players left, remove the game
          if (game.players.length === 0) {
            activeGames.delete(gameId);
          }
        }
      });

    } catch (error) {
      console.error('Error in joinGame:', error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on('submitAnswer', async ({ gameId, playerId, answer }, callback) => {
    const game = activeGames.get(gameId);
    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }

    const player = game.players.find(p => p._id.toString() === playerId);
    if (!player) {
      callback({ success: false, error: 'Player not found' });
      return;
    }

    if (answer === game.currentQuestion.answer) {
      player.score += game.currentQuestion.value;
      await player.save();
      game.questionCount++;
      
      if (game.questionCount >= 10) {
        // End the game
        const sortedPlayers = game.players.sort((a, b) => b.score - a.score);
        io.to(gameId).emit('gameEnded', sortedPlayers);
        callback({ success: true, correct: true, gameEnded: true });
      } else {
        game.currentQuestion = await getRandomQuestion();
        io.to(gameId).emit('newQuestion', game.currentQuestion);
        callback({ success: true, correct: true });
      }
    } else {
      game.currentQuestion.value += 1;
      player.lastAnswer = false;
      callback({ success: true, correct: false });
      
      // Check if all players have answered incorrectly
      const allPlayersAnswered = game.players.every(p => p.lastAnswer === false);
      if (allPlayersAnswered) {
        game.questionCount++;
        if (game.questionCount >= 10) {
          // End the game
          const sortedPlayers = game.players.sort((a, b) => b.score - a.score);
          io.to(gameId).emit('gameEnded', sortedPlayers);
        } else {
          game.currentQuestion = await getRandomQuestion();
          io.to(gameId).emit('newQuestion', game.currentQuestion);
        }
        // Reset lastAnswer for all players
        game.players.forEach(p => p.lastAnswer = null);
      }
    }

    io.to(gameId).emit('playerList', game.players);
  });

  socket.on('playAgain', async (gameId, callback) => {
    const game = activeGames.get(gameId);
    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }

    game.questionCount = 0;
    game.players.forEach(p => p.score = 0);
    game.currentQuestion = await getRandomQuestion();

    io.to(gameId).emit('newQuestion', game.currentQuestion);
    io.to(gameId).emit('playerList', game.players);
    callback({ success: true, question: game.currentQuestion });
  });
});

async function getRandomQuestion() {
  const count = await Question.countDocuments();
  const random = Math.floor(Math.random() * count);
  const question = await Question.findOne().skip(random);
  return {
    question: question.question,
    answer: question.answer,
    value: question.value
  };
}

// Export for Vercel
module.exports = app;