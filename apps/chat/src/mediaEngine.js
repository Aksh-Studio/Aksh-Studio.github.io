// src/mediaEngine.js

export const initMediaEngine = () => {
    // 1. Chat Export Feature
    const exportBtn = document.getElementById('btn-export-chat');
    
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const messages = document.querySelectorAll('.msg-bubble');
            if (messages.length === 0) return alert("No messages to export in this chat.");

            let chatText = "--- AKSH CHAT EXPORT ---\n\n";
            const roomName = document.getElementById('active-room-name').innerText;
            chatText += `Room: ${roomName}\nDate: ${new Date().toLocaleString()}\n\n`;

            messages.forEach(msg => {
                const textEl = msg.querySelector('span[id^="text-"]');
                const senderEl = msg.querySelector('.msg-sender-name');
                const timeEl = msg.querySelector('.msg-meta span');

                const text = textEl ? textEl.innerText : "Media/Deleted";
                const sender = senderEl ? senderEl.innerText : "Me";
                const time = timeEl ? timeEl.innerText : "";

                chatText += `[${time}] ${sender}: ${text}\n`;
            });

            // Create a downloadable .txt file
            const blob = new Blob([chatText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Aksh_Chat_${roomName.replace(/\s+/g, '_')}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    // 2. Media Upload Trigger (Prepped for Firebase Storage)
    const mediaBtn = document.getElementById('btn-media-upload');
    const fileInput = document.getElementById('hidden-file-input');

    if (mediaBtn && fileInput) {
        mediaBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                alert("File selected! Firebase Storage integration coming in next patch.");
            }
        });
    }
};
