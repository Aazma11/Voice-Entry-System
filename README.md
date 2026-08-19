# 🎓 EduVoice — Smart Attendance & Voice Mark Entry System

EduVoice is a full-stack web application designed to simplify **student attendance and marks management** using face verification, location-based validation, and voice input.

🌐 **Live Demo:** https://voice-entry-system.onrender.com/

## ✨ Features

### 👤 Face Verification

* Verifies the user's face before allowing attendance/marks entry.
* Helps prevent unauthorized attendance marking.

### 📍 GPS-Based Attendance

* Uses the user's location to verify whether they are within the allowed area.
* Prevents attendance from being marked outside the permitted location.

### 🎤 Voice-Based Marks Entry

* Allows teachers to enter marks using voice commands.
* Reduces repetitive manual data entry.

### 🔐 Authentication

* Secure login and registration.
* JWT-based authentication.
* Protected application routes.

### 📊 Attendance & Marks Management

* View and manage student records.
* Record attendance and marks efficiently.
* Organized student information for easy access.

### 📁 Export Reports

* Export student data to **Excel (.xlsx)**.
* Generate downloadable **PDF reports**.

### 📱 Responsive Interface

* Designed for desktop and mobile screen sizes.
* Simple and user-friendly interface.

## 🛠️ Tech Stack

### Frontend

* React.js
* JavaScript
* HTML5
* CSS3
* face-api.js

### Backend

* Node.js
* Express.js
* REST APIs
* JWT Authentication

### Database

* MongoDB
* MongoDB Atlas

### APIs & Tools

* Web Speech API
* Geolocation API
* Excel generation
* PDF generation
* Render

## 📂 Project Structure

```text
EduVoice/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── assets/
│   │   └── App.js
│   └── package.json
│
├── backend/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── config/
│   ├── server.js
│   └── package.json
│
├── README.md
└── .gitignore
```

## 🔄 How It Works

1. **User Authentication** — Users log in securely using their credentials.
2. **Face Verification** — The application verifies the user's face.
3. **Location Verification** — GPS checks whether the user is within the permitted location.
4. **Attendance & Marks Entry** — Teachers record attendance and enter marks manually or using voice input.
5. **Data Storage** — Records are stored in MongoDB.
6. **Report Generation** — Attendance and marks can be exported as Excel or PDF files.

## 🎤 Voice Entry

The voice-entry feature allows teachers to enter marks using voice commands instead of manually entering every value.

This makes marks entry:

* Faster
* Easier
* Less repetitive
* More convenient

## 🔐 Security

The application includes:

* JWT-based authentication
* Protected API routes
* Authenticated sessions
* Location validation
* Face verification

## 🚀 Deployment

The application is deployed using **Render**.

**Live Demo:** https://voice-entry-system.onrender.com/
