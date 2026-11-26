import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { Card, KV, Field, Button, SectionTitle, Segmented, BranchField, s } from './ui';
import { useAuth } from './AuthContext';
import { useCart, lineName } from './CartContext';
import { usePrintBill } from './PrintBill';
import { api } from '../services/api';
import { newOrderRef, localTime, queueOrder, sendQueued } from '../services/offlineOrders';
import { money, qtyLabel } from '../services/format';
import { round2, deliveryFee } from '../services/qty';
import { colors } from '../theme';

/*
  Staff checkout, shared by the checkout screen (PosOrderScreen) and the tablet order panel (PanelCheckout):
  takeaway/delivery, customer, discount, tax and service charge, and the money worked out the same way as the server.
  Money: discount on items + delivery; tax and service charge (fixed or %) on what is left.
*/
const DRAFT_KEYS = { name: 1, phone: 1, address: 1, note: 1, fulfilment: 1 };
// Only the details that were given (voice ordering leaves the rest as they are)
const draftFields = (d) => Object.fromEntries(Object.entries(d || {}).filter(([k, v]) => k in DRAFT_KEYS && v));

// lines: [{ item_id, size, qty, price }]; editing: the placed order being changed, or null for a new order
// lines' name already includes the size (lineName)
export function usePosForm({ lines, editing = null }) {
  const { shop, user, branches } = useAuth();
  const cart = useCart();
  // One ref per order being taken: trying again after a lost answer never makes a second order
  const [ref] = useState(newOrderRef);
  const [f, setF] = useState({
    fulfilment: editing?.fulfilment || 'pickup', name: '', phone: '', address: '', note: '', branch_id: 0,
    // New order: customer details already given by voice
    ...(!editing ? draftFields(cart.draft) : {}),
    // Editing: the order's own values. New order: tax / service charge start from the shop's defaults (Shop settings)
    ...Object.fromEntries(['discount', 'tax', 'service'].flatMap((k) => {
      const from = editing || (k === 'discount' ? null : shop);
      return [
        [`${k}_type`, from?.[`${k}_type`] || ''],
        [`${k}_value`, Number(from?.[`${k}_value`]) > 0 ? String(from[`${k}_value`]) : ''],
      ];
    })),
  });
  const set = (k) => (v) => {
    setF((p) => ({ ...p, [k]: v }));
    // Keep voice ordering in step with what was typed here
    if (!editing && k in DRAFT_KEYS) cart.setDraft({ [k]: v }, true);
  };

  // Voice ordering changed the customer details (e.g. "number 0300... add kar do")
  useEffect(() => {
    if (!editing) setF((p) => ({ ...p, ...draftFields(cart.draft) }));
  }, [cart.draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const subtotal = round2(lines.reduce((a, l) => a + round2(l.qty * l.price), 0));
  const fee = editing ? Number(editing.delivery_fee) || 0 : deliveryFee(shop, subtotal, f.fulfilment);
  const base = round2(subtotal + fee);
  const adj = (k, on) => {
    const type = f[`${k}_type`];
    const value = Number(f[`${k}_value`]) || 0;
    const amount = !type || value <= 0 ? 0 : round2(type === 'percent' ? on * Math.min(value, 100) / 100 : (k === 'discount' ? Math.min(value, on) : value));
    const error = type === 'percent' && value > 100 ? 'At most 100%' : k === 'discount' && type === 'fixed' && value > on ? `At most ${money(on)}` : null;
    return { type, value, amount, error, pct: type === 'percent' && amount > 0 ? ` (${value}%)` : '' };
  };
  const disc = adj('discount', base);
  const after = round2(base - disc.amount);
  const tax = adj('tax', after);
  const service = adj('service', after);
  const total = round2(after + tax.amount + service.amount);
  const moneyError = disc.error || tax.error || service.error;
  const needsContact = !editing && f.fulfilment === 'delivery' && (!f.phone.trim() || !f.address.trim());

  // What the server takes: items + the charges that come to something.
  // price / delivery_fee only count for an order sent later from this device (offline), so its bill and the server agree
  const payload = () => ({
    items: lines.map((l) => ({ item_id: l.item_id, size: l.size || '', qty: l.qty, price: l.price })),
    ...Object.fromEntries([['discount', disc], ['tax', tax], ['service', service]].flatMap(([k, a]) => [
      [`${k}_type`, a.amount > 0 ? a.type : ''], [`${k}_value`, a.amount > 0 ? a.value : 0],
    ])),
  });
  const placePayload = () => ({
    ...payload(), fulfilment: f.fulfilment, name: f.name, phone: f.phone, address: f.address, note: f.note, branch_id: f.branch_id,
    delivery_fee: fee, offline_ref: ref,
  });

  // The bill of an order kept on this device (no internet): same fields as the server's order
  const localOrder = () => {
    const branch = (branches || []).find((b) => Number(b.id) === Number(f.branch_id)) || user?.branch;
    const charge = (k, a) => ({ [`${k}_type`]: a.amount > 0 ? a.type : '', [`${k}_value`]: a.amount > 0 ? a.value : 0, [k]: a.amount });
    return {
      id: 0, order_no: `OFFLINE-${ref.slice(-6)}`, offline_ref: ref, offline: true, created_at: localTime(), status: 'confirmed',
      fulfilment: f.fulfilment, name: f.name.trim() || 'Walk-in customer', phone: f.phone, address: f.fulfilment === 'delivery' ? f.address : '', note: f.note,
      payment_method: 'cod', payment_status: '', branch_name: branch?.name || '',
      items: lines.map((l) => ({ name: l.name, size: l.size || '', unit: l.unit, qty: l.qty, price: l.price, line_total: round2(l.qty * l.price) })),
      subtotal, delivery_fee: fee, ...charge('discount', disc), ...charge('tax', tax), ...charge('service', service), total, refunded: 0,
    };
  };

  return { f, set, editing, subtotal, fee, disc, tax, service, total, moneyError, needsContact, payload, placePayload, localOrder };
}

/*
  Place a new staff order. No internet (or no answer in 20 s): it is kept on this device and sent when the
  internet is back; returns { order, message, offline: true } with the device's bill.
*/
export async function placeStaffOrder(form) {
  const payload = form.placePayload();
  try {
    const r = await api.posPlace(payload);
    sendQueued(); // online again: send any orders kept on this device too
    return { ...r, offline: false };
  } catch (e) {
    if (!e.offline) throw e;
    const order = form.localOrder();
    await queueOrder({ payload, order });
    return { order, offline: true, message: 'No internet: order saved on this device' };
  }
}

// Placing / saving failed. Plan limit reached: tap the message to see the plan and upgrade
export function orderErrorToast(e, navigation, editing) {
  const limit = e.data?.plan_limit;
  Toast.show({ type: 'error', text1: limit ? 'Monthly order limit reached' : editing ? 'Could not update the order' : 'Could not place the order', text2: e.message, visibilityTime: limit ? 10000 : 7000,
    onPress: limit ? () => { Toast.hide(); navigation.navigate('Plan'); } : undefined });
}

// Customer (new orders), tax, service charge, discount and the totals
export function CheckoutFields({ form }) {
  const { shop, isOwner } = useAuth();
  const { f, set, editing, subtotal, fee, disc, tax, service, total } = form;
  return (
    <>
      {!editing && (
        <>
          <SectionTitle>Customer</SectionTitle>
          <Segmented value={f.fulfilment} onChange={set('fulfilment')}
            options={[{ value: 'pickup', label: 'Takeaway / counter' }, ...(shop?.delivery !== false ? [{ value: 'delivery', label: 'Delivery' }] : [])]} />
          <Field label="Name" value={f.name} onChangeText={set('name')} placeholder="Walk-in customer" />
          <Field label={f.fulfilment === 'delivery' ? 'Phone' : 'Phone (optional)'} value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad"
            hint="A customer with this phone sees the order in their account" />
          {f.fulfilment === 'delivery' && <Field label="Delivery address" value={f.address} onChangeText={set('address')} multiline />}
          <Field label="Note for the kitchen (optional)" value={f.note} onChangeText={set('note')} placeholder="e.g. extra spicy" />
          {isOwner && <BranchField value={f.branch_id} onChange={set('branch_id')} label="Branch" />}
        </>
      )}

      <AdjustField title="Tax" k="tax" f={f} set={set} a={tax} hint="Added on the total after the discount" />
      <AdjustField title="Service charge" k="service" f={f} set={set} a={service} hint="Added on the total after the discount" />
      {/* Last, just above the total: the discount still comes off items + delivery before tax / service charge */}
      <AdjustField title="Discount" k="discount" f={f} set={set} a={disc} hint="Taken off the order total (items + delivery)" />

      <Card>
        <KV label="Items" value={money(subtotal)} />
        {(f.fulfilment === 'delivery' || fee > 0) && <KV label="Delivery" value={fee ? money(fee) : 'Free'} />}
        {disc.amount > 0 && <KV label={`Discount${disc.pct}`} value={`-${money(disc.amount)}`} tone="bad" />}
        {tax.amount > 0 && <KV label={`Tax${tax.pct}`} value={`+${money(tax.amount)}`} />}
        {service.amount > 0 && <KV label={`Service charge${service.pct}`} value={`+${money(service.amount)}`} />}
        <KV label="Total" value={money(total)} bold />
      </Card>
    </>
  );
}

// None / fixed amount / % with its value (discount, tax, service charge — all 0 by default)
function AdjustField({ title, k, f, set, a, hint }) {
  const type = f[`${k}_type`];
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <Segmented value={type} onChange={set(`${k}_type`)}
        options={[{ value: '', label: 'None' }, { value: 'fixed', label: 'Amount' }, { value: 'percent', label: '%' }]} />
      {!!type && (
        <Field label={type === 'percent' ? `${title} %` : `${title} amount`} value={f[`${k}_value`]} onChangeText={set(`${k}_value`)}
          keyboardType="decimal-pad" placeholder="0" error={a.error}
          hint={a.amount > 0 ? `${hint}: ${money(a.amount)}` : hint} testID={`${k}-value`} />
      )}
    </>
  );
}

/*
  Tablet: the checkout in the order panel, in place of the cart items, so the order is finished on the shop screen.
  Placing it prints the bill (Shop settings → Bill printing) and empties the panel for the next order.
*/
export function PanelCheckout({ width, onBack, bottomInset = true }) {
  const cart = useCart();
  const { shop } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { print } = usePrintBill();
  const form = usePosForm({ lines: cart.lines.map((l) => ({ ...l, name: lineName(l) })) });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const r = await placeStaffOrder(form);
      cart.clear();
      onBack();
      const later = r.offline ? 'It is sent to the server when the internet is back.' : '';
      if (shop?.bill_print !== 'manual') {
        Toast.show({ type: r.offline ? 'info' : 'success', text1: r.message, text2: later || undefined, visibilityTime: r.offline ? 6000 : 4000 });
        print(r.order);
      } else {
        // The shop prints only with the button: offer it here, as there is no order screen to press it on
        Toast.show({ type: r.offline ? 'info' : 'success', text1: r.message, text2: `${later ? `${later} ` : ''}Tap here to print the bill`, visibilityTime: 7000,
          onPress: () => { Toast.hide(); print(r.order); } });
      }
    } catch (e) {
      orderErrorToast(e, navigation, false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={[st.panel, { width, paddingBottom: 12 + (bottomInset ? insets.bottom : 0) }]} testID="panel-checkout-form">
      <View style={st.head}>
        <TouchableOpacity onPress={onBack} hitSlop={10} style={st.back} testID="panel-checkout-back">
          <Ionicons name="arrow-back" size={18} color={colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>Checkout</Text>
          <Text style={st.sub}>{cart.count} item{cart.count === 1 ? '' : 's'} · tap back to change them</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
        <Card style={{ paddingVertical: 4 }}>
          {cart.lines.map((l, i) => (
            <View key={`${l.item_id}|${l.size || ''}`} style={{ flexDirection: 'row', gap: 8, paddingVertical: 7, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
              <Text style={{ flex: 1, color: colors.text }}><Text style={{ fontWeight: '800' }}>{qtyLabel(l.qty, l.unit)}</Text>  {lineName(l)}</Text>
              <Text style={{ fontWeight: '700', color: colors.text }}>{money(round2(l.qty * l.price))}</Text>
            </View>
          ))}
        </Card>
        <CheckoutFields form={form} />
      </ScrollView>

      <View style={st.foot}>
        {form.needsContact && <Text style={[s.itemMeta, { marginBottom: 8, color: colors.danger }]}>Delivery needs the customer's phone and address.</Text>}
        <Button testID="panel-place" title={`Place order · ${money(form.total)}`} icon="checkmark-circle-outline"
          onPress={submit} loading={saving} disabled={!cart.count || !!form.moneyError || form.needsContact} />
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  panel: {
    backgroundColor: '#fff', borderLeftWidth: 1, borderLeftColor: colors.border, paddingHorizontal: 14, paddingTop: 14,
    shadowColor: colors.shadow, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: -3, height: 0 }, elevation: 6,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  back: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  title: { fontSize: 19, fontWeight: '900', color: colors.black },
  sub: { color: colors.muted, fontSize: 13, marginTop: 1 },
  foot: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
});
