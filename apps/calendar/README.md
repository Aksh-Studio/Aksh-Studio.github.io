apps/calendar/
│
├── index.html                        # The core entry point housing the UI shell and modal definitions
├── style.css                         # Master stylesheet containing layouts, light/dark themes, and animations
├── app.js                            # Main coordinator orchestration file (Imports modules & runs core initialization)
│
└── modules/                          # Logic broken down into independent functional modules
    ├── auth.js                       # Syncs current Firebase user token, protects routes, and initializes folder scope
    ├── db.js                         # Firebase Firestore interface (CRUD operations for Events, Tasks, and Settings)
    ├── state.js                      # Core app state manager (Holds current view, selected date, active calendars)
    │
    ├── views/                        # Engine logic handling the different render grids
    │   ├── dayView.js                # Hour-by-hour scheduling block rendering logic
    │   ├── weekView.js               # 7-column time-blocked matrix grid layout engine
    │   ├── monthView.js              # Standard 6-row calendar grid with mini event banners
    │   ├── yearView.js               # Compact 12-month calendar index renderer
    │   └── agendaView.js             # List layout sorting active items sequentially by date
    │
    ├── components/                   # Interactive UI layers and modal handlings
    │   ├── eventModal.js             # Form handling for creating/editing events, repeats, and Meet generation
    │   ├── taskManager.js            # Sidebar workflow tracking checkable tasks with deadline bindings
    │   ├── appointmentSlots.js       # Core scheduler setup allowing generation of booking links
    │   └── insightsPanel.js          # Chart generation breaking down Focus Time vs Meeting statistics
    │
    ├── helpers/                      # Native background algorithms
    │   ├── timezone.js               # Real-time conversions and dual-timezone column builders
    │   ├── recurrence.js             # Mathematical generator parsing daily, weekly, monthly, and custom loops
    │   └── importExport.js           # Parsers converting .ics / .csv files directly into Firestore payloads
    │
    └── shortcuts.js                  # Global event listener intercepting keyboard navigation binds
