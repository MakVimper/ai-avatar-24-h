import { MessageSquare } from 'lucide-react';

const ChatItem = ({ chat, isActive, onClick }) => {
  return (
    <div 
      className={`chat-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <MessageSquare size={20} strokeWidth={2} />
      <span>{chat.title}</span>
    </div>
  );
};

export default ChatItem;
