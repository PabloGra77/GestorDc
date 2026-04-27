export interface ChatRequestMessage {
  id: number;
  title: string;
  author: string;
  recipient: string;
  createdAt: string;
}

const STORAGE_KEY = 'gestordoc.requests.chat';
const UPDATE_EVENT = 'gestordoc-chat-updated';
const SEEN_NOTIFICATIONS_PREFIX = 'gestordoc.requests.notifications.seen';

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function formatRelativeNow() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `Hoy ${hh}:${mm}`;
}

export function loadChatMessages(): ChatRequestMessage[] {
  if (!isBrowser()) {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as ChatRequestMessage[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item) =>
        typeof item.id === 'number' &&
        typeof item.title === 'string' &&
        typeof item.author === 'string' &&
        typeof item.recipient === 'string' &&
        typeof item.createdAt === 'string',
    );
  } catch {
    return [];
  }
}

export function saveChatMessages(messages: ChatRequestMessage[]) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  window.dispatchEvent(new Event(UPDATE_EVENT));
}

export function appendChatMessages(newMessages: ChatRequestMessage[]) {
  if (!isBrowser() || newMessages.length === 0) {
    return;
  }

  const current = loadChatMessages();
  const existingIds = new Set(current.map((item) => item.id));
  const merged = [...current];

  newMessages.forEach((item) => {
    if (!existingIds.has(item.id)) {
      merged.unshift(item);
      existingIds.add(item.id);
    }
  });

  saveChatMessages(merged);
}

export function getChatUpdateEventName() {
  return UPDATE_EVENT;
}

function getSeenStorageKey(user: string) {
  return `${SEEN_NOTIFICATIONS_PREFIX}.${user.toLowerCase()}`;
}

function loadSeenIds(user: string): number[] {
  if (!isBrowser()) {
    return [];
  }

  const raw = window.localStorage.getItem(getSeenStorageKey(user));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as number[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((id) => typeof id === 'number');
  } catch {
    return [];
  }
}

function saveSeenIds(user: string, ids: number[]) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(getSeenStorageKey(user), JSON.stringify(ids));
  window.dispatchEvent(new Event(UPDATE_EVENT));
}

function getIncomingMessagesForUser(user: string): ChatRequestMessage[] {
  const viewer = user.trim().toLowerCase();
  if (!viewer) {
    return [];
  }

  return loadChatMessages().filter((message) => message.recipient.toLowerCase() === viewer);
}

export function getUnreadIncomingMessages(user: string): ChatRequestMessage[] {
  const incoming = getIncomingMessagesForUser(user);
  const seen = new Set(loadSeenIds(user));
  return incoming.filter((message) => !seen.has(message.id));
}

export function markIncomingNotificationsAsSeen(user: string) {
  const incoming = getIncomingMessagesForUser(user);
  if (incoming.length === 0) {
    return;
  }

  const seen = new Set(loadSeenIds(user));
  let changed = false;

  incoming.forEach((message) => {
    if (!seen.has(message.id)) {
      seen.add(message.id);
      changed = true;
    }
  });

  if (changed) {
    saveSeenIds(user, Array.from(seen));
  }
}
