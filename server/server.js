const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = 4000;

// Replace with your actual Chrome extension ID:
const extensionOrigin = 'chrome-extension://njckdndcmiekpokfokebochjnobadllj';

// Middleware
app.use(cors({
  origin: extensionOrigin,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.send('Backend is running');
});

// Connect to local MongoDB
mongoose.connect('mongodb://localhost:27017/timeTrackerDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define schema and model
const TimeEntrySchema = new mongoose.Schema({
  date: String,
  site: String,
  time: Number,
  category: String
});
const TimeEntry = mongoose.model('TimeEntry', TimeEntrySchema);

// Save time entry
app.post('/track', async (req, res) => {
  const { date, site, time, category } = req.body;
  try {
    const existing = await TimeEntry.findOne({ date, site });
    if (existing) {
      existing.time += time;
      await existing.save();
    } else {
      await TimeEntry.create({ date, site, time, category });
    }
    res.status(200).json({ message: 'Tracked successfully' });
  } catch (err) {
    console.error('Error saving time entry:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get weekly report
app.get('/weekly-report', async (req, res) => {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);

    const entries = await TimeEntry.find({
      date: { $gte: oneWeekAgo.toISOString().split('T')[0] }
    });

    res.status(200).json(entries);
  } catch (err) {
    console.error('Error fetching weekly report:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
