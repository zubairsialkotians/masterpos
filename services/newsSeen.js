import AsyncStorage from '@react-native-async-storage/async-storage';
import { getShopKey } from '../config';

// Newest news id this phone has opened the News list for (drives the dot on the home icon)
const key = () => `news_seen_${getShopKey()}`;

export async function getNewsSeen() {
  try { return Number(await AsyncStorage.getItem(key())) || 0; } catch (_) { return 0; }
}

export async function markNewsSeen(id) {
  if (!id) return;
  try {
    if (id > (await getNewsSeen())) await AsyncStorage.setItem(key(), String(id));
  } catch (_) {}
}
