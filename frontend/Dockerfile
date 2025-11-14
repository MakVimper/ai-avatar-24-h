FROM node:20

WORKDIR /app

# Копируем только package*.json, чтобы не ломать сборку если package-lock.json нет
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем весь проект
COPY . .

# Открываем порт
EXPOSE 5173

# Запуск dev сервера
CMD ["npx", "vite", "--host"]
