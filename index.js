const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 5000;

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/Ott', {
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
      path = urlObj.pathname;
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
    // Check if the URL is a full URL or a path
    let path;
    try {
      path = new URL(url).pathname; // Extract path from URL
    } catch (e) {
      if (url.startsWith('/')) {
        path = url; // It's already a path
      } else {
        throw new Error('Invalid URL or path');
      }
    }
    console.log(path);
    const item = await Item.findOne({ path });
    if (item) {
      res.status(200).json({ path, data: item.data });
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

async function getFieldNamesFromCollection(collectionName) {
  const collection = mongoose.connection.collection(collectionName);
  const document = await collection.findOne({});
  return document ? Object.keys(document) : [];
}

// GET endpoint to retrieve field names
app.get('/fields-data', async (req, res) => {
  try {
      const productFields = await getFieldNamesFromCollection('products');
      const ordersFields = await getFieldNamesFromCollection('orders');
      

      const dict_data = {
          'products': productFields,
          'orders': ordersFields,
      };

      res.json(dict_data);
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});

// POST endpoint for generating reports
app.post('/generate-reports', async (req, res) => {
  try {
    const { products_fields, order_fields, conditions } = req.body;

    // Ensure validConditions is defined, even if it's an empty object
    const validConditions = conditions || {};

    // Separate the conditions for each collection
    const productConditions = {};
    const orderConditions = {};

    // Helper function to determine and convert the data type dynamically
    const convertConditionValue = async (collectionName, key, value) => {
      const sampleDoc = await mongoose.connection.collection(collectionName).findOne({}, { projection: { [key]: 1 } });
      const fieldValue = sampleDoc ? sampleDoc[key] : null;

      if (fieldValue !== null && typeof fieldValue !== typeof value) {
        if (typeof fieldValue === 'number') {
          return parseFloat(value);
        } else if (fieldValue instanceof Date) {
          return new Date(value);
        }
        // Add more type checks if needed
      }
      return value;
    };

    // Split conditions based on which collection the fields belong to
    for (const [key, value] of Object.entries(validConditions)) {
      if (products_fields.includes(key)) {
        productConditions[key] = await convertConditionValue('products', key, value);
      }
      if (order_fields.includes(key)) {
        orderConditions[key] = await convertConditionValue('orders', key, value);
      }
    }

    // Build projections for each collection
    const productProjection = products_fields.reduce((acc, field) => ({ ...acc, [field]: 1 }), {});
    const orderProjection = order_fields.reduce((acc, field) => ({ ...acc, [field]: 1 }), {});

    // Query each collection with the relevant conditions and projections
    const products = await mongoose.connection.collection('products')
      .find(productConditions)
      .project(productProjection)
      .toArray();

    const orders = await mongoose.connection.collection('orders')
      .find(orderConditions)
      .project(orderProjection)
      .toArray();

    // Combine the data into a single response
    const response_data = {
      "products": products,
      "orders": orders,
    };

    res.json(response_data);
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});



