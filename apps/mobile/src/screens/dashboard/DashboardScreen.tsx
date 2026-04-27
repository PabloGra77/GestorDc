import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../../services/api';
import { clearAuthSession, getAuthSession } from '../../services/auth.service';
import type { RootStackParamList } from '../../navigation';
import type { Usuario } from '../../types/usuario';
import type { Role } from '../../types/role';
import { Colors, Radius, Spacing, Typography } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

type Section = 'inicio' | 'radicaciones' | 'admin';

interface StatCard {
  label: string;
  value: string;
  color: string;
}

export function DashboardScreen({ navigation }: Props) {
  const [session, setSession] = useState<Awaited<ReturnType<typeof getAuthSession>>>(null);
  const [activeSection, setActiveSection] = useState<Section>('inicio');
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Cargar sesión al montar
  useEffect(() => {
    getAuthSession().then(setSession);
  }, []);

  const esAdmin = session?.usuario.rol.nombre.trim().toLowerCase() === 'administrador';

  // Permisos efectivos (rol + usuario)
  const permisosEfectivos = React.useMemo(() => {
    const rolPermisos = session?.usuario.rol.permisos ?? {};
    const userPermisos = session?.usuario.permisos ?? {};
    const combinado: Record<string, string[]> = {};
    for (const modulo of [...Object.keys(rolPermisos), ...Object.keys(userPermisos)]) {
      combinado[modulo] = [
        ...new Set([...(rolPermisos[modulo] ?? []), ...(userPermisos[modulo] ?? [])]),
      ];
    }
    return combinado;
  }, [session]);

  const tienePermiso = useCallback(
    (modulo: string, permiso: string) => {
      const hayPermisos = Object.values(permisosEfectivos).some((p) => p.length > 0);
      if (!hayPermisos) return true; // Sin restricciones configuradas
      return (permisosEfectivos[modulo] ?? []).includes(permiso);
    },
    [permisosEfectivos],
  );

  async function cargarDatosAdmin() {
    if (!esAdmin && !tienePermiso('panelAdministrador', 'crearUsuarios')) return;
    setLoadingData(true);
    try {
      const [usuariosRes, rolesRes] = await Promise.all([
        api.get<Usuario[]>('/usuarios'),
        api.get<Role[]>('/roles'),
      ]);
      setUsuarios(usuariosRes.data);
      setRoles(rolesRes.data);
    } catch {
      // Silenciar errores de red no críticos
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    if (activeSection === 'admin') cargarDatosAdmin();
  }, [activeSection]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await cargarDatosAdmin();
    setRefreshing(false);
  }, []);

  async function handleLogout() {
    Alert.alert('Cerrar sesión', '¿Estás seguro que deseas salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          await clearAuthSession();
          navigation.replace('Login');
        },
      },
    ]);
  }

  const statsCards: StatCard[] = [
    { label: 'Usuarios activos', value: String(usuarios.filter((u) => u.activo).length || '—'), color: Colors.primary },
    { label: 'Roles definidos', value: String(roles.length || '—'), color: '#7c3aed' },
    { label: 'Usuarios en línea', value: '1', color: Colors.success },
  ];

  if (!session) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>Hola, {session.usuario.primerNombre ?? session.usuario.nombreCompleto}</Text>
          <Text style={styles.headerRole}>{session.usuario.rol.nombre}</Text>
        </View>
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Salir</Text>
        </Pressable>
      </View>

      {/* Tabs de navegación */}
      <View style={styles.tabBar}>
        {([
          { key: 'inicio', label: 'Inicio' },
          { key: 'radicaciones', label: 'Radicaciones' },
          ...(esAdmin || tienePermiso('panelAdministrador', 'crearUsuarios')
            ? [{ key: 'admin', label: 'Admin' }]
            : []),
        ] as Array<{ key: Section; label: string }>).map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeSection === tab.key && styles.tabActive]}
            onPress={() => setActiveSection(tab.key)}
          >
            <Text style={[styles.tabText, activeSection === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* ── INICIO ─────────────────────────────────────────── */}
        {activeSection === 'inicio' && (
          <View>
            <Text style={styles.sectionTitle}>Acceso rápido</Text>

            <View style={styles.quickAccessGrid}>
              {tienePermiso('inicio', 'realizarSolicitudes') && (
                <Pressable
                  style={({ pressed }) => [styles.quickCard, pressed && styles.cardPressed]}
                  onPress={() => navigation.navigate('OpsCuentaCobro', {})}
                >
                  <View style={[styles.quickCardIcon, { backgroundColor: Colors.primaryLight }]}>
                    <Text style={styles.quickCardEmoji}>📋</Text>
                  </View>
                  <Text style={styles.quickCardTitle}>Solicitar radicado OPS</Text>
                  <Text style={styles.quickCardDesc}>Cuenta de cobro</Text>
                </Pressable>
              )}

              {tienePermiso('inicio', 'verificarRadicados') && (
                <Pressable
                  style={({ pressed }) => [styles.quickCard, pressed && styles.cardPressed]}
                  onPress={() => navigation.navigate('OpsCuentaCobro', {})}
                >
                  <View style={[styles.quickCardIcon, { backgroundColor: '#f0fdf4' }]}>
                    <Text style={styles.quickCardEmoji}>🔍</Text>
                  </View>
                  <Text style={styles.quickCardTitle}>Verificar radicado</Text>
                  <Text style={styles.quickCardDesc}>Por número y CC</Text>
                </Pressable>
              )}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>Mi cuenta</Text>
            <View style={styles.profileCard}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileInitials}>
                  {(session.usuario.primerNombre?.[0] ?? '') + (session.usuario.primerApellido?.[0] ?? '')}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>{session.usuario.nombreCompleto}</Text>
                <Text style={styles.profileEmail}>{session.usuario.correo}</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{session.usuario.rol.nombre}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── RADICACIONES ───────────────────────────────────── */}
        {activeSection === 'radicaciones' && (
          <View>
            <Text style={styles.sectionTitle}>Módulo de radicaciones</Text>

            <Pressable
              style={({ pressed }) => [styles.actionCard, pressed && styles.cardPressed]}
              onPress={() => navigation.navigate('OpsCuentaCobro', {})}
            >
              <View style={styles.actionCardLeft}>
                <Text style={styles.actionCardEmoji}>📄</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionCardTitle}>Cuenta de cobro OPS</Text>
                <Text style={styles.actionCardDesc}>
                  Solicitar, verificar y cargar documentos de cuentas de cobro.
                </Text>
              </View>
              <Text style={styles.actionCardArrow}>›</Text>
            </Pressable>

            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>Más módulos próximamente</Text>
              <Text style={styles.infoCardText}>
                Radicados generales, transferencias documentales y préstamos estarán disponibles en una próxima versión.
              </Text>
            </View>
          </View>
        )}

        {/* ── ADMIN ──────────────────────────────────────────── */}
        {activeSection === 'admin' && (
          <View>
            <Text style={styles.sectionTitle}>Panel administrador</Text>

            {loadingData ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: Spacing.xl }} />
            ) : (
              <>
                {/* Stats */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll}>
                  {statsCards.map((stat) => (
                    <View key={stat.label} style={[styles.statCard, { borderLeftColor: stat.color }]}>
                      <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                      <Text style={styles.statLabel}>{stat.label}</Text>
                    </View>
                  ))}
                </ScrollView>

                {/* Lista de usuarios recientes */}
                <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>Usuarios recientes</Text>
                {usuarios.slice(0, 6).map((u) => (
                  <View key={u.id} style={styles.userRow}>
                    <View style={styles.userAvatar}>
                      <Text style={styles.userAvatarText}>
                        {(u.primerNombre?.[0] ?? u.nombreCompleto[0]).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName}>{u.nombreCompleto}</Text>
                      <Text style={styles.userEmail}>{u.correo}</Text>
                    </View>
                    <View style={[styles.statusDot, { backgroundColor: u.activo ? Colors.success : Colors.textMuted }]} />
                  </View>
                ))}

                {usuarios.length === 0 && (
                  <Text style={styles.emptyText}>No hay usuarios cargados.</Text>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerGreeting: { ...Typography.heading },
  headerRole: { ...Typography.caption, marginTop: 2 },
  logoutButton: {
    backgroundColor: Colors.errorLight, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 6,
  },
  logoutText: { color: Colors.error, fontSize: 13, fontWeight: '600' },
  tabBar: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },
  tab: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, marginRight: 4 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: Colors.primary, fontWeight: '600' },
  content: { padding: Spacing.lg },
  sectionTitle: { ...Typography.heading, marginBottom: Spacing.md },
  quickAccessGrid: { flexDirection: 'row', gap: Spacing.md },
  quickCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md,
    alignItems: 'center',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  quickCardIcon: { width: 52, height: 52, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  quickCardEmoji: { fontSize: 24 },
  quickCardTitle: { fontSize: 13, fontWeight: '600', color: Colors.text, textAlign: 'center', marginBottom: 2 },
  quickCardDesc: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
  cardPressed: { opacity: 0.8 },
  profileCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  profileAvatar: {
    width: 52, height: 52, borderRadius: Radius.full,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  profileInitials: { color: '#fff', fontSize: 18, fontWeight: '700' },
  profileName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  profileEmail: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  roleBadge: { backgroundColor: Colors.primaryLight, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 },
  roleBadgeText: { color: Colors.primary, fontSize: 11, fontWeight: '600' },
  actionCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  actionCardLeft: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  actionCardEmoji: { fontSize: 22 },
  actionCardTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  actionCardDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  actionCardArrow: { fontSize: 22, color: Colors.textMuted },
  infoCard: { backgroundColor: Colors.warningLight, borderRadius: Radius.lg, padding: Spacing.md },
  infoCardTitle: { fontSize: 14, fontWeight: '600', color: Colors.warning, marginBottom: 4 },
  infoCardText: { fontSize: 13, color: Colors.text },
  statsScroll: { marginBottom: Spacing.md },
  statCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md,
    borderLeftWidth: 4, marginRight: Spacing.sm, minWidth: 130,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  statValue: { fontSize: 28, fontWeight: '700' },
  statLabel: { ...Typography.caption, marginTop: 2 },
  userRow: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
  userAvatar: { width: 38, height: 38, borderRadius: Radius.full, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  userName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  userEmail: { fontSize: 12, color: Colors.textSecondary },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  emptyText: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },
});
