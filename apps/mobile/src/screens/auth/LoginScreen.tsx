import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getAuthErrorMessage, login, saveAuthSession } from '../../services/auth.service';
import type { RootStackParamList } from '../../navigation';
import { Colors, Radius, Spacing, Typography } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!correo.trim() || !password.trim()) {
      setError('Completa correo y contraseña para continuar.');
      return;
    }

    setCargando(true);
    setError('');

    try {
      const session = await login({ correo: correo.trim().toLowerCase(), password });
      await saveAuthSession(session);

      if (session.usuario.debeCambiarPassword) {
        navigation.replace('FirstPassword');
      } else {
        navigation.replace('Dashboard');
      }
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setCargando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Marca */}
          <View style={styles.brand}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>GD</Text>
            </View>
            <Text style={styles.appTitle}>GestorDoc CO</Text>
            <Text style={styles.appSubtitle}>Plataforma de gestión documental</Text>
          </View>

          {/* Tarjeta de login */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Iniciar sesión</Text>
            <Text style={styles.cardSubtitle}>Ingresa con tu cuenta corporativa</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Correo electrónico</Text>
              <TextInput
                style={styles.input}
                placeholder="usuario@empresa.com"
                placeholderTextColor={Colors.textMuted}
                value={correo}
                onChangeText={setCorreo}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            {error ? (
              <View style={styles.alertBox}>
                <Text style={styles.alertText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed, cargando && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={cargando}
            >
              {cargando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Ingresar</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.linkButton}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.linkText}>¿Olvidaste tu contraseña?</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('OpsCuentaCobro', {})}
            >
              <Text style={styles.secondaryButtonText}>Verificar radicado OPS</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
  },
  brand: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  logoText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  appTitle: {
    ...Typography.title,
    marginBottom: 2,
  },
  appSubtitle: {
    ...Typography.subtitle,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
  },
  cardTitle: {
    ...Typography.heading,
    marginBottom: 4,
  },
  cardSubtitle: {
    ...Typography.subtitle,
    marginBottom: Spacing.lg,
  },
  fieldGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.label,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 14,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  alertBox: {
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  alertText: {
    color: Colors.error,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: 16,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  linkText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    padding: 14,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});
