const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = 4000;

const extensionOrigin = 'chrome-extension://njckdndcmiekpokfokebochjnobadllj';

app.use(cors({
  origin: extensionOrigin,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Backend is running');
});

mongoose.connect('mongodb://localhost:27017/timeTrackerDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const TimeEntrySchema = new mongoose.Schema({
  date: String,
  site: String,
  time: Number,
  category: String
});
const TimeEntry = mongoose.model('TimeEntry', TimeEntrySchema);

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

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
