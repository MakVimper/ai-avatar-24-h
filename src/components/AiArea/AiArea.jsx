import InputArea from '../InputArea/InputArea';
import Live2DAvatar from "./ai_avatar/Live2DAvatar";
import './AiArea.css';

const AiArea = ({ onSendMessage }) => {
  return (
    <div className="ai-area">
      <div className="empty-chat">
        <div className="empty-circle">
          <Live2DAvatar width={400} height={400} />
        </div>
      </div>
      <InputArea onSendMessage={onSendMessage} />
    </div>
  );
}

export default AiArea;