const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // In production, replace with your frontend URL
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

const port = process.env.PORT || 5000;

app.use(cors({
  origin: "*", // Allow all origins for development. Change this to your frontend URL in production.
  credentials: true
}));

app.use(express.json());

const uri = process.env.ATLAS_URI;
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("MongoDB connection error:", err));

const Question = require('./models/question.model');

const games = new Map();

io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('joinGame', async ({ gameId, playerName }) => {
    let game = games.get(gameId);
    if (!game) {
      game = { players: [], currentQuestion: await getRandomQuestion(), questionCount: 0 };
      games.set(gameId, game);
    }
    const player = { id: socket.id, name: playerName, score: 0 };
    game.players.push(player);
    socket.join(gameId);
    socket.emit('gameJoined', { player, currentQuestion: game.currentQuestion });
    io.to(gameId).emit('playerList', game.players);
  });

  socket.on('submitAnswer', async ({ gameId, answer }) => {
    const game = games.get(gameId);
    if (!game) return;
    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;
    
    if (answer === game.currentQuestion.answer) {
      player.score += 1;
      game.questionCount += 1;
      if (game.questionCount >= 10) {
        endGame(gameId);
      } else {
        game.currentQuestion = await getRandomQuestion();
        io.to(gameId).emit('newQuestion', game.currentQuestion);
      }
    }
    io.to(gameId).emit('playerList', game.players);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

async function getRandomQuestion() {
  const count = await Question.countDocuments();
  const random = Math.floor(Math.random() * count);
  return await Question.findOne().skip(random);
}

function endGame(gameId) {
  const game = games.get(gameId);
  const sortedPlayers = game.players.sort((a, b) => b.score - a.score);
  io.to(gameId).emit('gameEnded', sortedPlayers);
  games.delete(gameId);
}

app.get('/test', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

server.listen(port, () => console.log(`Listening on port ${port}`));