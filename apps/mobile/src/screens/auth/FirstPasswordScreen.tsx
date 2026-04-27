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
import {
  changeInitialPassword,
  clearAuthSession,
  getAuthErrorMessage,
  getAuthSession,
  saveAuthSession,
} from '../../services/auth.service';
import type { RootStackParamList } from '../../navigation';
import { Colors, Radius, Spacing, Typography } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'FirstPassword'>;

export function FirstPasswordScreen({ navigation }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  async function handleSubmit() {
    setError('');
    setMensaje('');

    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    const session = await getAuthSession();
    if (!session) {
      navigation.replace('Login');
      return;
    }

    setCargando(true);
    try {
      await changeInitialPassword({
        correo: session.usuario.correo,
        currentPassword,
        newPassword,
      });

      // Actualizar sesión local: ya no requiere cambio de clave
      await saveAuthSession({
        ...session,
        usuario: { ...session.usuario, debeCambiarPassword: false },
      });

      setMensaje('Contraseña actualizada correctamente.');
      setTimeout(() => navigation.replace('Dashboard'), 800);
    } catch (err) {
      setError(getAuthErrorMessage(err));
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr?.response?.status === 401) {
        await clearAuthSession();
        navigation.replace('Login');
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <View style={styles.brand}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>GD</Text>
            </View>
            <Text style={styles.appTitle}>Cambio de contraseña</Text>
            <Text style={styles.appSubtitle}>Debes establecer una contraseña personal antes de continuar.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Primera contraseña</Text>
            <Text style={styles.cardSubtitle}>Usa la contraseña temporal que recibiste por correo.</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Contraseña temporal actual</Text>
              <TextInput
                style={styles.input}
                placeholder="Contraseña del correo de bienvenida"
                placeholderTextColor={Colors.textMuted}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Nueva contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor={Colors.textMuted}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirmar nueva contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="Repite la nueva contraseña"
                placeholderTextColor={Colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
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
                <Text style={styles.primaryButtonText}>Actualizar contraseña</Text>
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
