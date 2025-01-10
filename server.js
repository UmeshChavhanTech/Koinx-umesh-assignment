require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const schedule = require('node-schedule');
const Crypto = require('./model/Crypto');

// App and Database Setup
const app = express();
const PORT = 3000;

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Background Job
const fetchCryptoData = async () => {
    try {
      const ids = ['bitcoin', 'matic-network', 'ethereum'];
      const params = {
        ids: ids.join(','),
        vs_currencies: 'usd',
        include_market_cap: 'true',
        include_24hr_change: 'true',
      };
  
      const { data } = await axios.get(process.env.COINGECKO_API, { params });
      console.log('API Response:', data); // Debug log the response
  
      ids.forEach(async (id) => {
        if (!data[id]) {
          console.error(`No data found for ${id}`);
          return;
        }
  
        const crypto = new Crypto({
          name: id,
          price: data[id]?.usd || 0, // Default to 0 if the value is missing
          marketCap: data[id]?.usd_market_cap || 0,
          change24h: data[id]?.usd_24h_change || 0,
        });
  
        await crypto.save();
        console.log(`Saved data for ${id}`);
      });
    } catch (error) {
      console.error('Error fetching cryptocurrency data:', error.message);
    }
  };
  
fetchCryptoData(); // Trigger the job manually


// Schedule the Job
schedule.scheduleJob('0 */2 * * *', fetchCryptoData); // Every 2 hours

// Define the '/stats' endpoint for task 2 
app.get('/stats', async (req, res) => {
    const coin = req.query.coin;
  
    // Validate the coin query parameter
    if (!coin) {
      return res.status(400).json({ error: 'Query parameter "coin" is required.' });
    }
  
    const validCoins = ['bitcoin', 'matic-network', 'ethereum'];
    if (!validCoins.includes(coin)) {
      return res.status(400).json({ error: `"${coin}" is not a valid coin. Use one of: ${validCoins.join(', ')}` });
    }
  
    try {
      // Find the latest record for the requested coin
      const cryptoData = await Crypto.findOne({ name: coin }).sort({ timestamp: -1 });
  
      if (!cryptoData) {
        return res.status(404).json({ error: `No data found for ${coin}.` });
      }
  
      // Respond with the latest data
      res.json({
        price: cryptoData.price,
        marketCap: cryptoData.marketCap,
        '24hChange': cryptoData.change24h,
      });
    } catch (error) {
      console.error('Error fetching stats:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });


  // Define the /deviation endpoint  for task no 3.
app.get('/deviation', async (req, res) => {
    const coin = req.query.coin;
  
    // Validate the coin query parameter
    if (!coin) {
      return res.status(400).json({ error: 'Query parameter "coin" is required.' });
    }
  
    const validCoins = ['bitcoin', 'matic-network', 'ethereum'];
    if (!validCoins.includes(coin)) {
      return res.status(400).json({ error: `"${coin}" is not a valid coin. Use one of: ${validCoins.join(', ')}` });
    }
  
    try {
      // Fetch the last 100 records for the requested coin
      const records = await Crypto.find({ name: coin })
        .sort({ timestamp: -1 })
        .limit(100);
  
      if (records.length < 2) {
        return res.status(400).json({ error: `Not enough data to calculate standard deviation for ${coin}.` });
      }
  
      // Extract prices
      const prices = records.map((record) => record.price);
  
      // Calculate mean
      const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  
      // Calculate variance
      const variance =
        prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
  
      // Calculate standard deviation
      const standardDeviation = Math.sqrt(variance);
  
      // Respond with the standard deviation
      res.json({
        coin,
        standardDeviation: parseFloat(standardDeviation.toFixed(2)), // Round to 2 decimal places
      });
    } catch (error) {
      console.error('Error calculating standard deviation:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  

// Start the Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
