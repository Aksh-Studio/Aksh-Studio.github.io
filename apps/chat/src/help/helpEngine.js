import { db, auth, collection, query, orderBy, getDocs, deleteDoc, doc, addDoc } from '../firebase.js';

export function setupHelpEngine() {
    const submitBtn = document.getElementById('submit-ticket-btn');
    if (submitBtn) {
        submitBtn.onclick = submitTicket;
    }

    const uid = auth.currentUser?.email;
    if (uid === 'akshat124.am12@gmail.com') {
        setupOwnerDashboard();
    }
}

export async function submitTicket() {
    const issueText = document.getElementById('ticket-issue-input')?.value;
    const uid = auth.currentUser?.uid;
    
    if (!issueText || !uid) return;
    
    try {
        await addDoc(collection(db, 'help_complaints'), {
            userId: uid,
            userEmail: auth.currentUser.email,
            issue: issueText,
            timestamp: Date.now(),
            status: 'open'
        });
        alert('Support ticket submitted successfully.');
        document.getElementById('ticket-issue-input').value = '';
    } catch (error) {
        console.error('Error submitting ticket', error);
    }
}

export async function setupOwnerDashboard() {
    const modal = document.getElementById('ownerModal');
    if (!modal) return;
    modal.style.display = 'block';
    
    const container = document.getElementById('ticket-container');
    if (!container) return;
    
    try {
        const q = query(collection(db, 'help_complaints'), orderBy('timestamp', 'desc'));
        const snap = await getDocs(q);
        
        container.innerHTML = '';
        snap.forEach(ticketDoc => {
            const data = ticketDoc.data();
            const el = document.createElement('div');
            el.className = 'ticket';
            el.innerHTML = `
                <p><strong>From:</strong> ${data.userEmail || data.reporterId}</p>
                <p><strong>Issue:</strong> ${data.issue || 'Reported user'}</p>
                <p><strong>Status:</strong> ${data.status}</p>
                <button class="resolve-btn" data-id="${ticketDoc.id}">Delete / Resolve</button>
            `;
            container.appendChild(el);
        });
        
        document.querySelectorAll('.resolve-btn').forEach(btn => {
            btn.onclick = async (e) => {
                const id = e.target.getAttribute('data-id');
                await deleteDoc(doc(db, 'help_complaints', id));
                e.target.parentElement.remove();
            };
        });
    } catch (error) {
        console.error('Error loading tickets', error);
    }
}
