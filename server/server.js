const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/timeTrackerDB';
const EXTENSION_ID = process.env.EXTENSION_ID || 'njckdndcmiekpokfokebochjnobadllj';
const extensionOrigin = `chrome-extension://${EXTENSION_ID}`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ENTRIES_PER_REQUEST = 500;
const MAX_SECONDS_PER_ENTRY = 24 * 60 * 60;

const app = express();
app.use(cors({
  origin: extensionOrigin,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '100kb' }));

app.get('/', (req, res) => {
  res.send('Backend is running');
});

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Productive / unproductive classification lives in the extension settings
// and is applied at read time, so it is not stored here.
const TimeEntrySchema = new mongoose.Schema({
  date: { type: String, required: true },
  site: { type: String, required: true },
  time: { type: Number, default: 0 }
});
TimeEntrySchema.index({ date: 1, site: 1 }, { unique: true });
const TimeEntry = mongoose.model('TimeEntry', TimeEntrySchema);

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function validateEntry(e) {
  return (
    e &&
    typeof e.date === 'string' && DATE_RE.test(e.date) &&
    typeof e.site === 'string' && e.site.length > 0 && e.site.length <= 255 &&
    typeof e.time === 'number' && Number.isFinite(e.time) &&
    e.time > 0 && e.time <= MAX_SECONDS_PER_ENTRY
  );
}

// Accepts a single entry or an array of { date, site, time }.
app.post('/track', async (req, res) => {
  const entries = Array.isArray(req.body) ? req.body : [req.body];

  if (entries.length === 0 || entries.length > MAX_ENTRIES_PER_REQUEST) {
    return res.status(400).json({ error: 'Invalid number of entries' });
  }
  if (!entries.every(validateEntry)) {
    return res.status(400).json({ error: 'Each entry needs date (YYYY-MM-DD), site and time (seconds)' });
  }

  try {
    await TimeEntry.bulkWrite(entries.map(({ date, site, time }) => ({
      updateOne: {
        filter: { date, site },
        update: { $inc: { time } },
        upsert: true
      }
    })));
    res.status(200).json({ message: 'Tracked successfully', count: entries.length });
  } catch (err) {
    console.error('Error saving time entries:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/weekly-report', async (req, res) => {
  try {
    const start = new Date();
    start.setDate(start.getDate() - 6);

    const entries = await TimeEntry.find({ date: { $gte: localDateKey(start) } });
    res.status(200).json(entries);
  } catch (err) {
    console.error('Error fetching weekly report:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
