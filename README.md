# 💧 EverWater — Сервис доставки воды

Полноценная система заказа и доставки бутилированной воды на базе **Telegram Mini App**.

> Клиент делает заказ прямо в Telegram → администратор подтверждает → курьер доставляет.

---

## Стек технологий

| Слой | Технологии |
|---|---|
| **Bot** | Python 3.11, aiogram 3, FSM |
| **Backend** | FastAPI, SQLAlchemy 2 (async), Alembic, PostgreSQL 16 |
| **Frontend** | React 18, Vite, Telegram Web App SDK |
| **Инфраструктура** | Docker, Docker Compose, Nginx, systemd |

---

## Архитектура

```
┌─────────────────────────────────────────────────┐
│                   Telegram                       │
│  ┌──────────────┐       ┌─────────────────────┐ │
│  │  Telegram Bot │       │  Telegram Mini App  │ │
│  │  (aiogram 3)  │       │  (React + Vite)     │ │
│  └──────┬───────┘       └──────────┬──────────┘ │
└─────────┼──────────────────────────┼────────────┘
          │  HTTP                    │  HTTP
          ▼                          ▼
   ┌──────────────────────────────────────┐
   │         FastAPI Backend              │
   │  /users  /products  /orders  /admin  │
   └────────────────────┬─────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │  PostgreSQL 16   │
              └──────────────────┘
```

**4 сервиса в Docker Compose:** `db`, `backend`, `bot`, `frontend`

---

## Функциональность

### Клиент (Telegram Bot + Mini App)
- Регистрация через бота (имя + телефон)
- Каталог товаров в Mini App
- Корзина, оформление заказа с адресом, временем доставки и геолокацией
- Возврат пустых бутылок — скидка на заказ
- Подтверждение оплаты (перевод на карту)
- История заказов с детальным статусом
- Профиль: баланс, бонусные баллы
- Отзывы с рейтингом после доставки
- Поддержка

### Администратор (Telegram Bot + Web-панель)
- Просмотр всех заказов и фильтрация по статусу
- Подтверждение / отклонение заказов с указанием причины
- Назначение курьера на заказ
- Просмотр списка курьеров и их статистики
- Аналитика: выручка, средний чек, возврат бутылок, повторные клиенты (за день / неделю / месяц)

### Курьер (Telegram Bot + Web-панель)
- Получение уведомления о назначенном заказе
- Просмотр адреса, геолокации, товаров и телефона клиента
- Обновление статуса доставки

### Жизненный цикл заказа

```
new → awaiting_confirmation → confirmed → assigned_to_courier → in_delivery → delivered
                                                                             ↘ rejected
```

---

## Структура проекта

```
everwater/
├── backend/                  # FastAPI приложение
│   ├── app/
│   │   ├── models/           # SQLAlchemy модели (User, Order, Product, Courier)
│   │   ├── routers/          # API роуты (users, orders, products, admin)
│   │   ├── schemas/          # Pydantic схемы
│   │   ├── database.py
│   │   ├── config.py
│   │   └── main.py
│   ├── Dockerfile
│   └── requirements.txt
├── bot/                      # Telegram-бот (aiogram 3)
│   ├── handlers/
│   │   ├── start.py          # Регистрация, заказы, профиль, отзывы
│   │   ├── admin.py          # Админ-панель
│   │   └── courier.py        # Курьерский интерфейс
│   ├── keyboards/            # Reply и Inline клавиатуры
│   ├── services/
│   │   └── api_client.py     # HTTP-клиент к backend
│   ├── config.py
│   ├── main.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                 # Telegram Mini App (React)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Catalog.jsx
│   │   │   ├── Cart.jsx
│   │   │   ├── Checkout.jsx
│   │   │   ├── OrderHistory.jsx
│   │   │   ├── Profile.jsx
│   │   │   ├── Support.jsx
│   │   │   ├── admin/        # Веб-панель администратора
│   │   │   ├── courier/      # Веб-панель курьера
│   │   │   └── manager/      # Веб-панель менеджера
│   │   ├── api/
│   │   ├── components/
│   │   └── store/
│   ├── nginx.conf
│   ├── Dockerfile
│   └── vite.config.js
├── docker-compose.yml        # Локальная разработка
├── docker-compose.prod.yml   # Продакшн
├── deploy.sh                 # Скрипт деплоя на VPS
├── everwater.service         # systemd unit
└── .env.example
```

---

## Быстрый старт

### Требования
- Docker и Docker Compose
- Telegram Bot Token ([получить у @BotFather](https://t.me/BotFather))

### 1. Клонировать репозиторий

```bash
git clone https://github.com/d666af/everwater.git
cd everwater
```

### 2. Настроить переменные окружения

```bash
cp .env.example .env
```

Отредактировать `.env`:

```env
# Telegram
BOT_TOKEN=ваш_токен_бота
ADMIN_IDS=[ваш_telegram_id]
MINI_APP_URL=http://ВАШ_IP:3000

# База данных
POSTGRES_USER=postgres
POSTGRES_PASSWORD=надёжный_пароль
POSTGRES_DB=waterbot

# Оплата
PAYMENT_CARD=0000 0000 0000 0000
PAYMENT_HOLDER=Иванов Иван

# Скидка за возврат бутылок
BOTTLE_DISCOUNT_TYPE=fixed   # fixed или percent
BOTTLE_DISCOUNT_VALUE=50

# Секретный ключ
SECRET_KEY=$(openssl rand -hex 32)
```

### 3. Запустить

```bash
docker compose up -d
```

Сервисы будут доступны:
- **Backend API** — `http://localhost:8000`
- **API Docs** — `http://localhost:8000/docs`
- **Frontend (Mini App)** — `http://localhost:3000`

---

## Деплой на VPS

```bash
# Настройте .env, затем:
bash deploy.sh
```

Скрипт автоматически:
1. Подтягивает последние изменения из git
2. Пересобирает Docker-образы
3. Перезапускает контейнеры без даунтайма

Для автозапуска через systemd:

```bash
sudo cp everwater.service /etc/systemd/system/
sudo systemctl enable --now everwater
```

---

## API

После запуска интерактивная документация доступна по адресу:

```
http://localhost:8000/docs
```

Основные группы эндпоинтов:

| Префикс | Описание |
|---|---|
| `GET /products` | Каталог товаров |
| `POST/GET /users` | Пользователи |
| `POST/GET /orders` | Заказы |
| `GET /admin/...` | Администрирование |

---

## Переменные окружения

| Переменная | Описание | Пример |
|---|---|---|
| `BOT_TOKEN` | Токен Telegram-бота | `123456:ABC...` |
| `ADMIN_IDS` | Telegram ID администраторов | `[123456789]` |
| `MINI_APP_URL` | URL фронтенда для кнопки в боте | `https://water.example.com` |
| `POSTGRES_USER` | Пользователь БД | `postgres` |
| `POSTGRES_PASSWORD` | Пароль БД | |
| `POSTGRES_DB` | Имя базы данных | `waterbot` |
| `FRONTEND_PORT` | Порт фронтенда | `3000` |
| `PAYMENT_CARD` | Номер карты для оплаты | |
| `PAYMENT_HOLDER` | Владелец карты | |
| `BOTTLE_DISCOUNT_TYPE` | Тип скидки за бутылки | `fixed` / `percent` |
| `BOTTLE_DISCOUNT_VALUE` | Размер скидки | `50` |
| `SECRET_KEY` | Секретный ключ | `openssl rand -hex 32` |
