import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime

DB_HOST = "localhost"
DB_PORT = 5432
DB_NAME = "ai_chat"
DB_USER = "postgres"
DB_PASSWORD = "123"

conn = psycopg2.connect(
    host=DB_HOST,
    port=DB_PORT,
    dbname=DB_NAME,
    user=DB_USER,
    password=DB_PASSWORD
)

cursor = conn.cursor(cursor_factory=RealDictCursor)

def save_message(chat_id, user_message, bot_reply):
    cursor.execute(
        "INSERT INTO messages (id_chats, user_message, bot_reply) VALUES (%s, %s, %s) RETURNING id;",
        (chat_id, user_message, bot_reply)
    )
    conn.commit()
    return cursor.fetchone()["id"]

def get_chats_from_db():
    """
    Возвращает список всех чатов с первым сообщением (title)
    """
    query = """
        WITH RankedMessages AS (
            SELECT
                id_chats,
                user_message,
                ROW_NUMBER() OVER(PARTITION BY id_chats ORDER BY created_at ASC) as rn
            FROM messages
        )
        SELECT
            id_chats,
            user_message AS title
        FROM RankedMessages
        WHERE rn = 1
        ORDER BY id_chats DESC;
    """
    cursor.execute(query)
    rows = cursor.fetchall()  # список словарей благодаря RealDictCursor
    return [{"Id": row["id_chats"], "title": row["title"] or ""} for row in rows]


def get_chat_messages_from_db(chat_id: str):
    """
    Возвращает все сообщения для конкретного чата
    """
    query = """
        SELECT user_message, bot_reply, created_at
        FROM messages
        WHERE id_chats = %s
        ORDER BY created_at ASC;
    """
    cursor.execute(query, (chat_id,))
    rows = cursor.fetchall()

    messages = []
    for row in rows:
        messages.append({
            "question": row["user_message"],
            "answer": row["bot_reply"],
            "time": row["created_at"].isoformat() if isinstance(row["created_at"], datetime) else str(row["created_at"])
        })
    return messages
