CHROME EXTENSION FOR TIME TRACKING AND PRODUCTIVITY ANALYTICS - WEB TIME TRACKER

COMPANY: CODTECH IT SOLUTIONS

NAME: Aditya Samson

INTERN ID: CT08DL961

DOMAIN: FULL STACK WEB DEVELOPMENT

BATCH DURATION: May 20th,2025 to July 20th, 2025

MENTOR NAME : NEELA SANTHOSH KUMAR

DESCRIPTION OF TASK PERFORMED :

This task involved the development of a Chrome Extension that tracks the amount of time a user spends on various websites in real-time. 
The primary goal was to create a system that operates seamlessly in the background, capturing and storing browsing behavior while providing useful visual insights and analytics on a dashboard.


<img width="1920" height="1080" alt="Screenshot (255)" src="https://github.com/user-attachments/assets/472287f0-a754-428a-8539-1f5d6abbc076" />
<img width="1119" height="890" alt="Screenshot 2025-07-14 125230" src="https://github.com/user-attachments/assets/a70b57fd-5221-44d9-a7e8-f88b2d86b297" />

OBJECTIVES:

Build a Chrome Extension that automatically starts tracking time spent on each website.

Ensure that time is tracked accurately and continuously while the tab is active.

Sync tracked time to a Node.js + MongoDB backend in real-time.

Display live tracked time in the extension popup.

Show historical analytics and productivity insights in a separate dashboard (dashboard.html).

Allow classification of websites as productive or unproductive.

Ensure the system is resilient, minimal, and user-friendly.

Key Features Implemented:

1. Real-Time Timer & Tracking Logic

A background script constantly monitors the currently active tab.

Once a website is opened or switched to, a timer starts automatically.

If the tab is changed, closed, or the user becomes inactive, the timer stops.

Time is updated every second and sent to the backend using fetch API to persist time in MongoDB.

A flush mechanism ensures no time is lost during popup close or extension shutdown.

2. Popup UI :

Displays the hostname of the active site.

Shows the live timer updating every second.

Tracks time from scratch without depending on the backend for timer values (ensures consistency and avoids rewind bugs).

Syncs time to backend in real-time (every second).

3. Backend Integration:

Backend is built using Node.js and Express, with time data stored in MongoDB.

POST requests are sent to an endpoint (/api/usage/usage) with hostname and timeSpent.

Backend stores or updates time entries grouped by website and date.

4. Analytics Dashboard:

Visual representation of time spent using Pie Charts and Daily/Weekly reports.

Calendar component allows users to pick a date and see a breakdown of time tracked on that day.

Productive vs Unproductive time is shown for each day.

5. Persistent Storage:

Uses chrome.storage.local to store data for quick access within the extension.

Backend handles long-term analytics and aggregations.

Technical Stack:

Frontend (Extension UI):

HTML, CSS, Vanilla JavaScript

Chrome Extension APIs (chrome.tabs, chrome.runtime, chrome.storage)

Chart.js for visual analytics

Backend:

Node.js with Express

MongoDB with Mongoose (v7+)

Data Flow:

Real-time timer in popup script

Background script monitors tab activity

Backend receives usage data and updates MongoDB

Dashboard fetches data from MongoDB and renders charts

Final Outcome
This task resulted in a fully functioning Chrome Extension that:

Accurately tracks time spent per site.

Displays a live-updating timer.

Sends tracked data to a backend in real-time.

Offers a visual analytics dashboard with productivity breakdowns.

This lays the foundation for future features such as classification management, user authentication, long-term productivity reports, and exporting usage summaries.

OUTPUT:

<img width="590" height="817" alt="Screenshot 2025-07-14 125641" src="https://github.com/user-attachments/assets/5a856d9f-124c-40a4-a387-fcf10c47bba3" />
<img width="1920" height="1080" alt="Screenshot (255)" src="https://github.com/user-attachments/assets/e2555d88-9986-42cf-b732-33c57611f8fa" />
<img width="1119" height="890" alt="Screenshot 2025-07-14 125230" src="https://github.com/user-attachments/assets/79f972d6-e758-461e-aabf-7a963c9d7fef" />
<img width="1183" height="888" alt="Screenshot 2025-07-19 210000" src="https://github.com/user-attachments/assets/2f3d0bb8-f5c8-47fd-a011-fa341af4423d" />
<img width="772" height="744" alt="Screenshot 2025-07-14 125137" src="https://github.com/user-attachments/assets/d5d71776-1e4b-4674-b82a-0e0e6efd74ff" />
