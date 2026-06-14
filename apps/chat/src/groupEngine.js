// src/groupEngine.js

export const initGroupEngine = () => {
    const headerInfo = document.getElementById('header-room-info');
    const infoPanel = document.getElementById('group-info-panel');
    const closeBtn = document.getElementById('btn-close-info');

    if (headerInfo && infoPanel) {
        // Slide open the panel
        headerInfo.addEventListener('click', () => {
            const roomName = document.getElementById('active-room-name').innerText;
            const roomIcon = document.getElementById('active-room-icon').innerText;
            
            document.getElementById('info-room-name').innerText = roomName;
            document.getElementById('info-avatar-icon').innerText = roomIcon;
            
            infoPanel.style.display = 'flex';
        });
    }

    if (closeBtn) {
        // Close the panel
        closeBtn.addEventListener('click', () => {
            infoPanel.style.display = 'none';
        });
    }
};
