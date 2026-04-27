import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getAuthSession } from '../services/auth.service';
import { Colors } from '../theme';

// Pantallas
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';
import { FirstPasswordScreen } from '../screens/auth/FirstPasswordScreen';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { OpsCuentaCobroScreen } from '../screens/radicaciones/OpsCuentaCobroScreen';

// ── Tipos de navegación ────────────────────────────────────────────────────────

export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string };
  FirstPassword: undefined;
  Dashboard: undefined;
  OpsCuentaCobro: { radicado?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// ── Componente de navegación ───────────────────────────────────────────────────

export function RootNavigator() {
  const [initialRoute, setInitialRoute] =
    useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    async function resolveInitialRoute() {
      const session = await getAuthSession();
      if (!session) {
        setInitialRoute('Login');
        return;
      }
      if (session.usuario.debeCambiarPassword) {
        setInitialRoute('FirstPassword');
        return;
      }
      setInitialRoute('Dashboard');
    }
    resolveInitialRoute();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      {/* Rutas públicas */}
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="OpsCuentaCobro" component={OpsCuentaCobroScreen} />

      {/* Rutas autenticadas */}
      <Stack.Screen name="FirstPassword" component={FirstPasswordScreen} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
    </Stack.Navigator>
  );
}
