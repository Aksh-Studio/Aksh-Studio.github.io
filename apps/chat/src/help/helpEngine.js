import { db, collection, getDocs, setDoc, doc, deleteDoc } from "../firebase.js";

export function initHelpEngine(currentUser) {
    const ownerEmail = 'akshat124.am12@gmail.com';
    const isOwner = currentUser && String(currentUser.email).toLowerCase().trim() === ownerEmail;

    // Element references
    const helpBtn = document.getElementById('navHelpBtn');
    const ownerBtn = document.getElementById('ownerPanelBtn');
    const helpModal = document.getElementById('helpModal');
    const ownerModal = document.getElementById('ownerModal');
    const helpForm = document.getElementById('helpForm');
    const complaintsList = document.getElementById('complaintsList');

    const closeHelpBtn = document.getElementById('closeHelpBtn');
    const cancelHelpBtn = document.getElementById('cancelHelpBtn');
    const closeOwnerBtn = document.getElementById('closeOwnerBtn');

    // --- VISIBILITY PERMISSIONS ---
    if (isOwner) {
        // OWNER: Show red '?' button, hide user 'Help' button
        if (ownerBtn) ownerBtn.style.display = 'flex';
        if (helpBtn) helpBtn.style.display = 'none';

        ownerBtn.onclick = async (e) => {
            e.preventDefault();
            ownerModal.style.display = 'flex';
            await fetchAndRenderComplaints();
        };
    } else {
        // REGULAR USER: Show 'Help' button, hide '?' button
        if (ownerBtn) ownerBtn.style.display = 'none';
        if (helpBtn) helpBtn.style.display = 'inline-block';

        helpBtn.onclick = (e) => {
            e.preventDefault();
            helpModal.style.display = 'flex';
        };
    }

    // --- MODAL CLOSE LOGIC ---
    const hideHelp = () => { if (helpModal) helpModal.style.display = 'none'; };
    const hideOwner = () => { if (ownerModal) ownerModal.style.display = 'none'; };

    if (closeHelpBtn) closeHelpBtn.onclick = hideHelp;
    if (cancelHelpBtn) cancelHelpBtn.onclick = hideHelp;
    if (closeOwnerBtn) closeOwnerBtn.onclick = hideOwner;

    window.addEventListener('click', (e) => {
        if (e.target === helpModal) hideHelp();
        if (e.target === ownerModal) hideOwner();
    });

    // --- SUBMISSION LOGIC ---
    if (helpForm) {
        helpForm.onsubmit = async (e) => {
            e.preventDefault();

            const subjectInput = document.getElementById('helpSubject');
            const detailsInput = document.getElementById('helpDetails');
            const submitBtn = document.getElementById('submitHelpBtn');

            const timestamp = Date.now();
            const ticketId = `ticket_${timestamp}`;

            const complaintPayload = {
                name: currentUser?.name || 'Anonymous User',
                email: currentUser?.email || 'No email provided',
                subject: subjectInput.value.trim(),
                details: detailsInput.value.trim(),
                date: timestamp,
                status: 'Unresolved'
            };

            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            try {
                await setDoc(doc(db, "help_complaints", ticketId), complaintPayload);
                alert('Your request has been submitted. The owner will review it shortly.');
                helpForm.reset();
                hideHelp();
            } catch (error) {
                console.error("Error submitting ticket:", error);
                alert("Failed to submit request: " + error.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Ticket';
            }
        };
    }

    // --- OWNER COMPLAINTS FETCH & DELETE LOGIC ---
    async function fetchAndRenderComplaints() {
        if (!complaintsList) return;
        complaintsList.innerHTML = '<p style="text-align:center; color:var(--text-muted, #888); padding:30px 0;">Loading complaints...</p>';

        try {
            const snapshot = await getDocs(collection(db, "help_complaints"));
            complaintsList.innerHTML = '';

            if (snapshot.empty) {
                complaintsList.innerHTML = '<p style="text-align:center; color:var(--text-muted, #888); padding:40px 0;">No complaints registered yet.</p>';
                return;
            }

            const complaints = [];
            snapshot.forEach(docSnap => {
                complaints.push({ id: docSnap.id, ...docSnap.data() });
            });

            // Sort newest first
            complaints.sort((a, b) => (b.date || 0) - (a.date || 0));

            complaints.forEach((ticket) => {
                const displayDate = ticket.date ? new Date(ticket.date).toLocaleString() : 'Unknown date';
                const card = document.createElement('div');
                card.id = `card_${ticket.id}`;
                card.style.cssText = "background: var(--app-bg, #f9fafb); border: 1px solid var(--border, #e5e7eb); border-left: 4px solid #ea0038; border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 8px;";

                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                        <h4 style="margin:0; font-size:15px; font-weight:700; color:var(--text-main, #111); word-break:break-word;">${ticket.subject || 'No Subject'}</h4>
                        <span style="font-size:11px; color:var(--text-muted, #888); white-space:nowrap;">${displayDate}</span>
                    </div>
                    <div style="font-size:12px; color:var(--text-muted, #666); border-bottom:1px solid var(--border, #eee); padding-bottom:6px;">
                        <strong style="color:var(--text-main, #222);">${ticket.name || 'User'}</strong> &bull; ${ticket.email || 'No email'}
                    </div>
                    <div style="font-size:13px; color:var(--text-main, #333); line-height:1.5; white-space:pre-wrap; word-break:break-word;">${ticket.details || ''}</div>
                    <div style="display:flex; justify-content:flex-end; margin-top:4px;">
                        <button class="delete-complaint-btn" data-id="${ticket.id}" style="display:inline-flex; align-items:center; gap:4px; padding:6px 12px; background:#ea0038; color:white; border:none; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">
                            <span class="material-symbols-rounded" style="font-size:16px;">delete</span> Delete
                        </button>
                    </div>
                `;

                // Handle delete action
                const delBtn = card.querySelector('.delete-complaint-btn');
                delBtn.onclick = async () => {
                    if (!confirm(`Are you sure you want to delete this complaint from "${ticket.name}"?`)) return;

                    delBtn.disabled = true;
                    delBtn.textContent = 'Deleting...';

                    try {
                        await deleteDoc(doc(db, "help_complaints", ticket.id));
                        card.remove();
                        if (complaintsList.children.length === 0) {
                            complaintsList.innerHTML = '<p style="text-align:center; color:var(--text-muted, #888); padding:40px 0;">No complaints registered yet.</p>';
                        }
                    } catch (err) {
                        console.error("Delete error:", err);
                        alert("Could not delete complaint: " + err.message);
                        delBtn.disabled = false;
                        delBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size:16px;">delete</span> Delete';
                    }
                };

                complaintsList.appendChild(card);
            });
        } catch (error) {
            console.error("Error retrieving complaints:", error);
            complaintsList.innerHTML = `<p style="text-align:center; color:#ea0038; padding:30px 0;">Error loading complaints: ${error.message}</p>`;
        }
    }
}
