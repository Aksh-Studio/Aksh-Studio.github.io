import { db, collection, getDocs, setDoc, doc } from "../firebase.js";

export function initHelpEngine(currentUser) {
    const ownerEmail = 'akshat124.am12@gmail.com';
    
    const helpBtn = document.getElementById('navHelpBtn');
    const ownerBtn = document.getElementById('ownerPanelBtn');
    const helpModal = document.getElementById('helpModal');
    const ownerModal = document.getElementById('ownerModal');
    const helpForm = document.getElementById('helpForm');
    const complaintsList = document.getElementById('complaintsList');

    const closeHelpBtn = document.getElementById('closeHelpBtn');
    const closeOwnerBtn = document.getElementById('closeOwnerBtn');

    // --- AUTO-STYLE THE OWNER BUTTON ---
    // This guarantees the button floats beautifully on the bottom right, even if HTML CSS is missing
    if (ownerBtn) {
        ownerBtn.style.cssText = "display: none; position: fixed; bottom: 25px; right: 25px; width: 50px; height: 50px; background-color: #ef4444; color: white; border-radius: 50%; border: none; font-size: 24px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4); z-index: 10000; align-items: center; justify-content: center;";
    }

    // --- ROLE-BASED VISIBILITY ---
    if (currentUser && currentUser.email === ownerEmail) {
        if (ownerBtn) ownerBtn.style.display = 'flex'; 
        if (helpBtn) helpBtn.style.display = 'none'; 
        
        ownerBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            ownerModal.style.display = 'flex'; 
            await fetchAndRenderComplaints();
        });
    } else {
        if (ownerBtn) ownerBtn.style.display = 'none'; 
        if (helpBtn) helpBtn.style.display = 'inline-block'; 
        
        helpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            helpModal.style.display = 'flex'; 
        });
    }

    // --- MODAL CLOSE LOGIC ---
    if (closeHelpBtn) closeHelpBtn.addEventListener('click', () => helpModal.style.display = 'none');
    if (closeOwnerBtn) closeOwnerBtn.addEventListener('click', () => ownerModal.style.display = 'none');

    window.addEventListener('click', (e) => {
        if (e.target === helpModal) helpModal.style.display = 'none';
        if (e.target === ownerModal) ownerModal.style.display = 'none';
    });

    // --- FORM SUBMISSION ---
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
                submitBtn.textContent = 'Submit Ticket';
            }
        });
    }

    // --- OWNER DASHBOARD ---
    async function fetchAndRenderComplaints() {
        complaintsList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Loading secure database...</p>';
        
        try {
            const snapshot = await getDocs(collection(db, "help_complaints"));
            complaintsList.innerHTML = ''; 
            
            if (snapshot.empty) {
                complaintsList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No complaints registered yet.</p>';
                return;
            }

            const complaints = [];
            snapshot.forEach(docObj => complaints.push(docObj.data()));
            complaints.sort((a, b) => b.date - a.date);

            complaints.forEach((data) => {
                const displayDate = new Date(data.date).toLocaleString();
                const card = document.createElement('div');
                card.style.cssText = "background: var(--app-bg); border-left: 4px solid #ef4444; padding: 15px; border-radius: 8px; border: 1px solid var(--border);";
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <h4 style="margin: 0; color: var(--text-main); font-size: 15px;">${data.subject}</h4>
                        <span style="font-size: 11px; color: var(--text-muted);">${displayDate}</span>
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--border);">
                        <strong style="color: var(--text-main);">${data.name}</strong> &lt;${data.email}&gt;
                    </div>
                    <div style="font-size: 14px; color: var(--text-main); white-space: pre-wrap; line-height: 1.4;">${data.details}</div>
                `;
                complaintsList.appendChild(card);
            });
        } catch (error) {
            console.error("Error retrieving complaints:", error);
            complaintsList.innerHTML = '<p style="text-align: center; color: #ef4444;">Failed to load complaints. Verify Firestore permissions.</p>';
        }
    }
}
