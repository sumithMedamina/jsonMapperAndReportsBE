// server.js

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 5000;

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/key', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Define a MongoDB collection name
const COLLECTION_NAME = 'items';

// Use the native driver's collection method to access MongoDB directly
const db = mongoose.connection;
db.once('open', () => {
  console.log('Connected to MongoDB database');
});

// Use bodyParser middleware to parse JSON bodies
app.use(bodyParser.json());
app.use(cors());

// Routes
app.post('/api/items', async (req, res) => {
  try {
    // Check if the request body is an array
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Request body must be an array' });
    }
    
    // Save each JSON object in the array as a document in the MongoDB collection
    const result = await db.collection('items').insertMany(req.body);
    
    res.status(201).json(result.ops); // Return the inserted documents
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
