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

