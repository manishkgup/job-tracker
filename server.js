const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth',   require('./routes/auth'));
app.use('/api/jobs',   require('./routes/jobs'));
app.use('/api/resume', require('./routes/resume'));

// Fallback — serve index.html for any unknown route (SPA pattern)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\nJob Tracker running at http://localhost:${PORT}\n`);
});
