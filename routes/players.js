const Player = require('../models/player.model');

module.exports = function(io) {
  const router = require('express').Router();

  const ACTIVE_THRESHOLD = 10 * 60 * 1000; // 10 minutes

  const removeInactivePlayers = async () => {
    // ... (your existing removeInactivePlayers function)
  };

  const broadcastPlayerList = async () => {
    const activePlayers = await Player.find();
    io.emit('playerList', activePlayers);
  };

  router.route('/').get(async (req, res) => {
    try {
      await removeInactivePlayers();
      const activePlayers = await Player.find();
      res.json(activePlayers);
    } catch (err) {
      res.status(500).json({ message: 'Error fetching active players', error: err.message });
    }
  });

  // ... (rest of your routes)

  return router;
};