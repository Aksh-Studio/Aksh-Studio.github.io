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
        
        this.userAvatar = document.getElementById('user-avatar');
        
        this.createSpaceModal = document.getElementById('create-space-modal');
        this.addSpaceBtn = document.getElementById('add-space-btn');
        this.cancelCreateSpace = document.getElementById('cancel-create-space');
        this.confirmCreateSpace = document.getElementById('confirm-create-space');
        this.newSpaceName = document.getElementById('new-space-name');
        this.newSpaceDesc = document.getElementById('new-space-desc');

        this.searchInput = document.querySelector('.search-bar input');
        
        this.typingIndicator = document.createElement('div');
        this.typingIndicator.className = 'typing-indicator hidden';
        this.typingIndicator.innerHTML = `<span></span> <div class="typing-dots"><div></div><div></div><div></div></div>`;
        this.msgInputArea.insertBefore(this.typingIndicator, this.msgInputArea.firstChild);

        this.attachBtn = document.getElementById('attach-btn');
        this.attachmentInput = document.getElementById('attachment-input');
        this.lightboxModal = document.getElementById('lightbox-modal');
        this.closeLightboxBtn = document.getElementById('close-lightbox');
        this.lightboxImg = document.getElementById('lightbox-img');

        // Phase 4
        this.pinnedBar = document.getElementById('pinned-messages-bar');
        this.pinnedContent = document.getElementById('pinned-messages-content');
        this.spaceInfoBtn = document.getElementById('space-info-btn');
        this.spaceInfoPanel = document.getElementById('space-info-panel');
        this.closeSpaceInfoBtn = document.getElementById('close-space-info-btn');
        this.infoSpaceName = document.getElementById('info-space-name');
        this.infoSpaceDesc = document.getElementById('info-space-desc');
        this.infoSpaceDate = document.getElementById('info-space-date');
        this.infoMemberCount = document.getElementById('info-member-count');
        this.infoMemberList = document.getElementById('info-member-list');
        this.leaveSpaceBtn = document.getElementById('leave-space-btn');
        
        this.addDmBtn = document.getElementById('add-dm-btn');
        this.newDmModal = document.getElementById('new-dm-modal');
        this.cancelNewDmBtn = document.getElementById('cancel-new-dm');
        this.dmUserSearch = document.getElementById('dm-user-search');
        this.dmUserList = document.getElementById('dm-user-list');
    },

    bindEvents() {
        this.menuToggle.addEventListener('click', () => this.sidebar.classList.toggle('open'));
        this.closeThreadBtn.addEventListener('click', () => this.closeThread());

        [this.msgInput, this.threadInput].forEach(textarea => {
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';
            });
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this === ui.msgInput ? ui.handleSendMessage() : ui.handleSendReply();
                }
            });
        });

        this.sendMsgBtn.addEventListener('click', () => this.handleSendMessage());
        this.sendReplyBtn.addEventListener('click', () => this.handleSendReply());

        this.addSpaceBtn.addEventListener('click', () => this.createSpaceModal.classList.remove('hidden'));
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

        this.searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('#spaces-list .nav-item, #dms-list .nav-item').forEach(item => {
                item.style.display = item.textContent.toLowerCase().includes(query) ? 'flex' : 'none';
            });
        });

        let typingTimeout;
        this.msgInput.addEventListener('input', () => {
            if (!state.activeSpaceId || !state.currentUser) return;
            dbService.setTypingStatus(state.activeSpaceId, state.currentUser.uid, state.currentUser.displayName || 'User', true);
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                dbService.setTypingStatus(state.activeSpaceId, state.currentUser.uid, '', false);
            }, 2000);
        });

        this.attachBtn.addEventListener('click', () => this.attachmentInput.click());
        this.attachmentInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 1.5 * 1024 * 1024) {
                alert("File size exceeds 1.5MB limit.");
                this.attachmentInput.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                this.pendingAttachment = { url: event.target.result, name: file.name, size: file.size, type: file.type };
                this.msgInput.placeholder = `[Attached: ${file.name}] Message...`;
            };
            reader.readAsDataURL(file);
        });

        this.closeLightboxBtn.addEventListener('click', () => {
            this.lightboxModal.classList.add('hidden');
            this.lightboxImg.src = '';
        });

        // Phase 4 bindings
        this.spaceInfoBtn.addEventListener('click', () => {
            this.spaceInfoPanel.classList.remove('closed');
            this.renderSpaceInfo();
        });
        this.closeSpaceInfoBtn.addEventListener('click', () => this.spaceInfoPanel.classList.add('closed'));

        this.leaveSpaceBtn.addEventListener('click', async () => {
            if (confirm("Are you sure you want to leave this space?")) {
                await dbService.leaveSpace(state.activeSpaceId, state.currentUser.uid);
                this.spaceInfoPanel.classList.add('closed');
                state.activeSpaceId = null;
                this.messageList.innerHTML = `<div class="welcome-screen"><h2>Welcome to Aksh Chat</h2></div>`;
                this.chatHeader.classList.add('hidden');
                this.msgInputArea.classList.add('hidden');
            }
        });

        this.addDmBtn.addEventListener('click', () => {
            this.newDmModal.classList.remove('hidden');
            this.renderUserPicker('');
        });
        this.cancelNewDmBtn.addEventListener('click', () => this.newDmModal.classList.add('hidden'));
        this.dmUserSearch.addEventListener('input', (e) => this.renderUserPicker(e.target.value));
    },

    renderUserPicker(query = '') {
        this.dmUserList.innerHTML = '';
        const lowerQuery = query.toLowerCase();
        Object.values(state.users).forEach(user => {
            if (user.uid === state.currentUser?.uid) return;
            if (user.displayName?.toLowerCase().includes(lowerQuery) || user.email?.toLowerCase().includes(lowerQuery)) {
                const card = document.createElement('div');
                card.className = 'user-card';
                card.innerHTML = `
                    <img src="${user.photoURL || '../../chat-logo.png'}" class="user-card-avatar">
                    <div class="user-card-info">
                        <span class="user-card-name">${this.escapeHTML(user.displayName)}</span>
                        <span class="user-card-email">${this.escapeHTML(user.email)}</span>
                    </div>
                    <div class="user-presence-dot ${user.presence || 'away'}"></div>
                `;
                card.addEventListener('click', async () => {
                    const dm = await dbService.createOrGetDirectChat(state.currentUser.uid, user.uid);
                    this.newDmModal.classList.add('hidden');
                    const stateDm = state.dms.find(d => d.id === dm.id);
                    this.selectDM(stateDm || dm);
                });
                this.dmUserList.appendChild(card);
            }
        });
    },

    renderSpaceInfo() {
        const space = state.spaces.find(s => s.id === state.activeSpaceId);
        if (!space) return;

        this.infoSpaceName.textContent = space.name;
        this.infoSpaceDesc.textContent = space.description || '';
        this.infoSpaceDate.textContent = space.createdAt ? new Date(space.createdAt.toMillis()).toLocaleDateString() : '';
        this.infoMemberCount.textContent = space.members?.length || 0;
        
        this.infoMemberList.innerHTML = '';
        space.members.forEach(uid => {
            const user = state.users[uid];
            if (user) {
                const card = document.createElement('div');
                card.className = 'user-card';
                card.innerHTML = `
                    <img src="${user.photoURL || '../../chat-logo.png'}" class="user-card-avatar">
                    <div class="user-card-info"><span class="user-card-name">${this.escapeHTML(user.displayName)}</span></div>
                    <div class="user-presence-dot ${user.presence || 'away'}"></div>
                `;
                this.infoMemberList.appendChild(card);
            }
        });

        if (space.createdBy === state.currentUser.uid) {
            this.leaveSpaceBtn.classList.add('hidden');
        } else {
            this.leaveSpaceBtn.classList.remove('hidden');
        }
    },

    notifyNewMessage() {
        if (document.hidden) {
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
            } catch (e) { console.error("Audio error", e); }
        }
    },

    updateUserProfile(user) {
        if (user) {
            this.userAvatar.src = user.photoURL || '../../chat-logo.png';
            this.appContainer.classList.remove('loading');
        }
    },

    isUnread(item) {
        if (!item.updatedAt) return false;
        const lastRead = state.readReceipts[item.id]?.lastReadAt;
        if (!lastRead) return true;
        return (item.updatedAt?.toMillis ? item.updatedAt.toMillis() : 0) > (lastRead?.toMillis ? lastRead.toMillis() : 0);
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

        this.chatHeader.classList.remove('hidden');
        this.chatTitle.textContent = `# ${space.name}`;
        this.chatDesc.className = 'chat-desc';
        this.chatDesc.textContent = space.description || '';
        this.msgInputArea.classList.remove('hidden');
        this.spaceInfoBtn.classList.remove('hidden');
        
        state.clearActiveListeners();
        state.unsubMessages = dbService.listenToSpaceMessages(space.id, (snapshot) => {
            this.renderMessages(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
            if (state.currentUser) dbService.updateReadReceipt(state.currentUser.uid, space.id);
        });
        state.unsubTyping = dbService.listenToTyping(space.id, (snapshot) => {
            const typers = snapshot.docs.filter(doc => doc.id !== state.currentUser?.uid).map(doc => doc.data());
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
        
        this.chatHeader.classList.remove('hidden');
        this.chatTitle.textContent = `Direct Message`;
        this.chatDesc.className = 'chat-desc';
        this.chatDesc.textContent = '';
        this.msgInputArea.classList.remove('hidden');
        this.spaceInfoBtn.classList.add('hidden');
        this.spaceInfoPanel.classList.add('closed');

        state.clearActiveListeners();
        state.unsubMessages = dbService.listenToDirectMessages(dm.id, (snapshot) => {
            this.renderMessages(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
            if (state.currentUser) dbService.updateReadReceipt(state.currentUser.uid, dm.id);
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
            this.messageList.innerHTML = `<div class="welcome-screen"><h2>No messages yet</h2><p>Be the first to say hello!</p></div>`;
            this.pinnedBar.classList.add('hidden');
            return;
        }

        const pinnedMessages = messages.filter(m => m.isPinned);
        if (pinnedMessages.length > 0) {
            const latestPin = pinnedMessages[pinnedMessages.length - 1];
            this.pinnedBar.classList.remove('hidden');
            this.pinnedContent.textContent = `${latestPin.senderName}: ${latestPin.content}`;
            this.pinnedBar.onclick = () => {
                const target = document.getElementById(`msg-${latestPin.id}`);
                if (target) target.scrollIntoView({ behavior: 'smooth' });
            };
        } else {
            this.pinnedBar.classList.add('hidden');
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
        div.id = `msg-${msg.id}`;
        
        const date = msg.createdAt ? new Date(msg.createdAt.toMillis()).toLocaleString() : 'Just now';
        
        let repliesHtml = '';
        if (!isReply && msg.replyCount > 0) {
            repliesHtml = `<div class="reply-count-badge" data-id="${msg.id}"><span class="material-icons-outlined" style="font-size:16px;">forum</span> ${msg.replyCount} replies</div>`;
        }

        let attachmentHtml = '';
        if (msg.fileUrl) {
            const isImg = msg.fileName && msg.fileName.match(/\.(jpeg|jpg|gif|png|webp)$/i);
            if (isImg) {
                attachmentHtml = `<div class="message-attachment"><img src="${msg.fileUrl}" alt="${msg.fileName}" class="message-img" data-action="lightbox"></div>`;
            } else {
                const sizeStr = msg.fileSize ? (msg.fileSize / 1024).toFixed(1) + ' KB' : 'Document';
                attachmentHtml = `<a href="${msg.fileUrl}" download="${msg.fileName}" class="file-attachment-card">
                    <span class="material-icons-outlined">insert_drive_file</span>
                    <div class="file-attachment-info">
                        <span class="file-attachment-name">${this.escapeHTML(msg.fileName)}</span>
                        <span class="file-attachment-size">${sizeStr}</span>
                    </div>
                </a>`;
            }
        }

        let reactionsHtml = '';
        if (msg.reactions && Object.keys(msg.reactions).length > 0) {
            reactionsHtml = '<div class="reactions-container">';
            for (const [emoji, users] of Object.entries(msg.reactions)) {
                if (users.length > 0) {
                    const hasReacted = users.includes(state.currentUser?.uid);
                    reactionsHtml += `<div class="reaction-badge ${hasReacted ? 'user-reacted' : ''}" data-emoji="${emoji}">${emoji} ${users.length}</div>`;
                }
            }
            reactionsHtml += '</div>';
        }

        let actionsHtml = '';
        if (!isReply && state.activeSpaceId) {
            const isMine = msg.senderId === state.currentUser?.uid;
            const quickEmojisHtml = ['👍', '❤️', '😂', '🎉'].map(emoji => `<button class="quick-reaction-btn" data-emoji="${emoji}">${emoji}</button>`).join('');

            actionsHtml = `
            <div class="message-actions">
                <button class="icon-btn react-btn" title="React"><span class="material-icons-outlined">add_reaction</span></button>
                <div class="quick-reactions-popover">${quickEmojisHtml}</div>
                <button class="icon-btn reply-btn" data-id="${msg.id}" title="Reply in Thread"><span class="material-icons-outlined">reply</span></button>
                <button class="icon-btn pin-btn" data-id="${msg.id}" title="${msg.isPinned ? 'Unpin' : 'Pin'}"><span class="material-icons-outlined">${msg.isPinned ? 'push_pin' : 'push_pin'}</span></button>
                ${isMine ? `
                <button class="icon-btn edit-btn" data-id="${msg.id}" title="Edit"><span class="material-icons-outlined">edit</span></button>
                <button class="icon-btn danger delete-btn" data-id="${msg.id}" title="Delete"><span class="material-icons-outlined">delete</span></button>` : ''}
            </div>`;
        }

        div.innerHTML = `
            <img src="${msg.senderPhoto || '../../chat-logo.png'}" alt="avatar" class="message-avatar">
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author">${this.escapeHTML(msg.senderName)}</span>
                    <span class="message-time">${date}</span>
                </div>
                <div class="message-body-container">
                    <div class="message-body">${this.formatMessage(msg.content)} ${msg.isEdited ? '<span class="edited-tag">(edited)</span>' : ''}</div>
                </div>
                ${attachmentHtml}
                ${reactionsHtml}
                ${repliesHtml}
                ${actionsHtml}
            </div>
        `;

        if (msg.fileUrl && div.querySelector('.message-img')) {
            div.querySelector('.message-img').addEventListener('click', (e) => {
                this.lightboxImg.src = e.target.src;
                this.lightboxModal.classList.remove('hidden');
            });
        }

        if (!isReply && state.activeSpaceId) {
            if (div.querySelector('.reply-btn')) div.querySelector('.reply-btn').addEventListener('click', () => this.openThread(msg));
            if (div.querySelector('.reply-count-badge')) div.querySelector('.reply-count-badge').addEventListener('click', () => this.openThread(msg));
            if (div.querySelector('.pin-btn')) div.querySelector('.pin-btn').addEventListener('click', () => dbService.togglePinMessage(state.activeSpaceId, msg.id, !msg.isPinned));
            if (div.querySelector('.delete-btn')) div.querySelector('.delete-btn').addEventListener('click', () => {
                if(confirm('Delete message?')) dbService.deleteSpaceMessage(state.activeSpaceId, msg.id);
            });
            
            const isMine = msg.senderId === state.currentUser?.uid;
            if (isMine) {
                const editBtn = div.querySelector('.edit-btn');
                if (editBtn) {
                    editBtn.addEventListener('click', () => {
                        const bodyEl = div.querySelector('.message-body-container');
                        const originalContent = msg.content;
                        bodyEl.innerHTML = `
                            <div class="edit-message-area">
                                <textarea id="edit-input-${msg.id}">${originalContent}</textarea>
                                <div class="edit-actions">
                                    <button class="btn cancel-edit-btn">Cancel</button>
                                    <button class="btn primary save-edit-btn">Save</button>
                                </div>
                            </div>
                        `;
                        div.querySelector('.message-actions').style.display = 'none';
                        
                        bodyEl.querySelector('.save-edit-btn').addEventListener('click', () => {
                            const newContent = bodyEl.querySelector('textarea').value.trim();
                            if (newContent && newContent !== originalContent) {
                                dbService.editSpaceMessage(state.activeSpaceId, msg.id, newContent);
                            } else {
                                this.selectSpace(state.spaces.find(s => s.id === state.activeSpaceId));
                            }
                        });
                        
                        bodyEl.querySelector('.cancel-edit-btn').addEventListener('click', () => {
                            bodyEl.innerHTML = `<div class="message-body">${this.formatMessage(originalContent)} ${msg.isEdited ? '<span class="edited-tag">(edited)</span>' : ''}</div>`;
                            div.querySelector('.message-actions').style.display = '';
                        });
                    });
                }
            }

            div.querySelectorAll('.quick-reaction-btn, .reaction-badge').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dbService.toggleReaction(state.activeSpaceId, msg.id, btn.dataset.emoji, state.currentUser.uid);
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
                await dbService.sendMessageToSpace(state.activeSpaceId, uid, displayName || 'User', photoURL, content, fileData);
                await dbService.updateReadReceipt(uid, state.activeSpaceId);
            } else if (state.activeChatId) {
                await dbService.sendDirectMessage(state.activeChatId, uid, displayName || 'User', photoURL, content, fileData);
                await dbService.updateReadReceipt(uid, state.activeChatId);
            }
        } catch (e) { console.error("Error sending msg", e); }
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
            snapshot.docs.forEach(doc => this.threadRepliesList.appendChild(this.createMessageElement({id: doc.id, ...doc.data()}, true)));
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
        try {
            await dbService.replyToThread(state.activeThreadSpaceId, state.activeThreadMessageId, state.currentUser.uid, state.currentUser.displayName || 'User', state.currentUser.photoURL, content);
        } catch (e) { console.error("Error sending reply", e); }
    },

    scrollToBottom(el) { setTimeout(() => { el.scrollTop = el.scrollHeight; }, 50); },

    escapeHTML(str) {
        return (str || '').replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
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
