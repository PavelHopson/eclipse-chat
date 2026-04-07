# Eclipse Chat — Socket.io Events

## Подключение

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { token: '<access_token>' },
  transports: ['websocket'],
});
```

Сервер верифицирует JWT при подключении. При невалидном токене — `connect_error`.

---

## Клиент → Сервер

### join_channel
Подписаться на события канала (нужно вызвать при открытии канала).
```typescript
socket.emit('join_channel', { channelId: 'abc123' });
```

### leave_channel
Отписаться (при смене канала).
```typescript
socket.emit('leave_channel', { channelId: 'abc123' });
```

### send_message
```typescript
socket.emit('send_message', {
  channelId: 'abc123',
  content: 'Привет!',
  fileUrl: null,    // опционально
  fileName: null,   // опционально
});
```

### edit_message
```typescript
socket.emit('edit_message', {
  messageId: 'msg456',
  content: 'Обновлённый текст',
});
```

### delete_message
```typescript
socket.emit('delete_message', { messageId: 'msg456' });
```

### add_reaction
```typescript
socket.emit('add_reaction', { messageId: 'msg456', emoji: '👍' });
```

### remove_reaction
```typescript
socket.emit('remove_reaction', { messageId: 'msg456', emoji: '👍' });
```

### typing_start / typing_stop
```typescript
socket.emit('typing_start', { channelId: 'abc123' });
socket.emit('typing_stop', { channelId: 'abc123' });
```

---

## Сервер → Клиент

### message_new
```typescript
socket.on('message_new', (message: Message) => {
  // Добавить в список сообщений канала
});
```
```typescript
interface Message {
  id: string;
  content: string;
  fileUrl: string | null;
  fileName: string | null;
  edited: boolean;
  createdAt: string;
  channelId: string;
  author: { id: string; username: string; avatar: string | null };
  reactions: Reaction[];
}
```

### message_updated
```typescript
socket.on('message_updated', (message: Message) => {
  // Обновить сообщение в списке
});
```

### message_deleted
```typescript
socket.on('message_deleted', ({ messageId }: { messageId: string }) => {
  // Убрать из списка
});
```

### reaction_updated
```typescript
socket.on('reaction_updated', ({ messageId, reactions }: {
  messageId: string;
  reactions: Reaction[];
}) => {
  // Обновить реакции на сообщение
});
```

### user_typing
```typescript
socket.on('user_typing', ({ channelId, userId, username, isTyping }: {
  channelId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}) => {
  // Показать/скрыть "Pavel печатает..."
});
```

### presence_update
```typescript
socket.on('presence_update', ({ userId, status }: {
  userId: string;
  status: 'ONLINE' | 'IDLE' | 'DND' | 'OFFLINE';
}) => {
  // Обновить статус в списке участников
});
```

### member_joined
```typescript
socket.on('member_joined', ({ serverId, member }: {
  serverId: string;
  member: Member;
}) => {
  // Добавить в список участников сервера
});
```

### member_left
```typescript
socket.on('member_left', ({ serverId, userId }: {
  serverId: string;
  userId: string;
}) => {
  // Убрать из списка участников
});
```

### error
```typescript
socket.on('error', ({ message }: { message: string }) => {
  // Показать ошибку пользователю
});
```

---

## Комнаты (Rooms)

Socket.io rooms используются для изоляции событий:

| Room | Формат | Кто получает |
|------|--------|-------------|
| Канал | `channel:${channelId}` | Все в этом канале |
| Сервер | `server:${serverId}` | Все участники сервера |
| Пользователь | `user:${userId}` | Конкретный пользователь |

При подключении сервер автоматически добавляет пользователя в rooms всех его серверов (`server:*`). `join_channel` / `leave_channel` управляют подпиской на `channel:*`.
