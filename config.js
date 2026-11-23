// MasterPOS: one staff app for every shop on the shared backend. EXPO_PUBLIC_* values come from .env at build time.
export const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME || 'MasterPOS';
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://sialkotians.com';
// No built-in shop: the staff login tells the server which shop it is, and the server hands back that shop's key.
// Every later call sends it, exactly like a shop's own app.
let shopKey = '';
export const getShopKey = () => shopKey;
export const setShopKey = (k) => { shopKey = k || ''; };

// Developer promo under the login form (same in every shop's copy of the app)
export const DEVELOPER_PHONE = '03460364457';

// Play Store: public privacy policy page, shown in My account (set EXPO_PUBLIC_PRIVACY_URL; hidden while empty).
// Account deletion is done in the app, from My account.
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || '';
