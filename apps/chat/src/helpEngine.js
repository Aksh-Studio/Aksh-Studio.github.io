// apps/chat/src/helpEngine.js

import { db } from './firebase.js'; // Ensure this path matches your project structure
import { collection, addDoc, getDocs, query, orderBy } from "firebase/firestore"; // Using Firestore v9 syntax. Adapt to v8 or Realtime DB if necessary.

const OWNER_EMAIL = "akshat124.am12@gmail.com";

export function initHelpEngine(currentUser) {
    if (!currentUser) return;

    // UI Elements
    const helpBtn = document.getElementById('helpBtn');
    const ownerPanelBtn = document.getElementById('ownerPanelBtn');
    const helpModal = document.getElementById('helpModal');
    const ownerModal = document.getElementById('ownerModal');
    const helpForm = document.getElementById('helpForm');
    const closeHelpBtn = document.getElementById('closeHelpBtn');
    const closeOwnerBtn = document.getElementById('closeOwnerBtn');

    // 1. Owner Verification: Reveal the secret '?' button
    if (currentUser.email === OWNER_EMAIL) {
        ownerPanelBtn.style.display = 'block';
    }

    // 2. Event Listeners for Opening/Closing Modals
    helpBtn.addEventListener('click', () => {
        helpModal.style.display = 'flex';
    });

    closeHelpBtn.addEventListener('click', () => {
        helpModal.style.display = 'none';
        helpForm.reset();
    });

    ownerPanelBtn.addEventListener('click', async () => {
        ownerModal.style.display = 'flex';
        await loadComplaints();
    });

    closeOwnerBtn.addEventListener('click', () => {
        ownerModal.style.display = 'none';
    });

    // Close modals if clicking outside the content box
    window.addEventListener('click', (e) => {
        if (e.target === helpModal) helpModal.style.display = 'none';
        if (e.target === ownerModal) ownerModal.style.display = 'none';
    });

    // 3. Handle Form Submission
    helpForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const subject = document.getElementById('helpSubject').value;
        const details = document.getElementById('helpDetails').value;
        const submitBtn = document.getElementById('submitHelpBtn');

        submitBtn.disabled = true;
        submitBtn.innerText = "Submitting...";

        // Construct the payload with auto-captured user data and timestamp
        const complaintData = {
            name: currentUser.displayName || "Unknown User",
            email: currentUser.email,
            subject: subject,
            details: details,
            date: new Date().toISOString(),
            timestamp: Date.now() 
        };

        try {
            // Save complaint to a dedicated 'help_complaints' database collection
            await addDoc(collection(db, "help_complaints"), complaintData);

            // Send an automated direct chat message to the Owner
            // Assuming you have a 'messages' collection handling chat
            await addDoc(collection(db, "messages"), {
                text: `🛑 SYSTEM ALERT: New Help Request\nFrom: ${complaintData.name}\nSubject: ${complaintData.subject}\nDetails: ${complaintData.details}`,
                senderName: "Help Center System",
                senderEmail: "system@aksh-studio.com",
                receiverEmail: OWNER_EMAIL,
                timestamp: Date.now()
            });

            alert("Your complaint has been successfully submitted to the Aksh Help Centre.");
            helpForm.reset();
            helpModal.style.display = 'none';
        } catch (error) {
            console.error("Error submitting complaint:", error);
            alert("Failed to submit. Please check your connection and try again.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = "Submit";
        }
    });
}

// 4. Fetch and Display Complaints for the Owner
async function loadComplaints() {
    const complaintsList = document.getElementById('complaintsList');
    complaintsList.innerHTML = "<p class='loading-text'>Loading complaints...</p>";

    try {
        const q = query(collection(db, "help_complaints"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        
        let html = "";
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const formattedDate = new Date(data.date).toLocaleString();
            
            html += `
                <div class="complaint-card">
                    <div class="complaint-header">
                        <h4>${data.subject}</h4>
                        <span class="complaint-date">${formattedDate}</span>
                    </div>
                    <p class="complaint-sender"><strong>From:</strong> ${data.name} (<a href="mailto:${data.email}">${data.email}</a>)</p>
                    <p class="complaint-details">${data.details}</p>
                </div>
            `;
        });

        complaintsList.innerHTML = html || "<p class='empty-text'>No complaints found. Everything is running smoothly!</p>";
    } catch (error) {
        console.error("Error loading complaints:", error);
        complaintsList.innerHTML = "<p class='error-text'>Error loading data. Check console for details.</p>";
    }
}
