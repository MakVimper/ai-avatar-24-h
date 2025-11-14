// src/components/Sidebar/Sidebar.js

import { Settings, HelpCircle, MessageSquarePlus } from 'lucide-react';
import ChatItem from './ChatItem';
import './Sidebar.css';

// Принимаем 4 пропса для управления состоянием из App.js
const Sidebar = ({ chats, activeChat, onChatSelect, onNewChat }) => {
  return (
    <div className="sidebar">
      {/* Верхняя часть с кнопкой "New Chat" */}
      <div className="sidebar-header">
       
      </div>

      {/* Список чатов */}
      <div className="chat-list">
        {/* Проверяем, есть ли чаты, перед тем как их отрисовывать */}
        {chats && chats.length > 0 ? (
          chats.map(chat => (
            <ChatItem
              key={chat.Id}
              chat={chat}
              // Определяем, активен ли этот чат для подсветки
              isActive={activeChat?.Id === chat.Id}
              // При клике вызываем функцию выбора чата, переданную из App
              onClick={() => onChatSelect(chat)}
            />
          ))
        ) : (
          <div className="no-chats-message">No conversations yet.</div>
        )}
      </div>
      
      {/* Нижняя часть с иконками */}
      <div className="sidebar-footer">
         <button className="new-chat-btn" onClick={onNewChat}>
          <span>New Chat</span>
        </button>
        <button className="icon-btn">
          <Settings size={20} />
          <span>Setting</span>
        </button>
        <button className="icon-btn">
          <HelpCircle size={20} />
          <span>Help</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;