import { collection, addDoc, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase.js"; // Assumes your initialized Firestore instance is exported as 'db'

export function initHelpEngine(currentUser) {
    // 1. Configuration & Security
    const ownerEmail = 'akshat124.am12@gmail.com';
    
    // 2. DOM Elements Mapping
    const helpBtn = document.getElementById('navHelpBtn');
    const ownerBtn = document.getElementById('ownerPanelBtn');
    const helpModal = document.getElementById('helpModal');
    const ownerModal = document.getElementById('ownerModal');
    const helpForm = document.getElementById('helpForm');
    const complaintsList = document.getElementById('complaintsList');

    // Modal Close Buttons
    const closeHelpBtn = document.getElementById('closeHelpBtn');
    const closeOwnerBtn = document.getElementById('closeOwnerBtn');

    // 3. Owner Authentication & Dashboard Access
    if (currentUser && currentUser.email === ownerEmail) {
        if (ownerBtn) ownerBtn.style.display = 'flex'; // Reveal the hidden "?" button
        
        ownerBtn.addEventListener('click', async () => {
            ownerModal.style.display = 'block';
            await fetchAndRenderComplaints();
        });
    }

    // 4. Help Form Modal Triggers
    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            helpModal.style.display = 'block';
        });
    }

    if (closeHelpBtn) closeHelpBtn.addEventListener('click', () => helpModal.style.display = 'none');
    if (closeOwnerBtn) closeOwnerBtn.addEventListener('click', () => ownerModal.style.display = 'none');

    // Close modals if clicking outside the content area
    window.addEventListener('click', (e) => {
        if (e.target === helpModal) helpModal.style.display = 'none';
        if (e.target === ownerModal) ownerModal.style.display = 'none';
    });

    // 5. Help Form Submission Logic
    if (helpForm) {
        helpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Extract UI values
            const subject = document.getElementById('helpSubject').value;
            const details = document.getElementById('helpDetails').value;
            
            // Auto-inject hidden data
            const timestamp = new Date().toISOString();
            const userName = currentUser.displayName || 'Anonymous User';
            const userEmail = currentUser.email || 'No email provided';

            const complaintPayload = {
                name: userName,
                email: userEmail,
                subject: subject,
                details: details,
                date: timestamp,
                status: 'Unresolved'
            };

            // Disable submit button during processing to prevent spam
            const submitBtn = helpForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            try {
                // A. Save to Dedicated 'help_complaints' Database Collection
                const complaintsRef = collection(db, "help_complaints");
                await addDoc(complaintsRef, complaintPayload);

                // B. Route Notification to Owner in the Chat App
                await dispatchChatNotification(complaintPayload, ownerEmail);

                alert('Your request has been securely submitted. Our team will look into it.');
                helpForm.reset();
                helpModal.style.display = 'none';
            } catch (error) {
                console.error("Error submitting help request: ", error);
                alert('Connection error. Please try submitting again.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit';
            }
        });
    }

    // 6. Internal Functions: Chat Routing & Dashboard Rendering

    async function dispatchChatNotification(data, targetEmail) {
        /* 
           Injects a direct message into your primary chat database.
           Modify "messages" below if your chat collection has a different name (e.g., "chats" or "global_chat").
        */
        const chatRef = collection(db, "messages");
        
        const systemMessage = {
            senderId: 'SYSTEM_BOT',
            senderName: 'Help Center Alert',
            receiverEmail: targetEmail, // Used to filter messages meant only for you
            text: `🔔 NEW TICKET\nFrom: ${data.name} (${data.email})\nSubject: ${data.subject}\n\nDetails: ${data.details}`,
            timestamp: Date.now(),
            type: 'system_alert'
        };

        await addDoc(chatRef, systemMessage);
    }

    async function fetchAndRenderComplaints() {
        complaintsList.innerHTML = '<div class="loader">Loading secure database...</div>';
        
        try {
            const complaintsRef = collection(db, "help_complaints");
            // Query sorting by date (newest first)
            const q = query(complaintsRef, orderBy("date", "desc"));
            const snapshot = await getDocs(q);
            
            complaintsList.innerHTML = ''; 
            
            if (snapshot.empty) {
                complaintsList.innerHTML = '<div class="empty-state">No complaints registered yet.</div>';
                return;
            }

            snapshot.forEach((doc) => {
                const data = doc.data();
                const displayDate = new Date(data.date).toLocaleString();
                
                const card = document.createElement('div');
                card.className = 'complaint-card';
                card.innerHTML = `
                    <div class="complaint-header">
                        <h4>${data.subject}</h4>
                        <span class="complaint-date">${displayDate}</span>
                    </div>
                    <div class="complaint-user">
                        <strong>${data.name}</strong> &lt;${data.email}&gt;
                    </div>
                    <div class="complaint-body">
                        ${data.details}
                    </div>
                `;
                complaintsList.appendChild(card);
            });
        } catch (error) {
            console.error("Error retrieving complaints:", error);
            complaintsList.innerHTML = '<div class="error-state">Failed to load complaints. Verify Firestore indexing and permissions.</div>';
        }
    }
}
