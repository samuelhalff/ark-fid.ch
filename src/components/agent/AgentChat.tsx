// This is a minimal change to update chat input positioning from fixed to sticky
import React from 'react';

const AgentChat = () => {
    return (
        <div className="chat-container">
            {/* Adjust other components */}
            <div className="chat-input sticky bottom-0 pb-4"> {/* Updated class */}
                {/* Input Field */}
            </div>
            {/* Other components */}
        </div>
    );
};

export default AgentChat;