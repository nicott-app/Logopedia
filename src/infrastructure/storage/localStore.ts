export const localStore = {
  getCollection<T>(key: string): T[] {
    try {
      const data = localStorage.getItem(`logopedia_${key}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  setCollection<T>(key: string, items: T[]): void {
    try {
      localStorage.setItem(`logopedia_${key}`, JSON.stringify(items));
    } catch (e) {
      console.warn("Local storage write error:", e);
    }
  },

  getItem<T extends { id: string }>(key: string, id: string): T | null {
    const list = this.getCollection<T>(key);
    return list.find(i => i.id === id) || null;
  },

  saveItem<T extends { id: string }>(key: string, item: T): void {
    const list = this.getCollection<T>(key);
    const index = list.findIndex(i => i.id === item.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...item };
    } else {
      list.push(item);
    }
    this.setCollection(key, list);
  },

  deleteItem(key: string, id: string): void {
    const list = this.getCollection<{ id: string }>(key);
    const updated = list.filter(i => i.id !== id);
    this.setCollection(key, updated);
  }
};
