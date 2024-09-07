const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const playerSchema = new Schema({
  name: { type: String, required: true },
  score: { type: Number, required: true },
  color: { type: String, required: true },
  lastActive: { type: Date, default: Date.now }
}, {
  timestamps: true,
});

const Player = mongoose.model('Player', playerSchema);

module.exports = Player;