import { db, doc, collection, addDoc, getDocs, deleteDoc, query, orderBy } from '../firebase.js';

export function initHelpEngine(currentUser) {
    const helpBtn = document.getElementById('navHelpBtn');
    const helpModal = document.getElementById('helpModal');
    const closeHelp = document.querySelector('.close-help');
    const submitBtn = document.getElementById('submit-ticket-btn');

    if (helpBtn && helpModal) {
        helpBtn.onclick = () => {
            helpModal.style.display = 'flex';
        };
    }

    if (closeHelp && helpModal) {
        closeHelp.onclick = () => {
            helpModal.style.display = 'none';
        };
    }

    if (submitBtn) {
        submitBtn.onclick = async () => {
            const issueInput = document.getElementById('ticket-issue-input');
            const issueText = issueInput ? issueInput.value.trim() : '';
            
            if (!issueText) {
                alert("Please describe your issue.");
                return;
            }

            try {
                await addDoc(collection(db, 'help_complaints'), {
                    userId: currentUser.uid || currentUser.id,
                    userEmail: currentUser.email,
                    name: currentUser.name || currentUser.displayName || 'User',
                    issue: issueText,
                    timestamp: Date.now(),
                    status: 'open'
                });
                
                alert("Support ticket submitted successfully.");
                if (issueInput) issueInput.value = '';
                if (helpModal) helpModal.style.display = 'none';
            } catch (error) {
                console.error("Error submitting ticket", error);
                alert("Failed to submit ticket.");
            }
        };
    }

    const ownerBtn = document.getElementById('ownerPanelBtn');
    const ownerModal = document.getElementById('ownerModal');
    const closeOwner = document.querySelector('.close-owner');

    if (ownerBtn && ownerModal) {
        ownerBtn.onclick = async () => {
            ownerModal.style.display = 'flex';
            await loadOwnerDashboard();
        };
    }

    if (closeOwner && ownerModal) {
        closeOwner.onclick = () => {
            ownerModal.style.display = 'none';
        };
    }
}

async function loadOwnerDashboard() {
    const container = document.getElementById('ticket-container');
    if (!container) return;
    
    container.innerHTML = '<p>Loading tickets...</p>';
    
    try {
        const q = query(collection(db, 'help_complaints'), orderBy('timestamp', 'desc'));
        const snap = await getDocs(q);
        
        container.innerHTML = '';
        
        if (snap.empty) {
            container.innerHTML = '<p>No tickets found.</p>';
            return;
        }

        snap.forEach(ticketDoc => {
            const data = ticketDoc.data();
            const el = document.createElement('div');
            el.className = 'ticket';
            el.style.border = '1px solid #ddd';
            el.style.margin = '10px 0';
            el.style.padding = '10px';
            el.style.borderRadius = '5px';
            
            const timeStr = new Date(data.timestamp || Date.now()).toLocaleString();
            
            el.innerHTML = `
                <p><strong>From:</strong> ${data.name} (${data.userEmail || data.userId})</p>
                <p><strong>Date:</strong> ${timeStr}</p>
                <p><strong>Issue:</strong> ${data.issue || data.details || 'N/A'}</p>
                <p><strong>Status:</strong> ${data.status}</p>
                <button class="resolve-btn" data-id="${ticketDoc.id}" style="background:var(--primary);color:white;border:none;padding:5px 10px;cursor:pointer;border-radius:3px;">Resolve & Delete</button>
            `;
            container.appendChild(el);
        });
        
        document.querySelectorAll('.resolve-btn').forEach(btn => {
            btn.onclick = async (e) => {
                const id = e.target.getAttribute('data-id');
                if (confirm("Resolve and delete this ticket?")) {
                    try {
                        await deleteDoc(doc(db, 'help_complaints', id));
                        e.target.parentElement.remove();
                        if (container.children.length === 0) {
                            container.innerHTML = '<p>No tickets found.</p>';
                        }
                    } catch (err) {
                        console.error(err);
                        alert("Failed to delete ticket. You might not have permission.");
                    }
                }
            };
        });
    } catch (error) {
        console.error('Error loading tickets', error);
        container.innerHTML = '<p>Error loading tickets.</p>';
    }
}
