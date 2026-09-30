import { db, collection, getDocs, setDoc, doc } from "../firebase.js";

export function initHelpEngine(currentUser) {
    // 1. Configuration
    const ownerEmail = 'akshat124.am12@gmail.com';
    
    // 2. DOM Elements Mapping
    const helpBtn = document.getElementById('navHelpBtn');
    const ownerBtn = document.getElementById('ownerPanelBtn');
    const helpModal = document.getElementById('helpModal');
    const ownerModal = document.getElementById('ownerModal');
    const helpForm = document.getElementById('helpForm');
    const complaintsList = document.getElementById('complaintsList');

    const closeHelpBtn = document.getElementById('closeHelpBtn');
    const closeOwnerBtn = document.getElementById('closeOwnerBtn');

    // 3. Owner Authentication & Dashboard Access
    if (currentUser && currentUser.email === ownerEmail) {
        if (ownerBtn) ownerBtn.style.display = 'flex'; 
        
        ownerBtn.addEventListener('click', async () => {
            ownerModal.style.display = 'block';
            await fetchAndRenderComplaints();
        });
    }

    // 4. Modals Logic
    if (helpBtn) helpBtn.addEventListener('click', () => helpModal.style.display = 'block');
    if (closeHelpBtn) closeHelpBtn.addEventListener('click', () => helpModal.style.display = 'none');
    if (closeOwnerBtn) closeOwnerBtn.addEventListener('click', () => ownerModal.style.display = 'none');

    window.addEventListener('click', (e) => {
        if (e.target === helpModal) helpModal.style.display = 'none';
        if (e.target === ownerModal) ownerModal.style.display = 'none';
    });

    // 5. Help Form Submission Logic
    if (helpForm) {
        helpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const subject = document.getElementById('helpSubject').value;
            const details = document.getElementById('helpDetails').value;
            const timestamp = Date.now(); 
            
            const complaintPayload = {
                name: currentUser?.name || 'Anonymous User',
                email: currentUser?.email || 'No email provided',
                subject: subject,
                details: details,
                date: timestamp,
                status: 'Unresolved'
            };

            const submitBtn = helpForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            try {
                // Using setDoc instead of addDoc to match your existing firebase.js exports
                const newTicketId = `ticket_${timestamp}`;
                await setDoc(doc(db, "help_complaints", newTicketId), complaintPayload);

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

    // 6. Owner Dashboard Rendering
    async function fetchAndRenderComplaints() {
        complaintsList.innerHTML = '<div class="loader">Loading secure database...</div>';
        
        try {
            // Using standard getDocs to bypass needing 'query' and 'orderBy' exports
            const snapshot = await getDocs(collection(db, "help_complaints"));
            complaintsList.innerHTML = ''; 
            
            if (snapshot.empty) {
                complaintsList.innerHTML = '<div class="empty-state">No complaints registered yet.</div>';
                return;
            }

            // Extract to array and sort by date descending using JavaScript
            const complaints = [];
            snapshot.forEach(docObj => complaints.push(docObj.data()));
            complaints.sort((a, b) => b.date - a.date);

            complaints.forEach((data) => {
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
