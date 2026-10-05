// js/ui.js
import { state } from './state.js';
import { dbService } from './db.js';

export const ui = {
    notifiedMessageIds: new Set(),
    pendingAttachment: null,
    titleInterval: null,

    init() {
        this.cacheDOM();
        this.bindEvents();
    },

    cacheDOM() {
        this.appContainer = document.getElementById('app-container');
        this.menuToggle = document.getElementById('menu-toggle');
        this.sidebar = document.getElementById('sidebar');
        
        this.spacesList = document.getElementById('spaces-list');
        this.dmsList = document.getElementById('dms-list');
        
        this.chatHeader = document.getElementById('chat-header');
        this.chatTitle = document.getElementById('current-chat-title');
        this.chatDesc = document.getElementById('current-chat-desc');
        this.messageList = document.getElementById('message-list');
        this.msgInputArea = document.getElementById('message-input-area');
        this.msgInput = document.getElementById('message-input');
        this.sendMsgBtn = document.getElementById('send-msg-btn');
        
        this.threadDrawer = document.getElementById('thread-drawer');
        this.closeThreadBtn = document.getElementById('close-thread-btn');
        this.threadParentMsg = document.getElementById('thread-parent-message');
        this.threadRepliesList = document.getElementById('thread-replies-list');
        this.threadInput = document.getElementById('thread-reply-input');
        this.sendReplyBtn = document.getElementById('send-reply-btn');
        
        this.authModal = document.getElementById('auth-modal');
        this.googleSigninBtn = document.getElementById('google-signin-btn');
        
        this.userAvatar = document.getElementById('user-avatar');
        
        this.createSpaceModal = document.getElementById('create-space-modal');
        this.addSpaceBtn = document.getElementById('add-space-btn');
        this.cancelCreateSpace = document.getElementById('cancel-create-space');
        this.confirmCreateSpace = document.getElementById('confirm-create-space');
        this.newSpaceName = document.getElementById('new-space-name');
        this.newSpaceDesc = document.getElementById('new-space-desc');

        // Phase 2 features
        this.searchInput = document.querySelector('.search-bar input');
        
        this.typingIndicator = document.createElement('div');
        this.typingIndicator.className = 'typing-indicator hidden';
        this.typingIndicator.innerHTML = `<span></span> <div class="typing-dots"><div></div><div></div><div></div></div>`;
        this.msgInputArea.insertBefore(this.typingIndicator, this.msgInputArea.firstChild);

        // Phase 3 features
        this.attachBtn = document.getElementById('attach-btn');
        this.attachmentInput = document.getElementById('attachment-input');
        this.lightboxModal = document.getElementById('lightbox-modal');
        this.closeLightboxBtn = document.getElementById('close-lightbox');
        this.lightboxImg = document.getElementById('lightbox-img');
    },

    bindEvents() {
        this.menuToggle.addEventListener('click', () => {
            this.sidebar.classList.toggle('open');
        });

        this.closeThreadBtn.addEventListener('click', () => {
            this.closeThread();
        });

        // Auto-grow textarea
        [this.msgInput, this.threadInput].forEach(textarea => {
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';
            });
            
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (this === this.msgInput) {
                        this.sendMsgBtn.click();
                    } else {
                        this.sendReplyBtn.click();
                    }
                }
            });
        });

        this.sendMsgBtn.addEventListener('click', () => this.handleSendMessage());
        this.sendReplyBtn.addEventListener('click', () => this.handleSendReply());

        this.addSpaceBtn.addEventListener('click', () => {
            this.createSpaceModal.classList.remove('hidden');
        });

        this.cancelCreateSpace.addEventListener('click', () => {
            this.createSpaceModal.classList.add('hidden');
            this.newSpaceName.value = '';
            this.newSpaceDesc.value = '';
        });

        this.confirmCreateSpace.addEventListener('click', async () => {
            const name = this.newSpaceName.value.trim();
            const desc = this.newSpaceDesc.value.trim();
            if (name && state.currentUser) {
                await dbService.createSpace(name, desc, false, [state.currentUser.uid], state.currentUser.uid);
                this.cancelCreateSpace.click();
            }
        });

        // Search Filtering
        this.searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('#spaces-list .nav-item, #dms-list .nav-item').forEach(item => {
                const text = item.textContent.toLowerCase();
                if (text.includes(query)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });

        // Typing Indicator Debounce
        let typingTimeout;
        const handleTyping = () => {
            if (!state.activeSpaceId || !state.currentUser) return;
            dbService.setTypingStatus(state.activeSpaceId, state.currentUser.uid, state.currentUser.displayName || 'User', true);
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                dbService.setTypingStatus(state.activeSpaceId, state.currentUser.uid, '', false);
            }, 2000);
        };
        this.msgInput.addEventListener('input', handleTyping);

        // Attachment Logic
        this.attachBtn.addEventListener('click', () => {
            this.attachmentInput.click();
        });

        this.attachmentInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Phase 3: limit image sizes to 750KB
            if (file.size > 750 * 1024) {
                alert("File size exceeds 750KB limit.");
                this.attachmentInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                this.pendingAttachment = {
                    fileUrl: event.target.result,
                    fileName: file.name
                };
                this.msgInput.placeholder = `[Attached: ${file.name}] Message...`;
            };
            reader.readAsDataURL(file);
        });

        // Lightbox Close
        this.closeLightboxBtn.addEventListener('click', () => {
            this.lightboxModal.classList.add('hidden');
            this.lightboxImg.src = '';
        });
    },

    notifyNewMessage() {
        if (document.hidden) {
            // Tab Title Alert
            if (!this.titleInterval) {
                const originalTitle = document.title;
                let isAlert = false;
                this.titleInterval = setInterval(() => {
                    document.title = isAlert ? originalTitle : "(1) New Message | Aksh Chat";
                    isAlert = !isAlert;
                }, 1500);
                
                const clearAlert = () => {
                    clearInterval(this.titleInterval);
                    this.titleInterval = null;
                    document.title = originalTitle;
                    document.removeEventListener('visibilitychange', clearAlert);
                };
                document.addEventListener('visibilitychange', clearAlert);
            }

            // Web Audio Chime
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
                
                gain.gain.setValueAtTime(0, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.5);
            } catch (e) {
                console.error("Audio error", e);
            }
        }
    },

    updateUserProfile(user) {
        if (user) {
            this.userAvatar.src = user.photoURL || '../../chat-logo.png';
            this.appContainer.classList.remove('loading');
            this.authModal.classList.add('hidden');
        } else {
            this.authModal.classList.remove('hidden');
        }
    },

    isUnread(item) {
        if (!item.updatedAt) return false;
        const lastRead = state.readReceipts[item.id]?.lastReadAt;
        if (!lastRead) return true;
        
        const updatedTime = item.updatedAt?.toMillis ? item.updatedAt.toMillis() : 0;
        const readTime = lastRead?.toMillis ? lastRead.toMillis() : 0;
        return updatedTime > readTime;
    },

    renderSpaces(spaces) {
        this.spacesList.innerHTML = '';
        spaces.forEach(space => {
            const isUnread = this.isUnread(space) && state.activeSpaceId !== space.id;
            
            const li = document.createElement('li');
            li.className = `nav-item ${state.activeSpaceId === space.id ? 'active' : ''} ${isUnread ? 'unread' : ''}`;
            li.innerHTML = `<span class="material-icons-outlined">tag</span> <span class="nav-text">${this.escapeHTML(space.name)}</span> ${isUnread ? '<div class="unread-dot"></div>' : ''}`;
            li.addEventListener('click', () => {
                if (window.innerWidth <= 768) this.sidebar.classList.remove('open');
                this.selectSpace(space);
            });
            this.spacesList.appendChild(li);
        });
    },

    renderDMs(dms) {
        this.dmsList.innerHTML = '';
        dms.forEach(dm => {
            const isUnread = this.isUnread(dm) && state.activeChatId !== dm.id;
            
            const li = document.createElement('li');
            li.className = `nav-item ${state.activeChatId === dm.id ? 'active' : ''} ${isUnread ? 'unread' : ''}`;
            li.innerHTML = `<span class="material-icons-outlined">person</span> <span class="nav-text">DM</span> ${isUnread ? '<div class="unread-dot"></div>' : ''}`;
            li.addEventListener('click', () => {
                if (window.innerWidth <= 768) this.sidebar.classList.remove('open');
                this.selectDM(dm);
            });
            this.dmsList.appendChild(li);
        });
    },

    selectSpace(space) {
        state.activeSpaceId = space.id;
        state.activeChatId = null;
        this.closeThread();
        
        if (state.currentUser) {
            dbService.updateReadReceipt(state.currentUser.uid, space.id);
            this.renderSpaces(state.spaces);
        }

        this.chatTitle.textContent = `# ${space.name}`;
        this.chatDesc.className = 'chat-desc';
        this.chatDesc.textContent = space.description || '';
        this.msgInputArea.classList.remove('hidden');
        
        state.clearActiveListeners();
        
        state.unsubMessages = dbService.listenToSpaceMessages(space.id, (snapshot) => {
            this.renderMessages(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
            if (state.currentUser) {
                dbService.updateReadReceipt(state.currentUser.uid, space.id);
            }
        });

        state.unsubTyping = dbService.listenToTyping(space.id, (snapshot) => {
            const typers = snapshot.docs
                .filter(doc => doc.id !== state.currentUser?.uid)
                .map(doc => doc.data());
            
            if (typers.length > 0) {
                this.typingIndicator.classList.remove('hidden');
                this.typingIndicator.querySelector('span').textContent = `${typers.map(t => t.name).join(', ')} ${typers.length > 1 ? 'are' : 'is'} typing...`;
            } else {
                this.typingIndicator.classList.add('hidden');
            }
        });
    },

    selectDM(dm) {
        state.activeChatId = dm.id;
        state.activeSpaceId = null;
        this.closeThread();
        
        if (state.currentUser) {
            dbService.updateReadReceipt(state.currentUser.uid, dm.id);
            this.renderDMs(state.dms);
        }
        
        this.chatTitle.textContent = `Direct Message`;
        this.chatDesc.className = 'chat-desc';
        this.chatDesc.textContent = '';
        this.msgInputArea.classList.remove('hidden');

        state.clearActiveListeners();
        
        state.unsubMessages = dbService.listenToDirectMessages(dm.id, (snapshot) => {
            this.renderMessages(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
            if (state.currentUser) {
                dbService.updateReadReceipt(state.currentUser.uid, dm.id);
            }
        });

        const otherUid = dm.participants.find(uid => uid !== state.currentUser?.uid);
        if (otherUid) {
            state.unsubPresence = dbService.listenToUserPresence(otherUid, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const statusText = data.presence === 'active' ? 'Active now' : 'Away';
                    this.chatDesc.textContent = statusText;
                    this.chatDesc.className = `chat-desc presence-${data.presence}`;
                } else {
                    this.chatDesc.textContent = 'Offline';
                    this.chatDesc.className = 'chat-desc presence-away';
                }
            });
        }
    },

    renderMessages(messages) {
        this.messageList.innerHTML = '';
        if (messages.length === 0) {
            this.messageList.innerHTML = `<div class="welcome-screen">
                <h2>No messages yet</h2>
                <p>Be the first to say hello!</p>
            </div>`;
            return;
        }

        messages.forEach(msg => {
            const msgEl = this.createMessageElement(msg);
            this.messageList.appendChild(msgEl);
            
            if (msg.createdAt && document.hidden && !this.notifiedMessageIds.has(msg.id)) {
                const timeDiff = Date.now() - msg.createdAt.toMillis();
                if (timeDiff < 5000 && msg.senderId !== state.currentUser?.uid) {
                    this.notifyNewMessage();
                    this.notifiedMessageIds.add(msg.id);
                }
            }
        });
        
        this.scrollToBottom(this.messageList);
    },

    createMessageElement(msg, isReply = false) {
        const div = document.createElement('div');
        div.className = 'message';
        
        const date = msg.createdAt ? new Date(msg.createdAt.toMillis()).toLocaleString() : 'Just now';
        
        let repliesHtml = '';
        if (!isReply && msg.replyCount > 0) {
            repliesHtml = `<div class="reply-count-badge" data-id="${msg.id}">
                <span class="material-icons-outlined" style="font-size:16px;">forum</span>
                ${msg.replyCount} replies
            </div>`;
        }

        let attachmentHtml = '';
        if (msg.fileUrl) {
            attachmentHtml = `<div class="message-attachment">
                <img src="${msg.fileUrl}" alt="${msg.fileName || 'Attachment'}" class="message-img" data-action="lightbox">
            </div>`;
        }

        let reactionsHtml = '';
        if (msg.reactions && Object.keys(msg.reactions).length > 0) {
            reactionsHtml = '<div class="reactions-container">';
            for (const [emoji, users] of Object.entries(msg.reactions)) {
                if (users.length > 0) {
                    const hasReacted = users.includes(state.currentUser?.uid);
                    reactionsHtml += `
                        <div class="reaction-badge ${hasReacted ? 'user-reacted' : ''}" data-emoji="${emoji}">
                            ${emoji} ${users.length}
                        </div>
                    `;
                }
            }
            reactionsHtml += '</div>';
        }

        let actionsHtml = '';
        if (!isReply && state.activeSpaceId) {
            const isMine = msg.senderId === state.currentUser?.uid;
            
            const quickEmojis = ['👍', '❤️', '😂', '🎉'];
            const quickEmojisHtml = quickEmojis.map(emoji => 
                `<button class="quick-reaction-btn" data-emoji="${emoji}">${emoji}</button>`
            ).join('');

            actionsHtml = `
            <div class="message-actions">
                <button class="icon-btn react-btn" title="React">
                    <span class="material-icons-outlined">add_reaction</span>
                </button>
                <div class="quick-reactions-popover">
                    ${quickEmojisHtml}
                </div>
                <button class="icon-btn reply-btn" data-id="${msg.id}" title="Reply in Thread">
                    <span class="material-icons-outlined">reply</span>
                </button>
                ${isMine ? `<button class="icon-btn danger delete-btn" data-id="${msg.id}" title="Delete">
                    <span class="material-icons-outlined">delete</span>
                </button>` : ''}
            </div>`;
        }

        div.innerHTML = `
            <img src="${msg.senderPhoto || '../../chat-logo.png'}" alt="avatar" class="message-avatar">
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author">${this.escapeHTML(msg.senderName)}</span>
                    <span class="message-time">${date}</span>
                </div>
                <div class="message-body">${this.formatMessage(msg.content)}</div>
                ${attachmentHtml}
                ${reactionsHtml}
                ${repliesHtml}
                ${actionsHtml}
            </div>
        `;

        // Bindings
        if (msg.fileUrl) {
            const imgEl = div.querySelector('.message-img');
            if (imgEl) {
                imgEl.addEventListener('click', () => {
                    this.lightboxImg.src = imgEl.src;
                    this.lightboxModal.classList.remove('hidden');
                });
            }
        }

        if (!isReply && state.activeSpaceId) {
            const replyBtn = div.querySelector('.reply-btn');
            if (replyBtn) {
                replyBtn.addEventListener('click', () => this.openThread(msg));
            }
            
            const badge = div.querySelector('.reply-count-badge');
            if (badge) {
                badge.addEventListener('click', () => this.openThread(msg));
            }

            const deleteBtn = div.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    if(confirm('Delete message?')) {
                        dbService.deleteSpaceMessage(state.activeSpaceId, msg.id);
                    }
                });
            }
            
            // Emoji Pickers
            div.querySelectorAll('.quick-reaction-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dbService.toggleReaction(state.activeSpaceId, msg.id, btn.dataset.emoji, state.currentUser.uid);
                });
            });
            div.querySelectorAll('.reaction-badge').forEach(badge => {
                badge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dbService.toggleReaction(state.activeSpaceId, msg.id, badge.dataset.emoji, state.currentUser.uid);
                });
            });
        }

        return div;
    },

    async handleSendMessage() {
        const content = this.msgInput.value.trim();
        const fileData = this.pendingAttachment;
        
        if (!content && !fileData) return;
        if (!state.currentUser) return;

        this.msgInput.value = '';
        this.msgInput.style.height = 'auto';
        this.msgInput.placeholder = 'Message...';
        this.pendingAttachment = null;
        this.attachmentInput.value = '';
        
        dbService.setTypingStatus(state.activeSpaceId, state.currentUser.uid, '', false); 

        const { uid, displayName, photoURL } = state.currentUser;
        
        try {
            if (state.activeSpaceId) {
                await dbService.sendMessageToSpace(
                    state.activeSpaceId, uid, displayName || 'User', photoURL, content,
                    fileData?.fileUrl, fileData?.fileName
                );
                await dbService.updateReadReceipt(uid, state.activeSpaceId);
            } else if (state.activeChatId) {
                await dbService.sendDirectMessage(
                    state.activeChatId, uid, displayName || 'User', photoURL, content,
                    fileData?.fileUrl, fileData?.fileName
                );
                await dbService.updateReadReceipt(uid, state.activeChatId);
            }
        } catch (e) {
            console.error("Error sending msg", e);
        }
    },

    openThread(msg) {
        state.activeThreadMessageId = msg.id;
        state.activeThreadSpaceId = state.activeSpaceId;
        
        this.threadDrawer.classList.remove('closed');
        document.getElementById('thread-parent-context').textContent = `In #${this.chatTitle.textContent.replace('# ', '')}`;
        
        this.threadParentMsg.innerHTML = '';
        this.threadParentMsg.appendChild(this.createMessageElement(msg, true));

        state.clearThreadListeners();
        state.unsubThread = dbService.listenToThreadReplies(state.activeSpaceId, msg.id, (snapshot) => {
            this.threadRepliesList.innerHTML = '';
            snapshot.docs.forEach(doc => {
                const data = {id: doc.id, ...doc.data()};
                this.threadRepliesList.appendChild(this.createMessageElement(data, true));
            });
            this.scrollToBottom(this.threadRepliesList);
        });
    },

    closeThread() {
        state.activeThreadMessageId = null;
        state.activeThreadSpaceId = null;
        this.threadDrawer.classList.add('closed');
        state.clearThreadListeners();
    },

    async handleSendReply() {
        const content = this.threadInput.value.trim();
        if (!content || !state.currentUser || !state.activeThreadMessageId) return;

        this.threadInput.value = '';
        this.threadInput.style.height = 'auto';

        const { uid, displayName, photoURL } = state.currentUser;
        
        try {
            await dbService.replyToThread(
                state.activeThreadSpaceId, 
                state.activeThreadMessageId, 
                uid, 
                displayName || 'User', 
                photoURL, 
                content
            );
        } catch (e) {
            console.error("Error sending reply", e);
        }
    },

    scrollToBottom(el) {
        setTimeout(() => {
            el.scrollTop = el.scrollHeight;
        }, 50);
    },

    escapeHTML(str) {
        return (str || '').replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag]));
    },

    formatMessage(str) {
        let formatted = this.escapeHTML(str);
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');
        formatted = formatted.replace(/`([^`]+)`/g, '<code style="background:var(--bg-tertiary);padding:2px 4px;border-radius:4px;">$1</code>');
        formatted = formatted.replace(/\n/g, '<br>');
        return formatted;
    }
};
