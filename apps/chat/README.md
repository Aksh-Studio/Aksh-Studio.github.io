# 💬 Aksh Chat Ecosystem (`aksh-chat-ecosystem/`)

A secure, real-time multimedia communication ecosystem built with React, WebRTC, and Firebase. This platform features end-to-end encrypted messaging, high-fidelity audio/video calling, client-side media optimization, and integrated AI-assisted utilities.

---

## 🏗️ Architecture Overview

The codebase uses a feature-based structure separating presentational components, application screens, external core services, and client-side processing utilities.

```text
chat/
├── public/                 # Static assets
│   ├── chat-logo.png       # Application brand icon
│   └── index.html          # Core DOM injection target
├── src/                    # Application source code
│   ├── assets/             # Icons, standard avatars, and notification chimes
│   ├── components/         # Atomic and reusable UI building blocks
│   │   ├── layout/         # Shell framing: Sidebars, dynamic modals, nav blocks
│   │   ├── chat/           # Reactive bubbles, dynamic fields, file menus
│   │   ├── calls/          # Stream panels, PiP canvas overlays, mute toggles
│   │   └── media/          # Lightbox view engines, voice note waveform runners
│   ├── pages/              # Routed view targets
│   │   ├── Auth.js         # Phone verification gateways, OTP verification, recovery
│   │   ├── ChatHub.js      # Main viewport orchestration engine
│   │   ├── Settings.js     # Client toggles (Privacy configurations, cache, themes)
│   │   └── Admin.js        # Moderation metrics and analytics panels
│   ├── services/           # The business logic orchestration layer
│   │   ├── authConfig.js   # Phone, OTP, and JWT token refresh layers
│   │   ├── firestore.js    # Document sync: /rooms/{id}/messages pipeline
│   │   ├── webrtc.js       # Mesh/SFU connection signals, ICE handshakes
│   │   └── aiAgent.js      # Context translation engines, predictive micro-replies
│   ├── utils/              # Pure utility functions
│   │   ├── encryption.js   # AES-GCM / E2EE cryptographic actions
│   │   ├── timeFormat.js   # Chronological displays, localization, last-seen parsing
│   │   └── mediaCompress.js# In-flight resolution degradation pipelines
│   ├── styles/             # Application visual foundations
│   │   ├── themes.css      # Custom property tokens (Light, Dark, High-Contrast)
│   │   └── mobile.css      # Viewport query structures for adaptive designs
│   └── App.js              # Application entry point, global context providers, routers
├── package.json            # Project manifest, operational scripts, dependencies
└── firebase.json           # Hosting configurations, indexing patterns, security definitions
```

---

## 🚀 Getting Started

### 1. Installation
Clone the repository and install the project dependencies:
```bash
cd aksh-chat-ecosystem
npm install
```

### 2. Environment Setup
Create a `.env` file in the root directory and populate your Firebase and API configurations:
```env
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_AI_GATEWAY_URL=your_llm_proxy_endpoint
```

### 3. Local Development Run
Spin up the hot-reloading development server:
```bash
npm start
```
The application will open automatically at `http://localhost:3000`.

---

## 🛠️ Engine Implementations & Core Mechanics

### 🔐 Security & Encryption (`utils/encryption.js`)
*   **End-to-End Encryption (E2EE)**: Messages are encrypted client-side before transmission using the AES-GCM standard.
*   **Key Exchange**: Unique cryptographic keys are established securely per room, ensuring that Firestore nodes handle only ciphertext payloads.

### 📞 Audio/Video Pipeline (`services/webrtc.js`)
*   **Signaling Engine**: Leverages Firestore collection streams (`/calls/{callId}/signaling`) to exchange SDP offers, answers, and ICE candidate parameters.
*   **Stream Optimization**: Monitors network bitrate drop-offs to adapt resolution metrics automatically, triggering Picture-in-Picture (PiP) mode gracefully when the viewport shifts.

### 📉 Smart Media Handling (`utils/mediaCompress.js`)
*   **Client-Side Processing**: Before uploading files to storage, raw images and video tracks pass through worker loops to reduce dimensions and adjust compression qualities. This reduces user bandwidth usage and lowers server storage costs.

### 🤖 AI Utilities (`services/aiAgent.js`)
*   **Smart Replies**: Evaluates the text content of incoming messages locally to generate immediate contextual reply chips.
*   **Inline Translation**: Connects directly with linguistic LLMs to translate message streams instantly across multiple languages.

---

## 📦 Deployment

### Firestore & Security Configuration
To deploy changes made to security parameters, rate limits, or deployment settings hosted inside `firebase.json`:
```bash
# Install Firebase CLI globally if you haven't already
npm install -g firebase-tools

# Authenticate and select your active project target
firebase login
firebase use --add

# Deploy security rules and configuration definitions
firebase deploy --only firestore:rules,hosting
```
