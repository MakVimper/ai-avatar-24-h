import { useEffect, useRef } from 'react';
import Message from './Message';
import './ChatArea.css';

const ChatArea = ({ chat, isLoading }) => {
  const messages = chat?.messages || [];
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-area">
      <div className="chat-header">
        <h2>Conversation</h2>
        <p>{chat?.title || ''}</p>
      </div>

      <div className="messages-container">
        {messages.map(message => (
          <Message key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatArea;