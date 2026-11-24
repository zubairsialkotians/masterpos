import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLoad } from './useData';
import { api } from '../services/api';
import { colors } from '../theme';

/*
  The shop's plan (MasterPOS): Free 5,000 orders a month / 500 items, Premium Rs 1,000 (10,000 / 1,000),
  Professional Rs 2,000 (100,000 / 10,000). Set by us in wp-admin; the server refuses orders / items over the limit.
*/
export const PLAN_PHONE = '03460364457';
const WHATSAPP = '923460364457';
const fmt = (n) => Number(n || 0).toLocaleString('en-US');

export function usePlan() {
  return useLoad(() => api.plan().then((r) => r.plan).catch(() => null));
}

export const askUpgrade = (planName) => Linking.openURL(
  `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hi, I want to upgrade my MasterPOS shop${planName ? ` to the ${planName} plan` : ''}.`)}`,
).catch(() => Linking.openURL(`tel:${PLAN_PHONE}`));

function Meter({ label, used, limit }) {
  const unlimited = !limit;
  const pct = unlimited ? 0 : Math.min(1, used / limit);
  const tone = pct >= 1 ? colors.danger : pct >= 0.8 ? colors.warning : colors.primary;
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={st.meterLabel}>{label}</Text>
        <Text style={[st.meterValue, pct >= 1 && { color: colors.danger }]}>{unlimited ? `${fmt(used)} · no limit` : `${fmt(used)} / ${fmt(limit)}`}</Text>
      </View>
      {!unlimited && (
        <View style={st.track}><View style={[st.fill, { width: `${Math.max(2, pct * 100)}%`, backgroundColor: tone }]} /></View>
      )}
      {pct >= 1 && <Text style={st.full}>Limit reached: upgrade to add more</Text>}
    </View>
  );
}

// Card with the plan and this month's use. compact: for the admin home (tap → Plan screen)
export function PlanCard({ plan, onPress, compact }) {
  if (!plan) return null;
  const near = (plan.orders_limit && plan.orders_used >= plan.orders_limit * 0.8) || (plan.items_limit && plan.items_used >= plan.items_limit * 0.8);
  return (
    <TouchableOpacity activeOpacity={onPress ? 0.8 : 1} onPress={onPress} style={[st.card, near && { borderColor: colors.warning }]} testID="plan-card">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={st.badge}><Ionicons name="ribbon-outline" size={20} color={colors.onBrand} /></View>
        <View style={{ flex: 1 }}>
          <Text style={st.name}>{plan.name} plan</Text>
          <Text style={st.sub}>{plan.price ? `Rs ${fmt(plan.price)} / month` : plan.key === 'unlimited' ? 'No limits' : 'Free'} · {plan.month}</Text>
        </View>
        {plan.upgrades?.length > 0 && <Text style={st.upgrade}>Upgrade</Text>}
        {onPress && <Ionicons name="chevron-forward" size={18} color={colors.faint} />}
      </View>
      <Meter label="Orders this month" used={plan.orders_used} limit={plan.orders_limit} />
      {!compact && <Meter label="Items" used={plan.items_used} limit={plan.items_limit} />}
      {compact && (
        <Text style={[st.sub, { marginTop: 6 }]}>Items: {plan.items_limit ? `${fmt(plan.items_used)} / ${fmt(plan.items_limit)}` : `${fmt(plan.items_used)} · no limit`}</Text>
      )}
    </TouchableOpacity>
  );
}

// All plans side by side, current one marked, with "Upgrade" (WhatsApp us)
export function PlanList({ plan }) {
  const all = [
    { key: 'free', name: 'Free', price: 0, orders: 5000, items: 500 },
    { key: 'premium', name: 'Premium', price: 1000, orders: 10000, items: 1000 },
    { key: 'professional', name: 'Professional', price: 2000, orders: 100000, items: 10000 },
  ];
  const current = all.find((p) => p.key === plan?.key);
  return (
    <View style={{ gap: 10 }}>
      {all.map((p) => {
        const on = p.key === plan?.key;
        const higher = !current || p.price > current.price;
        return (
          <View key={p.key} style={[st.option, on && st.optionOn]} testID={`plan-${p.key}`}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Text style={[st.name, on && { color: colors.primary }]}>{p.name}</Text>
              <Text style={st.price}>{p.price ? `Rs ${fmt(p.price)}` : 'Free'}<Text style={st.sub}>{p.price ? ' / month' : ''}</Text></Text>
            </View>
            <View style={st.row}><Ionicons name="receipt-outline" size={16} color={colors.primary} /><Text style={st.feature}>{fmt(p.orders)} orders a month</Text></View>
            <View style={st.row}><Ionicons name="pricetags-outline" size={16} color={colors.primary} /><Text style={st.feature}>Up to {fmt(p.items)} items</Text></View>
            {on ? (
              <View style={[st.cta, { backgroundColor: colors.primarySoft }]}><Ionicons name="checkmark-circle" size={18} color={colors.primary} /><Text style={[st.ctaText, { color: colors.primary }]}>Your plan</Text></View>
            ) : higher && plan?.key !== 'unlimited' ? (
              <TouchableOpacity style={st.cta} onPress={() => askUpgrade(p.name)} testID={`upgrade-${p.key}`}>
                <Ionicons name="logo-whatsapp" size={18} color={colors.onBrand} /><Text style={st.ctaText}>Upgrade to {p.name}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        );
      })}
      <Text style={[st.sub, { textAlign: 'center', marginTop: 4 }]}>To change your plan, WhatsApp or call us on 0346 0364457.</Text>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1.5, borderColor: 'transparent',
    shadowColor: colors.shadow, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  badge: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '900', color: colors.black },
  sub: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  upgrade: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  meterLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  meterValue: { fontSize: 13, fontWeight: '800', color: colors.text },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.primarySoft, marginTop: 5, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  full: { color: colors.danger, fontSize: 12, fontWeight: '700', marginTop: 4 },
  option: { backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1.5, borderColor: colors.border },
  optionOn: { borderColor: colors.primary, backgroundColor: '#f7fbf8' },
  price: { fontSize: 18, fontWeight: '900', color: colors.black },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  feature: { color: colors.text, fontWeight: '600' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 14, backgroundColor: colors.brand, marginTop: 12 },
  ctaText: { color: colors.onBrand, fontWeight: '800' },
});
