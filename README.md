# GAINZ

### Personalized Workout & Diet Planner with AI

GAINZ is a personalized fitness planning web application designed to help students create workout and meal plans based on their individual goals, lifestyle, available equipment, dietary preferences, culture, and budget.

The project combines a rule-based fitness planning system with AI-powered recommendations to make the generated plans more personalized and practical.

---

## 🎯 Problem Statement

Most fitness applications provide generic workout and diet plans that do not always consider an individual's:

- Fitness goals
- Activity level
- Available training days
- Available equipment
- Dietary preferences
- Cultural food habits
- Food budget
- Personal requirements

Students in particular may need fitness plans that are practical, affordable, and compatible with their daily schedules.

GAINZ aims to address this by generating personalized workout and meal plans based on the user's profile and preferences.

---

## ✨ Features

### 👤 Personalized Profile

Users can provide information such as:

- Name
- Age
- Gender
- Height
- Weight
- Fitness goal
- Activity level
- Training days per week
- Available equipment

### 🏋️ Workout Planning

GAINZ generates workout plans based on:

- Fitness goal
- Activity level
- Training frequency
- Available equipment

### 🍱 Personalized Diet Planning

The meal planning system considers:

- Food/cultural preference
- Dietary restrictions
- Weekly food budget
- Fitness goal

### 📊 Progress Tracking

Users can record:

- Date
- Weight
- Progress notes

GAINZ also provides progress visualization and streak tracking.

### 🤖 AI-Powered Assistance

GAINZ includes an AI-powered assistant that can help users:

- Ask questions about their workout
- Replace exercises
- Make workouts easier
- Suggest meal alternatives
- Ask about their progress

### 💡 AI Insights

After generating a plan, users can access additional insights based on their personalized fitness information.

### 🌙 Dark / Light Theme

GAINZ includes a theme switcher for dark and light modes.

### 📱 Responsive Design

The interface is designed to work across desktop and mobile screen sizes, with mobile navigation for smaller devices.

---

## 🛠️ Technologies Used

- HTML5
- CSS3
- JavaScript
- Node.js
- Gemini API
- LocalStorage

---

## 🧠 How GAINZ Works

```text
User Profile
     ↓
Fitness Goals
     ↓
Activity & Schedule
     ↓
Food & Dietary Preferences
     ↓
Profile Review
     ↓
Generate Personalized Plan
     ↓
┌───────────────┬───────────────┐
│ Workout Plan  │   Meal Plan   │
└───────────────┴───────────────┘
          ↓
   Progress Tracking
          ↓
     AI Assistance
```

The application collects the user's profile through a four-step setup process covering profile information, activity and schedule, food preferences, and final review before generating the plan.

---

## 📁 Project Structure

```text
GAINZ/
│
├── ai-engine.js       # Fitness planning and AI-related logic
├── app.js             # Main application logic and UI interactions
├── index.html         # Application interface
├── server.js          # Local Node.js server and API routes
├── style.css          # Application styling and responsive layout
├── package.json       # Node.js project configuration
│
├── .env.example       # Environment variable template
├── .gitignore         # Files excluded from Git
└── README.md          # Project documentation
```

---

## 🚀 Running GAINZ Locally

### 1. Clone the repository

```bash
git clone https://github.com/vishal-singh-62/GAINZ.git
```

### 2. Open the project

```bash
cd GAINZ
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure the environment

Create a `.env` file in the project root.

Use `.env.example` as a reference.

```env
GEMINI_API_KEY=your_api_key_here
```

**Never upload your `.env` file or API key to GitHub.**

### 5. Start the server

```bash
node server.js
```

The application will run locally at:

```text
http://localhost:3000
```

---

## 🔐 Environment Variables

GAINZ requires an API key for its AI-powered features.

The API key should be stored locally in `.env`.

The `.env` file is excluded from Git through `.gitignore`.

For other developers, `.env.example` provides the required environment variable format without exposing a secret.

---

## 📱 Main Sections

| Section | Purpose |
|---|---|
| Planner | Create and review a personalized fitness profile |
| Workout | View the generated workout plan |
| Diet Plan | View the personalized meal plan |
| Progress | Track weight and progress |
| AI Coach | Ask questions and receive fitness-related assistance |
| Insights | View additional information based on the generated plan |

---

## 🎓 Project Purpose

GAINZ was developed as an academic and internship project to explore the development of a personalized fitness application using web technologies and artificial intelligence.

The project focuses on combining personalization, fitness planning, nutrition planning, progress tracking, and AI-assisted recommendations into a single application.

---

## 🔮 Future Improvements

Planned improvements include:

- User accounts and authentication
- Google Sign-In
- Phone-number authentication
- Cloud-based user profiles
- Synchronization across devices
- Improved progress analytics
- Workout history
- Saved meal plans
- More personalized AI recommendations
- Additional fitness and nutrition features

---

## ⚠️ Disclaimer

GAINZ provides informational fitness and nutrition suggestions and is not a substitute for professional medical, fitness, or nutritional advice.

Users with injuries, medical conditions, or specific nutritional requirements should consult an appropriately qualified professional.

---

## 👨‍💻 Author

**Vishal Singh**

GitHub: https://github.com/vishal-singh-62

---

## 📄 License

This project currently does not use an open-source license.
