const Message = ({ message }) => {
  const isUser = message.sender === 'user';
  
  return (
    <div className={`message ${isUser ? 'user-message' : 'ai-message'}`}>
      <div className="message-avatar">
        {isUser ? 'You' : 'AI'}
      </div>
      <div className="message-content">
        <div className="message-header">

          <span className="message-sender">{isUser ? 'You' : 'AI Assistant'}</span>
          
        </div>
        <div className="message-text">{message.text}</div>
      </div>
    </div>
  );
};

export default Message;