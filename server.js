import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Serve static files from root directory with html extension support
app.use(express.static(__dirname, {
  extensions: ['html', 'htm']
}));

// Direct manifest route fallback
app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'pwa', 'manifest.json'));
});

// Route for admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
