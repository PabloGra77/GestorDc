import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import { getAuthErrorMessage, requestPasswordReset } from '../../services/auth.service';
import type { RootStackParamList } from '../../navigation';
import { Colors, Radius, Spacing, Typography } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [correo, setCorreo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  async function handleSubmit() {
    if (!correo.trim()) {
      setError('Ingresa tu correo corporativo para continuar.');
      return;
    }

    setCargando(true);
    setError('');
    setMensaje('');

    try {
      const res = await requestPasswordReset({ correo: correo.trim().toLowerCase() });
      setMensaje(res.message || 'Si el correo existe, enviaremos un enlace de restablecimiento.');
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setCargando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Volver</Text>
          </Pressable>

          <View style={styles.brand}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>GD</Text>
            </View>
            <Text style={styles.appTitle}>Recuperar contraseña</Text>
            <Text style={styles.appSubtitle}>Te enviaremos un enlace de restablecimiento al correo del usuario.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Restablecimiento</Text>
            <Text style={styles.cardSubtitle}>Ingresa tu correo corporativo.</Text>

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
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </View>

            {mensaje ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{mensaje}</Text>
              </View>
            ) : null}
            {error ? (
              <View style={styles.alertBox}>
                <Text style={styles.alertText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed, cargando && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={cargando}
            >
              {cargando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Enviar enlace</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, padding: Spacing.lg, justifyContent: 'center' },
  backButton: { marginBottom: Spacing.md },
  backText: { color: Colors.primary, fontSize: 15, fontWeight: '500' },
  brand: { alignItems: 'center', marginBottom: Spacing.xl },
  logoCircle: {
    width: 56, height: 56, borderRadius: Radius.full,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm,
  },
  logoText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  appTitle: { ...Typography.title, marginBottom: 4 },
  appSubtitle: { ...Typography.subtitle, textAlign: 'center' },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16, elevation: 4,
  },
  cardTitle: { ...Typography.heading, marginBottom: 4 },
  cardSubtitle: { ...Typography.subtitle, marginBottom: Spacing.lg },
  fieldGroup: { marginBottom: Spacing.md },
  label: { ...Typography.label, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: 14, fontSize: 15, color: Colors.text, backgroundColor: Colors.surface,
  },
  successBox: { backgroundColor: Colors.successLight, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.md },
  successText: { color: Colors.success, fontSize: 14 },
  alertBox: { backgroundColor: Colors.errorLight, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.md },
  alertText: { color: Colors.error, fontSize: 14 },
  primaryButton: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    padding: 16, alignItems: 'center', marginTop: Spacing.xs,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.6 },
});
