CHROME EXTENSION FOR TIME TRACKING AND PRODUCTIVITY ANALYTICS - PRODUCTIVITY TRACKER

COMPANY: CODTECH IT SOLUTIONS

NAME: Aditya Samson

INTERN ID: CT08DL961

DOMAIN: FULL STACK WEB DEVELOPMENT

BATCH DURATION: May 20th, 2025 to July 20th, 2025

MENTOR NAME : NEELA SANTHOSH KUMAR

DESCRIPTION OF TASK PERFORMED :

This task involved the development of a Chrome Extension (Manifest V3) that tracks the amount of time a user spends on various websites in real-time.
The extension runs quietly in the background, records time per website, lets the user classify sites as productive or unproductive, and turns the data into charts, insights and exportable reports.
All data is stored locally in the browser - there is no server, account or database, and nothing leaves the user's computer.


<img width="1920" height="1080" alt="Screenshot (255)" src="https://github.com/user-attachments/assets/472287f0-a754-428a-8539-1f5d6abbc076" />
<img width="1119" height="890" alt="Screenshot 2025-07-14 125230" src="https://github.com/user-attachments/assets/a70b57fd-5221-44d9-a7e8-f88b2d86b297" />

OBJECTIVES:

Track time spent on each website accurately, only while the user is really using it.

Let the user decide which sites to track (Start Tracking / Pause / Resume per site).

Display live tracked time and goal progress in the extension popup.

Show daily and period analytics, trends and productivity insights on an analytics page.

Allow classification of websites as productive or unproductive.

Help the user stay on target with daily goals and per-site limits.

Keep the user's data private, and give them backup and restore.

Ensure the system is resilient, minimal, and user-friendly.

KEY FEATURES:

1. Accurate Time Tracking

Tracking starts per site: a new website shows a "Start Tracking" button, then Pause / Resume.

The timer only runs while the tab is active, the browser window is focused and the user is not idle (60 seconds). Playing audio or video counts as activity.

Time is credited against the local date, and is split correctly when it crosses midnight, so the day always flips at local midnight.

The Manifest V3 service worker can be suspended at any time, so no in-memory timers are used. State is kept in chrome.storage and every event or 30-second alarm re-syncs the tracker.

"www.example.com" and "example.com" are tracked as one site.

If the computer sleeps or the browser is suspended, the gap is not counted.

2. Popup

Shows the current website (with a copy button), a live timer, and a status of Tracking, Paused or Waiting.

Start Tracking / Pause / Resume button for the current site.

Daily goal progress bar, and the time left on a site limit (or a notice that it has been reached).

One-click Productive / Unproductive buttons for sites that are not classified yet.

Shortcuts to the analytics page and the settings page.

Modern minimalist "liquid glass" design.

3. Analytics Page

Daily View: pick any date to see a pie chart of productive vs unproductive time, plus lists of productive, unproductive and unclassified sites with search and sorting. Unclassified sites can be classified right from the list.

Report View: choose the last 7, 14 or 30 days, this month, or a custom date range.

Summary cards for productive, unproductive and unclassified time, and the productivity ratio.

Insights: trend compared with the previous period, best and worst day, daily average, total tracked time and goal streak.

Stacked bar chart per day, top 10 sites, and a daily breakdown table that includes the weekday.

A prompt that lists sites still needing a category.

Export the report as a PDF.

Pages refresh automatically and roll over at midnight.

4. Settings Page

Add, search, sort and remove productive / unproductive websites.

Daily productive goal (in minutes) and per-site daily limits, with notifications when a goal or limit is reached (once per day).

Backup and Restore: export all data as a JSON file and restore it later. Imported files are validated and size-limited before they replace any data.

Option to run the first-time setup again.

5. First-Run Onboarding

A short welcome page explains how the extension works, lets the user pick common sites as productive or unproductive, and sets a daily goal.

6. Privacy and Storage

Time data is stored in chrome.storage.local (with the unlimitedStorage permission).

Website classifications and goals are stored in chrome.storage.sync, so they follow the user across their signed-in Chrome devices. Sync storage has size limits, so the extension warns the user if a list grows too large.

The live tracking state is kept in chrome.storage.session.

The extension makes no network requests. All scripts and charts are bundled, no external fonts or icon files are loaded, and a strict content security policy is used.

TECHNICAL STACK:

Extension UI:

HTML, CSS (glassmorphism), Vanilla JavaScript

Chrome Extension APIs (tabs, windows, storage, alarms, idle, notifications, runtime)

Manifest V3 background service worker (ES module)

Libraries (bundled in /lib):

Chart.js 4.5.0 for charts

jsPDF 4.2.1 for PDF reports

DATA FLOW:

Background service worker watches tab, window and idle events and a 30-second alarm

Elapsed time is credited to the active site and saved to chrome.storage.local

Popup and analytics pages read the stored data and render timers, charts and reports

Classifications and goals are read from chrome.storage.sync and used for the productive / unproductive split and notifications

PROJECT STRUCTURE:

manifest.json - extension configuration and permissions

background.js - tracking engine, alarms, goal / limit notifications

common.js - shared helpers (dates, formatting, classification, goals, storage limits)

popup.html / popup.js - toolbar popup

analytics.html / analytics.js - daily view, report view and PDF export

options.html / options.js - classifications, goals and limits, backup and restore

onboarding.html / onboarding.js - first-run setup

styles.css - shared styles

lib/ - Chart.js and jsPDF

HOW TO INSTALL:

1. Open chrome://extensions and turn on Developer mode.

2. Click "Load unpacked" and select this project folder.

3. Open the extension from the toolbar on any website and press Start Tracking.

KNOWN LIMITATIONS:

Data lives only in the user's browser profile and is stored unencrypted. Uninstalling the extension or losing the profile deletes it, so use Backup regularly.

Time history is not synced between devices (only classifications and goals are).

All time data is kept in a single storage entry, which is fine for years of normal use.

FINAL OUTCOME:

This task resulted in a fully functioning Chrome Extension that:

Accurately tracks time spent per site and handles idle time, focus and midnight correctly.

Displays a live-updating timer, goal progress and limit warnings.

Offers analytics with trends, streaks, best and worst days, and PDF export.

Stores all tracked data locally and privately on the user's computer, with backup and restore.

Possible future work: optional cloud sync of history, data encryption, and automated tests for the date logic.

OUTPUT:

<img width="590" height="817" alt="Screenshot 2025-07-14 125641" src="https://github.com/user-attachments/assets/5a856d9f-124c-40a4-a387-fcf10c47bba3" />
<img width="1920" height="1080" alt="Screenshot (255)" src="https://github.com/user-attachments/assets/e2555d88-9986-42cf-b732-33c57611f8fa" />
<img width="1119" height="890" alt="Screenshot 2025-07-14 125230" src="https://github.com/user-attachments/assets/79f972d6-e758-461e-aabf-7a963c9d7fef" />
<img width="1183" height="888" alt="Screenshot 2025-07-19 210000" src="https://github.com/user-attachments/assets/2f3d0bb8-f5c8-47fd-a011-fa341af4423d" />
<img width="772" height="744" alt="Screenshot 2025-07-14 125137" src="https://github.com/user-attachments/assets/d5d71776-1e4b-4674-b82a-0e0e6efd74ff" />
