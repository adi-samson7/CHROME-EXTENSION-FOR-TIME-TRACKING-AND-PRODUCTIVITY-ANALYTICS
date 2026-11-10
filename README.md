CHROME EXTENSION FOR TIME TRACKING AND PRODUCTIVITY ANALYTICS - PRODUCTIVITY TRACKER

COMPANY: CODTECH IT SOLUTIONS

NAME: Aditya Samson

INTERN ID: CT08DL961

DOMAIN: FULL STACK WEB DEVELOPMENT

BATCH DURATION: May 20th, 2025 to July 20th, 2025

MENTOR NAME : NEELA SANTHOSH KUMAR

DESCRIPTION OF TASK PERFORMED :

This task involved the development of a Chrome Extension that tracks the amount of time a user spends on various websites in real-time. 
The primary goal was to create a system that operates seamlessly in the background, capturing and storing browsing behavior while providing useful visual insights and analytics on a dashboard.


<img width="1920" height="1080" alt="Screenshot (255)" src="https://github.com/user-attachments/assets/472287f0-a754-428a-8539-1f5d6abbc076" />
<img width="1119" height="890" alt="Screenshot 2025-07-14 125230" src="https://github.com/user-attachments/assets/a70b57fd-5221-44d9-a7e8-f88b2d86b297" />

OBJECTIVES:

Build a Chrome Extension that automatically starts tracking time spent on each website.

Ensure that time is tracked accurately and continuously while the tab is active.

Store all tracked data locally in the browser (chrome.storage.local) - no server or account needed, nothing leaves the user's computer.

Display live tracked time in the extension popup.

Show historical analytics and productivity insights in a separate dashboard (dashboard.html).

Allow classification of websites as productive or unproductive.

Ensure the system is resilient, minimal, and user-friendly.

Key Features Implemented:

1. Real-Time Timer & Tracking Logic

A background script constantly monitors the currently active tab.

Once a website is opened or switched to, a timer starts automatically.

If the tab is changed, closed, or the user becomes inactive, the timer stops.

Time is saved locally in chrome.storage.local, so it survives browser restarts.

A flush mechanism ensures no time is lost during popup close or extension shutdown.

2. Popup UI :

Displays the hostname of the active site.

Shows the live timer updating every second.

Timer values come from the locally stored data (ensures consistency and avoids rewind bugs).

Saves time locally as you browse.

3. Local Storage:

All data is stored locally on the user's computer; there is no backend server.

Time entries are grouped by date and website in chrome.storage.local (with the unlimitedStorage permission), and can be exported / restored as a JSON backup from the Settings page.

4. Analytics Dashboard:

Visual representation of time spent using Pie Charts and Daily/Weekly reports.

Calendar component allows users to pick a date and see a breakdown of time tracked on that day.

Productive vs Unproductive time is shown for each day.

5. Persistent Storage:

Uses chrome.storage.local (time data) and chrome.storage.sync (classifications and goals).

Analytics and reports are computed in the extension from the locally stored data.

Technical Stack:

Frontend (Extension UI):

HTML, CSS, Vanilla JavaScript

Chrome Extension APIs (chrome.tabs, chrome.runtime, chrome.storage)

Chart.js for visual analytics

Storage:

chrome.storage.local / sync / session (no backend)

Data Flow:

Real-time timer in popup script

Background script monitors tab activity

Background script saves usage data to chrome.storage.local

Analytics page reads the local data and renders charts

Final Outcome
This task resulted in a fully functioning Chrome Extension that:

Accurately tracks time spent per site.

Displays a live-updating timer.

Stores all tracked data locally and privately on the user's computer.

Offers a visual analytics dashboard with productivity breakdowns.

This lays the foundation for future features such as classification management, user authentication, long-term productivity reports, and exporting usage summaries.

OUTPUT:

<img width="590" height="817" alt="Screenshot 2025-07-14 125641" src="https://github.com/user-attachments/assets/5a856d9f-124c-40a4-a387-fcf10c47bba3" />
<img width="1920" height="1080" alt="Screenshot (255)" src="https://github.com/user-attachments/assets/e2555d88-9986-42cf-b732-33c57611f8fa" />
<img width="1119" height="890" alt="Screenshot 2025-07-14 125230" src="https://github.com/user-attachments/assets/79f972d6-e758-461e-aabf-7a963c9d7fef" />
<img width="1183" height="888" alt="Screenshot 2025-07-19 210000" src="https://github.com/user-attachments/assets/2f3d0bb8-f5c8-47fd-a011-fa341af4423d" />
<img width="772" height="744" alt="Screenshot 2025-07-14 125137" src="https://github.com/user-attachments/assets/d5d71776-1e4b-4674-b82a-0e0e6efd74ff" />
