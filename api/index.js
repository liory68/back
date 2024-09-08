const express = require('express');
const app = express();

app.get('/api/test', (req, res) => {
  res.json({ message: 'Hello from the server!' });
});

module.exports = app;