import React, { useState } from 'react';
import { View, Text, Image, ScrollView, KeyboardAvoidingView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Field, Button, Card } from '../components/ui';
import { useAuth } from '../components/AuthContext';
import { APP_NAME } from '../config';
import { colors } from '../theme';

// New shops sign up with us (MasterPOS team), not in the app
const SIGNUP_PHONE = '03460364457';
const SIGNUP_LABEL = '0346 0364457';
const SIGNUP_WHATSAPP = '923460364457';

const ROLES = [
  { icon: 'storefront-outline', label: 'Owner' },
  { icon: 'business-outline', label: 'Branch admin' },
  { icon: 'calculator-outline', label: 'Cashier' },
  { icon: 'restaurant-outline', label: 'Kitchen' },
  { icon: 'bicycle-outline', label: 'Rider' },
];

// MasterPOS: the same staff logins as each shop's own app (owner, branch admin, cashier, kitchen, rider).
// The login decides the shop; the app then works as that shop's app. Customers don't log in here.
export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const user = await login(email, password);
      Toast.show({ type: 'success', text1: `Welcome, ${user.name?.split(' ')[0] || ''}` });
      // The app switches to this login's screens by itself (App.js remounts the stack)
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not log in', text2: e.message, visibilityTime: 6000 });
    } finally {
      setBusy(false);
    }
  };

  const open = (url) => Linking.openURL(url).catch(() => Toast.show({ type: 'error', text1: 'Could not open', text2: `Call us on ${SIGNUP_LABEL}` }));

  const ok = /^\S+@\S+\.\S+$/.test(email.trim()) && password;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior="padding">
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 + insets.bottom }} keyboardShouldPersistTaps="handled">
        <View style={[st.hero, { paddingTop: 36 + insets.top }]}>
          <View style={st.ring}><Image source={require('../assets/adaptive-icon.png')} style={st.logo} /></View>
          <Text style={st.brand}>{APP_NAME}</Text>
          <Text style={st.tagline}>One app for every shop's team</Text>
        </View>

        <View style={st.body}>
          <Card style={st.card}>
            <Text style={st.title}>Staff login</Text>
            <Text style={st.sub}>Use the email and password from your shop's app.</Text>
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
              placeholder="you@example.com" testID="login-id" />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••"
              onSubmitEditing={ok ? submit : undefined} testID="login-password" />
            <Button testID="login-submit" title="Log in" icon="log-in-outline" onPress={submit} loading={busy} disabled={!ok} />
            <Text style={st.link} onPress={() => navigation.navigate('ForgotPassword', { email })}>Forgot password?</Text>
          </Card>

          <Text style={st.who}>Works for</Text>
          <View style={st.roles}>
            {ROLES.map((r) => (
              <View key={r.label} style={st.role}>
                <Ionicons name={r.icon} size={15} color={colors.primary} />
                <Text style={st.roleText}>{r.label}</Text>
              </View>
            ))}
          </View>

          <Card style={st.signup}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={st.signupIcon}><Ionicons name="storefront" size={22} color={colors.onBrand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={st.signupTitle}>Want MasterPOS for your shop?</Text>
                <Text style={st.sub}>Contact us to register your shop or restaurant.</Text>
              </View>
            </View>
            <Text style={st.signupPhone} selectable>{SIGNUP_LABEL}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity testID="signup-call" style={[st.signupBtn, { backgroundColor: colors.brand }]} onPress={() => open(`tel:${SIGNUP_PHONE}`)}>
                <Ionicons name="call" size={18} color={colors.onBrand} />
                <Text style={[st.signupBtnText, { color: colors.onBrand }]}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="signup-whatsapp" style={[st.signupBtn, { backgroundColor: '#25D366' }]}
                onPress={() => open(`https://wa.me/${SIGNUP_WHATSAPP}?text=${encodeURIComponent('Hi, I want to register my shop on MasterPOS.')}`)}>
                <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                <Text style={[st.signupBtnText, { color: '#fff' }]}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  hero: {
    alignItems: 'center', paddingBottom: 64, backgroundColor: colors.brand,
    borderBottomLeftRadius: 36, borderBottomRightRadius: 36,
  },
  ring: {
    width: 104, height: 104, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  logo: { width: 88, height: 88, borderRadius: 26 },
  brand: { fontSize: 30, fontWeight: '900', color: colors.onBrand, marginTop: 14, letterSpacing: 0.5 },
  tagline: { fontSize: 14, color: colors.onBrand, opacity: 0.75, fontWeight: '600', marginTop: 2 },
  body: { paddingHorizontal: 16, marginTop: -40, width: '100%', maxWidth: 480, alignSelf: 'center' },
  card: { padding: 20, borderRadius: 24 },
  title: { fontSize: 22, fontWeight: '900', color: colors.black },
  sub: { color: colors.muted, marginTop: 2, marginBottom: 16 },
  link: { color: colors.primary, fontWeight: '700', textAlign: 'center', marginTop: 16 },
  who: { fontSize: 12, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', marginTop: 10, marginBottom: 10 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  role: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft,
  },
  roleText: { fontSize: 13, fontWeight: '700', color: colors.primaryDark },
  signup: { padding: 16, borderRadius: 20, marginTop: 18 },
  signupIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  signupTitle: { fontSize: 16, fontWeight: '900', color: colors.black },
  signupPhone: { fontSize: 24, fontWeight: '900', color: colors.primary, textAlign: 'center', letterSpacing: 1, marginVertical: 12 },
  signupBtn: { flex: 1, height: 46, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  signupBtnText: { fontWeight: '800', fontSize: 15 },
});
