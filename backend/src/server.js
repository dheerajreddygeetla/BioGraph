const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/entities', require('./routes/entityRoutes'));
app.use('/api/relationships', require('./routes/relationshipRoutes'));
app.use('/api/graph', require('./routes/graphRoutes'));   // NEW

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'BioGraph Backend is running' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
});