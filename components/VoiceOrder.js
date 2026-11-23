import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { s } from './ui';
import { useCart, lineName } from './CartContext';
import { api } from '../services/api';
import { qtyLabel } from '../services/format';
import { colors } from '../theme';

/*
  Voice ordering for owner / branch admin / cashier: "masterpos add small doner pizza 2 qty",
  "shawarma 4 piece add kar do", "customer ka number 0300... aur address ... add kar do", "order place kar do".
  The phone turns speech into text (expo-speech-recognition, needs a dev / store build: not in Expo Go);
  the server (Claude) maps it to the shop's items. Typing a command works everywhere.
*/
let Speech = null;
try {
  // eslint-disable-next-line global-require
  Speech = require('expo-speech-recognition');
  if (!Speech?.ExpoSpeechRecognitionModule) Speech = null;
} catch (_) {
  Speech = null; // Expo Go: no native module
}
export const voiceAvailable = !!Speech;

const LANGS = [{ value: 'en-US', label: 'English / Roman Urdu' }, { value: 'ur-PK', label: 'اردو' }];
const LANG_KEY = 'voice_lang';

// Applies the server's answer to the cart; returns lines describing what changed
function applyResult(r, cart) {
  const done = [];
  const byId = Object.fromEntries((r.products || []).map((p) => [p.id, p]));
  if (r.clear_cart) { cart.clear(); done.push({ icon: 'trash-outline', text: 'Cart emptied' }); }
  // Lines as they will be after each action (cart state updates later)
  let lines = r.clear_cart ? [] : cart.lines.map((l) => ({ ...l }));
  const find = (id, size) => {
    const exact = lines.filter((l) => l.item_id === id && (l.size || '') === (size || ''));
    if (exact.length) return exact;
    return size ? [] : lines.filter((l) => l.item_id === id); // no size said: whichever size is in the cart
  };
  (r.actions || []).forEach((a) => {
    const p = byId[a.item_id];
    if (!p) return;
    const name = a.size ? `${p.name} (${a.size})` : p.name;
    if (a.type === 'add') {
      cart.add(p, a.qty, a.size);
      const at = lines.find((l) => l.item_id === p.id && (l.size || '') === a.size);
      if (at) at.qty += a.qty; else lines.push({ item_id: p.id, size: a.size, name: p.name, qty: a.qty });
      done.push({ icon: 'add-circle', text: `${qtyLabel(a.qty, p.unit)}  ${name}` });
    } else {
      const hits = find(p.id, a.size);
      if (a.type === 'set_qty' && hits.length <= 1) {
        const size = hits[0] ? hits[0].size || '' : (a.size || p.sizes?.[0]?.name || '');
        cart.setQty(p.id, a.qty, p, size);
        lines = lines.filter((l) => !(l.item_id === p.id && (l.size || '') === size)).concat([{ item_id: p.id, size, name: p.name, qty: a.qty }]);
        done.push({ icon: 'create-outline', text: `${lineName({ name: p.name, size })} → ${qtyLabel(a.qty, p.unit)}` });
      } else if (a.type === 'remove' && hits.length) {
        hits.forEach((l) => cart.remove(p.id, l.size || ''));
        lines = lines.filter((l) => !hits.includes(l));
        done.push({ icon: 'remove-circle', text: `Removed ${hits.length > 1 ? p.name : lineName({ name: p.name, size: hits[0].size })}`, bad: true });
      } else if (a.type === 'set_qty') {
        done.push({ icon: 'help-circle-outline', text: `Which size of ${p.name}? Say the size too`, bad: true });
      }
    }
  });
  const c = r.customer || {};
  const fields = { name: c.name, phone: c.phone, address: c.address, note: c.note, fulfilment: c.fulfilment };
  cart.setDraft(fields);
  if (c.name) done.push({ icon: 'person-outline', text: `Customer: ${c.name}` });
  if (c.phone) done.push({ icon: 'call-outline', text: `Phone: ${c.phone}` });
  if (c.address) done.push({ icon: 'location-outline', text: `Address: ${c.address}` });
  if (c.note) done.push({ icon: 'chatbox-outline', text: `Note: ${c.note}` });
  if (c.fulfilment) done.push({ icon: c.fulfilment === 'delivery' ? 'bicycle-outline' : 'bag-handle-outline', text: c.fulfilment === 'delivery' ? 'Delivery order' : 'Takeaway order' });
  (r.not_found || []).forEach((w) => done.push({ icon: 'alert-circle-outline', text: `Not found: "${w}"`, bad: true }));
  return { done, count: lines.length };
}

/*
  Floating mic for the screens where orders are taken. onOrder(place): open the staff checkout
  (place = true: they said "order place kar do", so it asks to confirm and places it). bottom: room for the screen's footer.
*/
export function VoiceOrderButton({ onOrder, bottom = 96, right = 16 }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity testID="voice-open" activeOpacity={0.85} onPress={() => setOpen(true)}
        style={[st.fab, { bottom: bottom + insets.bottom, right }]}>
        <Ionicons name="mic" size={26} color={colors.onBrand} />
      </TouchableOpacity>
      <VoiceSheet visible={open} onClose={() => setOpen(false)} onOrder={(place) => { setOpen(false); onOrder?.(place); }} />
    </>
  );
}

function VoiceSheet({ visible, onClose, onOrder }) {
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const [lang, setLang] = useState('en-US');
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]); // { said, reply, done, error }
  const heardRef = useRef('');
  const sentRef = useRef(false);
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => { AsyncStorage.getItem(LANG_KEY).then((v) => v && setLang(v)).catch(() => {}); }, []);
  const pickLang = (v) => { setLang(v); AsyncStorage.setItem(LANG_KEY, v).catch(() => {}); };

  useEffect(() => {
    if (!listening) { pulse.stopAnimation(); pulse.setValue(0); return undefined; }
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [listening, pulse]);

  const run = useCallback(async (text) => {
    const said = (text || '').trim();
    if (!said) return;
    setBusy(true);
    const c = cartRef.current;
    try {
      const r = await api.posVoice(
        said,
        c.lines.map((l) => ({ item_id: l.item_id, size: l.size || '', qty: l.qty })),
        c.draft,
      );
      const { done, count } = applyResult(r, c);
      setLog((prev) => [{ said, reply: r.reply, done }, ...prev].slice(0, 8));
      if (r.place_order) {
        if (!count) Toast.show({ type: 'error', text1: 'The cart is empty', text2: 'Add items before placing the order.' });
        else onOrder?.(true);
      }
    } catch (e) {
      setLog((prev) => [{ said, error: e.message }, ...prev].slice(0, 8));
    } finally {
      setBusy(false);
    }
  }, [onOrder]);

  // Speech events (only when the native module is in this build)
  useEffect(() => {
    if (!Speech) return undefined;
    const subs = [
      Speech.addSpeechRecognitionListener('start', () => { setListening(true); setHeard(''); heardRef.current = ''; sentRef.current = false; }),
      Speech.addSpeechRecognitionListener('result', (e) => {
        const t = e.results?.[0]?.transcript || '';
        heardRef.current = t;
        setHeard(t);
        if (e.isFinal && t && !sentRef.current) { sentRef.current = true; run(t); }
      }),
      Speech.addSpeechRecognitionListener('end', () => {
        setListening(false);
        if (heardRef.current && !sentRef.current) { sentRef.current = true; run(heardRef.current); }
      }),
      Speech.addSpeechRecognitionListener('error', (e) => {
        setListening(false);
        if (e.error === 'no-speech' || e.error === 'speech-timeout' || e.error === 'aborted') return;
        Toast.show({ type: 'error', text1: 'Could not listen', text2: e.message || e.error, visibilityTime: 5000 });
      }),
    ];
    return () => subs.forEach((x) => x?.remove?.());
  }, [run]);

  const listen = async () => {
    if (!Speech) {
      Toast.show({ type: 'info', text1: 'Speaking needs the installed app', text2: 'In Expo Go, type the command instead.', visibilityTime: 5000 });
      return;
    }
    const M = Speech.ExpoSpeechRecognitionModule;
    if (listening) { M.stop(); return; }
    try {
      const perm = await M.requestPermissionsAsync();
      if (!perm.granted) {
        Toast.show({ type: 'error', text1: 'Microphone not allowed', text2: 'Allow the microphone for MasterPOS in the phone settings.' });
        return;
      }
      M.start({
        lang,
        interimResults: true,
        continuous: false,
        addsPunctuation: false,
        // Help the recogniser with the wake word and what's already in the order
        contextualStrings: ['masterpos', 'add kar do', 'order place kar do', ...cartRef.current.lines.map((l) => l.name)].slice(0, 100),
      });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not listen', text2: e.message });
    }
  };

  // Start listening as soon as the sheet opens; stop when it closes
  useEffect(() => {
    if (visible && Speech) listen();
    if (!visible && Speech && listening) Speech.ExpoSpeechRecognitionModule.abort();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = () => { const t = typed; setTyped(''); run(t); };
  const ring = { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }], opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }) };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalBack}>
        <View style={[s.sheet, { maxHeight: '88%', paddingBottom: 12 + insets.bottom }]}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>Voice order</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
          </View>

          <View style={st.langs}>
            {LANGS.map((l) => (
              <TouchableOpacity key={l.value} onPress={() => pickLang(l.value)} style={[st.lang, lang === l.value && st.langOn]}>
                <Text style={[st.langText, lang === l.value && st.langTextOn]}>{l.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={st.micWrap}>
            {listening && <Animated.View style={[st.ring, ring]} />}
            <TouchableOpacity testID="voice-mic" activeOpacity={0.85} onPress={listen} disabled={busy}
              style={[st.mic, listening && { backgroundColor: colors.danger }, !Speech && { opacity: 0.5 }]}>
              {busy ? <ActivityIndicator color={colors.onBrand} /> : <Ionicons name={listening ? 'stop' : 'mic'} size={34} color={listening ? '#fff' : colors.onBrand} />}
            </TouchableOpacity>
          </View>
          <Text style={st.status}>
            {busy ? 'Working it out…' : listening ? (heard || 'Listening… speak now') : Speech ? 'Tap the mic and speak' : 'Type a command below (speaking works in the installed app)'}
          </Text>

          <View style={st.typeRow}>
            <TextInput testID="voice-text" value={typed} onChangeText={setTyped} placeholder="e.g. 2 small doner pizza add kar do"
              placeholderTextColor={colors.faint} style={st.input} returnKeyType="send" onSubmitEditing={send} editable={!busy} />
            <TouchableOpacity testID="voice-send" onPress={send} disabled={busy || !typed.trim()} style={[st.send, (busy || !typed.trim()) && { opacity: 0.4 }]}>
              <Ionicons name="send" size={18} color={colors.onBrand} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ marginTop: 12 }} keyboardShouldPersistTaps="handled">
            {!log.length && (
              <View style={st.tips}>
                <Text style={st.tipsTitle}>Try saying</Text>
                {['masterpos add small doner pizza 2 qty', 'shawarma 4 piece add kar do', 'customer ka naam Ali, number 0300 1234567', 'address House 5, Street 2 Model Town, delivery', 'zinger burger hata do', 'order place kar do'].map((t) => (
                  <Text key={t} style={st.tip} onPress={() => setTyped(t)}>“{t}”</Text>
                ))}
              </View>
            )}
            {log.map((e, i) => (
              <View key={i} style={[st.entry, i > 0 && { opacity: 0.7 }]}>
                <Text style={st.said}>“{e.said}”</Text>
                {e.error ? <Text style={{ color: colors.danger, marginTop: 4 }}>{e.error}</Text> : (
                  <>
                    {!!e.reply && <Text style={st.reply}>{e.reply}</Text>}
                    {e.done.map((d, j) => (
                      <View key={j} style={st.doneRow}>
                        <Ionicons name={d.icon} size={16} color={d.bad ? colors.danger : colors.primary} />
                        <Text style={[st.doneText, d.bad && { color: colors.danger }]}>{d.text}</Text>
                      </View>
                    ))}
                    {!e.done.length && <Text style={s.itemMeta}>Nothing changed</Text>}
                  </>
                )}
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity testID="voice-review" onPress={() => onOrder?.(false)} disabled={!cart.lines.length} style={[st.checkout, !cart.lines.length && { opacity: 0.4 }]}>
            <Ionicons name="receipt-outline" size={18} color={colors.primary} />
            <Text style={st.checkoutText}>{cart.lines.length ? `Review order · ${cart.lines.length} item${cart.lines.length > 1 ? 's' : ''}` : 'Cart is empty'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  fab: {
    position: 'absolute', right: 16, width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center', elevation: 6,
    shadowColor: colors.shadow, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  langs: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 4 },
  lang: { paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, justifyContent: 'center' },
  langOn: { backgroundColor: colors.primary },
  langText: { fontWeight: '700', color: colors.primaryDark },
  langTextOn: { color: '#fff' },
  micWrap: { alignItems: 'center', justifyContent: 'center', height: 120, marginTop: 8 },
  ring: { position: 'absolute', width: 88, height: 88, borderRadius: 44, backgroundColor: colors.danger },
  mic: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  status: { textAlign: 'center', color: colors.text, fontWeight: '600', minHeight: 22, paddingHorizontal: 8 },
  typeRow: { flexDirection: 'row', gap: 8, marginTop: 14, alignItems: 'center' },
  input: {
    flex: 1, height: 46, borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#f7fbf8', borderWidth: 1, borderColor: colors.border, color: colors.text,
  },
  send: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  tips: { padding: 12, borderRadius: 14, backgroundColor: colors.primarySoft },
  tipsTitle: { fontWeight: '800', color: colors.primaryDark, marginBottom: 6 },
  tip: { color: colors.text, paddingVertical: 4 },
  entry: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  said: { color: colors.muted, fontStyle: 'italic' },
  reply: { color: colors.text, fontWeight: '800', marginTop: 4 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  doneText: { color: colors.text, flex: 1 },
  checkout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, marginTop: 10, borderRadius: 14, borderWidth: 1.5, borderColor: colors.primary },
  checkoutText: { color: colors.primary, fontWeight: '800' },
});
