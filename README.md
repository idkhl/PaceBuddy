# 🏃 PaceBuddy

PaceBuddy is an AI-powered running coach that connects to your Strava account to generate hyper-personalized training plans based on your actual running history, heart rate zones, and fitness level.

## ✨ Features

- **Strava Integration**: Authenticates securely with Strava to fetch your recent runs, pacing, and heart rate zones.
- **AI Training Plans**: Uses Google's Gemini API to generate smart, week-by-week training plans tailored to your specific goals and race dates.
- **Race Pace Calculator**: Includes a built-in calculator utilizing Riegel's formula to predict your finish time based on recent best efforts.
- **Neo-Brutalist Theming**: A bold, fully customizable UI. You can change the entire color scheme of the app just by editing 5 hex codes.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Framer Motion, Lucide Icons
- **Backend**: Express (Node.js) for handling Strava OAuth and API routes
- **AI**: `@google/genai` (Gemini Flash)

## 🚀 Getting Started (Local Development)

### 1. Prerequisites
- [Node.js](https://nodejs.org/) installed on your machine.
- A **Google Gemini API Key** (Get one [here](https://aistudio.google.com/)).
- A **Strava API Application** (Create one [here](https://www.strava.com/settings/api)).
  - *Important*: Set the **Authorization Callback Domain** to `localhost`.

### 2. Installation
Clone or download the project, then install the dependencies:
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory (you can copy `.env.example`) and fill in your credentials:

```env
GEMINI_API_KEY="your_gemini_api_key_here"
STRAVA_CLIENT_ID="your_strava_client_id"
STRAVA_CLIENT_SECRET="your_strava_client_secret"
```

### 4. Run the App
Start the local development server:
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000`.

## 🎨 Customizing the Theme

PaceBuddy uses a dynamic CSS variable system. You can completely change the look and feel of the app by modifying the `:root` variables in `src/index.css`:

```css
:root {
    --background-color: #F8F5E6;     /* Main background */
    --secondary-color: #C7E7FE;      /* Badges, decorative icons */
    --primary-color: #FF661F;        /* Main buttons and accents */
    --primary-hover-color: #702720;  /* Button hover states */
    --text-and-borders-color: #26422B; /* Text, brutalist borders, and shadows */
}
```
All Tailwind classes (`bg-primary`, `text-foreground`, `shadow-brutal-xl`) will automatically adapt to your new colors!

## 📜 License
MIT
# PaceBuddy
