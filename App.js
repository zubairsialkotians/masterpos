import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import Toast from 'react-native-toast-message';

import { AuthProvider, useAuth } from './components/AuthContext';
import { CartProvider } from './components/CartContext';
import DismissKeyboard from './components/DismissKeyboard';
import { VoiceOrderButton } from './components/VoiceOrder';
import PrintHost from './components/PrintHost';
import { OfflineSync } from './components/OfflineOrders';
import { isSplit, panelWidth } from './components/CartPanel';
import { Button } from './components/ui';
import { APP_NAME } from './config';
import { colors } from './theme';

// The shop's catalogue, used by owner / branch admin / cashier to take orders (no customer checkout in MasterPOS)
import HomeScreen from './screens/HomeScreen';
import ProductScreen from './screens/ProductScreen';
import CartScreen from './screens/CartScreen';
import AccountScreen from './screens/AccountScreen';
import LoginScreen from './screens/LoginScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import PasswordScreen from './screens/PasswordScreen';
// Staff
import AdminHomeScreen from './screens/AdminHomeScreen';
import AdminOrdersScreen from './screens/AdminOrdersScreen';
import AdminOrderDetailScreen from './screens/AdminOrderDetailScreen';
import ReturnFormScreen from './screens/ReturnFormScreen';
import PosReturnScreen from './screens/PosReturnScreen';
import ReturnsScreen from './screens/ReturnsScreen';
import ReviewsScreen from './screens/ReviewsScreen';
import ItemsScreen from './screens/ItemsScreen';
import ItemFormScreen from './screens/ItemFormScreen';
import CategoriesScreen from './screens/CategoriesScreen';
import StockScreen from './screens/StockScreen';
import StockMovesScreen from './screens/StockMovesScreen';
import CustomersScreen from './screens/CustomersScreen';
import ExpensesScreen from './screens/ExpensesScreen';
import ExpenseFormScreen from './screens/ExpenseFormScreen';
import ReportsScreen from './screens/ReportsScreen';
import BillScreen from './screens/BillScreen';
import BranchesScreen from './screens/BranchesScreen';
import BranchFormScreen from './screens/BranchFormScreen';
import SettingsScreen from './screens/SettingsScreen';
import NewsScreen from './screens/NewsScreen';
import NewsDetailScreen from './screens/NewsDetailScreen';
import ContactScreen from './screens/ContactScreen';
import AdminNewsScreen from './screens/AdminNewsScreen';
import NewsFormScreen from './screens/NewsFormScreen';
import AdminBannersScreen from './screens/AdminBannersScreen';
import BannerFormScreen from './screens/BannerFormScreen';
// Kitchen & riders
import TeamHomeScreen from './screens/TeamHomeScreen';
import TeamOrderDetailScreen from './screens/TeamOrderDetailScreen';
import TeamScreen from './screens/TeamScreen';
import TeamFormScreen from './screens/TeamFormScreen';
import PosOrderScreen from './screens/PosOrderScreen';
import PlanScreen from './screens/PlanScreen';
import PurchasesScreen from './screens/PurchasesScreen';
import PurchaseFormScreen from './screens/PurchaseFormScreen';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

// Pushes carry { screen, params }: AdminOrderDetail for staff, TeamOrderDetail for kitchen/riders, MyOrderDetail for customers,
// NewsDetail for everyone (guests too). Waits for the navigator when the app was just launched.
function openFromNotification(response, tries = 0) {
  const data = response?.notification?.request?.content?.data;
  if (!data?.screen) return;
  if (!navigationRef.isReady()) {
    if (tries < 20) setTimeout(() => openFromNotification(response, tries + 1), 300);
    return;
  }
  try { navigationRef.navigate(data.screen, data.params || {}); } catch (_) {}
}

function NotificationListeners() {
  const { reloadShop } = useAuth();
  const handledLaunch = useRef(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const tapped = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    // News arriving while the app is open: refresh the shop so the news icon shows the new dot
    const received = Notifications.addNotificationReceivedListener((n) => {
      if (n?.request?.content?.data?.type === 'news') reloadShop();
    });
    if (!handledLaunch.current) {
      handledLaunch.current = true;
      Notifications.getLastNotificationResponseAsync().then((r) => r && openFromNotification(r)).catch(() => {});
    }
    return () => { tapped.remove(); received.remove(); };
  }, [reloadShop]);
  return null;
}

const ROUTES = {
  // Logged out: only the staff login
  guest: { Login: LoginScreen, ForgotPassword: ForgotPasswordScreen },
  // Every staff login
  common: { Account: AccountScreen, Password: PasswordScreen, Bill: BillScreen, News: NewsScreen, NewsDetail: NewsDetailScreen, Contact: ContactScreen },
  // Taking orders from the shop's catalogue
  catalogue: { Home: HomeScreen, Product: ProductScreen, Cart: CartScreen },
  staff: {
    AdminHome: AdminHomeScreen, AdminOrders: AdminOrdersScreen, AdminOrderDetail: AdminOrderDetailScreen,
    ReturnForm: ReturnFormScreen, Returns: ReturnsScreen, Reviews: ReviewsScreen, Items: ItemsScreen, ItemForm: ItemFormScreen,
    Categories: CategoriesScreen, Stock: StockScreen, StockMoves: StockMovesScreen, Customers: CustomersScreen,
    Expenses: ExpensesScreen, ExpenseForm: ExpenseFormScreen, Reports: ReportsScreen,
    Purchases: PurchasesScreen, PurchaseForm: PurchaseFormScreen,
  },
  // Taking orders in the app: owner, branch admin, cashier (the cashier's home is their orders list)
  seller: { AdminOrders: AdminOrdersScreen, AdminOrderDetail: AdminOrderDetailScreen, PosOrder: PosOrderScreen, PosReturn: PosReturnScreen, Plan: PlanScreen },
  // Kitchen / rider panel (the shop admin can open the kitchen board too)
  team: { TeamHome: TeamHomeScreen, TeamOrderDetail: TeamOrderDetailScreen },
  owner: { Team: TeamScreen, TeamForm: TeamFormScreen, Branches: BranchesScreen, BranchForm: BranchFormScreen, Settings: SettingsScreen, AdminNews: AdminNewsScreen, NewsForm: NewsFormScreen, AdminBanners: AdminBannersScreen, BannerForm: BannerFormScreen },
};

// Shown while the shop info loads on first launch (after the native splash)
function Splash({ shop, error, onRetry }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 24 }}>
      {shop?.logo_url
        ? <Image source={{ uri: shop.logo_url }} style={{ width: 120, height: 120, borderRadius: 24 }} resizeMode="contain" />
        : <Image source={require('./assets/icon.png')} style={{ width: 110, height: 110, borderRadius: 24 }} />}
      <Text style={{ fontSize: 26, fontWeight: '800', color: colors.primaryDark, marginTop: 16 }}>{shop?.name || APP_NAME}</Text>
      {error ? (
        <>
          <Text style={{ color: colors.danger, textAlign: 'center', marginTop: 16 }}>{error}</Text>
          <Button title="Try again" variant="outline" small onPress={onRetry} style={{ marginTop: 12 }} />
        </>
      ) : <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />}
    </View>
  );
}

function Routes() {
  const { ready, shop, shopError, reloadShop, session, isStaff, isTeam, isSeller, isOwner, homeRoute } = useAuth();

  // Staff / kitchen / rider logged in or out: start over on the right home (the container would otherwise keep the old stack)
  const wasHome = useRef(homeRoute);
  useEffect(() => {
    if (wasHome.current === homeRoute) return;
    wasHome.current = homeRoute;
    if (navigationRef.isReady()) navigationRef.reset({ index: 0, routes: [{ name: homeRoute }] });
  }, [homeRoute]);

  if (!ready || (session && !shop)) return <Splash shop={shop} error={ready ? shopError : null} onRetry={reloadShop} />;

  const screens = !session ? ROUTES.guest : {
    ...ROUTES.common,
    ...(isSeller ? ROUTES.catalogue : {}),
    ...(isStaff ? ROUTES.staff : {}),
    ...(isSeller ? ROUTES.seller : {}),
    ...(isStaff || isTeam ? ROUTES.team : {}),
    ...(isOwner ? ROUTES.owner : {}),
  };

  // Owner / branch admin land on the admin home, kitchen/riders on their panel, cashiers on their orders; logged out on the login
  return (
    <Stack.Navigator key={session ? `s${shop?.id}` : 'out'} initialRouteName={homeRoute} screenOptions={{ headerShown: false }}>
      {Object.entries(screens).map(([name, component]) => <Stack.Screen key={name} name={name} component={component} />)}
    </Stack.Navigator>
  );
}

// Voice ordering mic: owner / branch admin / cashier, on the screens where a new order is taken
const VOICE_SCREENS = { Home: 1, Product: 1, Cart: 1, PosOrder: 1 };
function VoiceOverlay({ route }) {
  const { session, isSeller, shop } = useAuth();
  const { width } = useWindowDimensions();
  // Off unless the shop is allowed in wp-admin (Users → shop profile → Voice ordering)
  if (!session || !isSeller || !shop?.voice || !route || !(route.name in VOICE_SCREENS) || route.params?.order) return null;
  const open = (place) => {
    if (!navigationRef.isReady()) return;
    // Already on the checkout: new params; otherwise open it (place: confirm and place straight away)
    navigationRef.navigate('PosOrder', place ? { voicePlace: Date.now() } : {});
  };
  // Tablet shop screen: keep the mic on the items side, clear of the order panel
  const split = route.name === 'Home' && isSplit(width, isSeller);
  return <VoiceOrderButton onOrder={open} bottom={split ? 24 : 96} right={split ? panelWidth(width) + 16 : 16} />;
}

export default function App() {
  const [route, setRoute] = useState(null);
  const track = () => { const r = navigationRef.getCurrentRoute(); setRoute(r ? { name: r.name, params: r.params } : null); };
  return (
    <SafeAreaProvider>
      <DismissKeyboard>
        <AuthProvider>
          <CartProvider>
            <NavigationContainer ref={navigationRef} onReady={track} onStateChange={track}>
              <StatusBar style="dark" />
              <NotificationListeners />
              <Routes />
              <VoiceOverlay route={route} />
              <PrintHost />
              <OfflineSync />
            </NavigationContainer>
          </CartProvider>
          <Toast />
        </AuthProvider>
      </DismissKeyboard>
    </SafeAreaProvider>
  );
}
