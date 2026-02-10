// Reverted changes for AgentChat.tsx

// Import necessary libraries
import React from 'react';
import classNames from 'classnames';

const AgentChat = () => {
    return (
        <div className={classNames('chat-container', 'bg-backdrop', 'sticky', 'bottom-0')}>  
            {/* Existing chat message list with no changes to overflow */}
            <div className='message-list'>
                {/* Message items will go here */}
            </div>
            {/* Chat input area here */}
            <div className='chat-input'>
                {/* Input field goes here */}
            </div>
        </div>
    );
};

export default AgentChat;