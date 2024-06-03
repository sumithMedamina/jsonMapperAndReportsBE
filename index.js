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

// Use bodyParser middleware to parse JSON bodies
app.use(bodyParser.json());
app.use(cors());

// Define a schema and model for the items collection
const itemSchema = new mongoose.Schema({
  path: String,
  data: [{}],
}, { strict: false });
const Item = mongoose.model('Item', itemSchema, 'items');

// Function to create dynamic GET routes based on stored paths
const createDynamicRoute = (path) => {
  app.get(path, async (req, res) => {
    try {
      const item = await Item.findOne({ path });
      if (item) {
        res.status(200).json(item.data);
      } else {
        res.status(404).json({ error: 'Data not found' });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });
};

// POST route to save data to MongoDB
app.post('/api/save', async (req, res) => {
  try {
    let { path, data } = req.body;
    
    // Extract the path from the URL if a full URL is provided
    if (path.includes('://')) {
      const urlObj = new URL(path);
      path = urlObj.pathname.toLowerCase()
      ;
    }

    // Replace the existing document if it exists, otherwise insert a new one
    const result = await Item.findOneAndReplace({ path }, { path, data }, { upsert: true, new: true });

    // Create a dynamic route for the saved data
    createDynamicRoute(path);

    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST route to rebrand URL and fetch data
app.post('/api/rebrand', async (req, res) => {
  try {
    const { url } = req.body;
    let path;
 
    // Check if the URL is a full URL or a path
    try {
      const urlObj = new URL(url);
      path = urlObj.pathname.toLowerCase(); // Extract path from URL
    } catch (e) {
      if (url.startsWith('/')) {
        path = url.toLowerCase(); // It's already a path
      } else {
        throw new Error('Invalid URL or path');
      }
    }
 
    const item = await Item.findOne({ path });
    if (item) {
      res.status(200).json({ path: item.path, data: item.data });
    } else {
      res.status(404).json({ error: 'URL not found in database' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
 


// GET route to fetch only paths from items collection
app.get('/api/paths', async (req, res) => {
  try {
    const paths = await Item.find({}, 'path'); // Project only the 'path' field
    res.status(200).json(paths);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
