export function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toDateInputValue(date = new Date()) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}
