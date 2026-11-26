import React from 'react';
import { View, Text, Linking } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen, Card, KV, Button, ListItem, SectionTitle } from '../components/ui';
import { useAuth } from '../components/AuthContext';
import { MenuSyncCard } from '../components/MenuSync';
import { PrinterCard } from '../components/PrintBill';
import { OfflineOrdersCard } from '../components/OfflineOrders';
import { offlineStatus } from '../services/offlineOrders';
import { confirmAction } from '../services/confirm';
import { ROLE_LABELS } from '../services/format';
import { colors } from '../theme';
import { PRIVACY_URL, APP_NAME } from '../config';

// MasterPOS: the logged-in staff member, their shop, and log out (to log in to another shop)
export default function AccountScreen({ navigation }) {
  const { user, shop, isStaff, isTeam, isRider, isCashier, isSeller, logout, deleteAccount } = useAuth();

  // Google Play: the user can delete their account from inside the app
  const removeAccount = async () => {
    if (!(await confirmAction('Delete your account?', 'Your login is removed and you are logged out on every device. Shop records such as past orders and sales stay with the shop. This cannot be undone.', 'Delete account', true))) return;
    try { await deleteAccount(); } catch (e) { Toast.show({ type: 'error', text1: 'Could not delete the account', text2: e.message }); }
  };

  const signOut = async () => {
    // The app goes back to the login by itself
    // Orders taken offline stay on this device and are sent when this shop's staff log in here again
    const left = offlineStatus().orders.length;
    const warn = left ? ` ${left} order${left > 1 ? 's' : ''} taken offline ${left > 1 ? 'are' : 'is'} not sent yet: ${left > 1 ? 'they stay' : 'it stays'} on this device and ${left > 1 ? 'are' : 'is'} sent when someone from ${shop?.name || 'this shop'} logs in here again.` : '';
    if (await confirmAction('Log out?', `You can then log in to ${APP_NAME} with any shop's staff login.${warn}`, 'Log out', true)) await logout();
  };
  const call = () => Linking.openURL(`tel:${shop.phone}`);
  const openPrivacy = () => Linking.openURL(PRIVACY_URL);

  return (
    <Screen title="My account">
      <Card>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.black }}>{user.name}</Text>
        <Text style={{ color: colors.muted, marginBottom: 6 }}>{user.email}</Text>
        {!!user.phone && <KV label="Phone" value={user.phone} />}
        <KV label="Shop" value={shop?.name || ''} />
        <KV label="Role" value={`${ROLE_LABELS[user.role] || user.role}${user.branch ? ` · ${user.branch.name}` : ''}`} />
      </Card>
      {isStaff ? (
        <ListItem icon="speedometer-outline" title="Shop admin" subtitle="Orders, items, stock and reports" onPress={() => navigation.navigate('AdminHome')} />
      ) : isCashier ? (
        <ListItem icon="receipt-outline" title="My orders" subtitle="Take orders and manage the ones you took" onPress={() => navigation.navigate('AdminOrders')} />
      ) : isTeam ? (
        <ListItem icon={isRider ? 'bicycle-outline' : 'restaurant-outline'} title={isRider ? 'My deliveries' : 'Kitchen orders'} onPress={() => navigation.navigate('TeamHome')} />
      ) : null}
      {isSeller && <ListItem icon="ribbon-outline" title="Plan" subtitle="Orders and items this month, upgrade" onPress={() => navigation.navigate('Plan')} />}
      <ListItem icon="key-outline" title="Change password" onPress={() => navigation.navigate('Password')} />

      {/* Owner / branch admin / cashier take orders from the menu: keep a copy on this device if they want */}
      {isSeller && (
        <>
          <SectionTitle>Offline orders</SectionTitle>
          <OfflineOrdersCard />
          <SectionTitle>Menu on this device</SectionTitle>
          <MenuSyncCard />
          <SectionTitle>Printer on this device</SectionTitle>
          <PrinterCard />
        </>
      )}

      {!!shop?.phone && (
        <>
          <SectionTitle>Shop contact</SectionTitle>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title={`Call ${shop.name}`} icon="call-outline" variant="ghost" onPress={call} style={{ flex: 1 }} />
          </View>
        </>
      )}

      {!!PRIVACY_URL && (
        <>
          <SectionTitle>About</SectionTitle>
          <ListItem icon="shield-checkmark-outline" title="Privacy policy" onPress={openPrivacy} />
        </>
      )}

      <Button title="Log out" variant="danger" icon="log-out-outline" onPress={signOut} style={{ marginTop: 24 }} />
      <Button title="Delete my account" variant="outline" icon="trash-outline" onPress={removeAccount} style={{ marginTop: 12 }} />
    </Screen>
  );
}
