// src/callEngine.js

export const initCallEngine = () => {
    const audioBtn = document.getElementById('btn-start-audio-call');
    const videoBtn = document.getElementById('btn-start-video-call');
    const callOverlay = document.getElementById('call-overlay');
    const endCallBtn = document.getElementById('btn-call-end');

    const startCall = (type) => {
        const roomName = document.getElementById('active-room-name').innerText;
        document.getElementById('call-target-name').innerText = roomName;
        document.getElementById('call-status-text').innerText = type === 'video' ? 'Starting Video Call...' : 'Calling...';
        
        if (callOverlay) callOverlay.style.display = 'flex';
        
        // Simulating connection delay
        setTimeout(() => {
            document.getElementById('call-status-text').innerText = 'Ringing...';
        }, 1500);
    };

    if (audioBtn) audioBtn.addEventListener('click', () => startCall('audio'));
    if (videoBtn) videoBtn.addEventListener('click', () => startCall('video'));

    if (endCallBtn) {
        endCallBtn.addEventListener('click', () => {
            if (callOverlay) callOverlay.style.display = 'none';
            document.getElementById('call-status-text').innerText = 'Call Ended';
        });
    }
};
