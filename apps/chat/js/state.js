export const state = {
    currentUser: null,
    activeSpaceId: null,
    activeChatId: null,
    activeThreadMessageId: null,
    activeThreadSpaceId: null,
    
    spaces: [],
    dms: [],
    readReceipts: {},
    
    // Unsubscribe functions
    unsubSpaces: null,
    unsubDMs: null,
    unsubMessages: null,
    unsubThread: null,
    unsubReadReceipts: null,
    unsubTyping: null,
    unsubPresence: null,

    clearActiveListeners() {
        if (this.unsubMessages) {
            this.unsubMessages();
            this.unsubMessages = null;
        }
        if (this.unsubTyping) {
            this.unsubTyping();
            this.unsubTyping = null;
        }
        if (this.unsubPresence) {
            this.unsubPresence();
            this.unsubPresence = null;
        }
    },

    clearThreadListeners() {
        if (this.unsubThread) {
            this.unsubThread();
            this.unsubThread = null;
        }
    }
};
