import { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/api/client';
import type { BorrowRequest } from '@shelfshare/shared';

type Role = 'owner' | 'borrower';

export default function BorrowsScreen() {
  const [role, setRole] = useState<Role>('borrower');
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [loading, setLoading] = useState(false);

  async function load(r: Role) {
    setLoading(true);
    try { setRequests(await api.get<BorrowRequest[]>(`/borrow-requests?role=${r}`)); }
    catch (err: unknown) { Alert.alert('Error', (err as { message?: string }).message); }
    finally { setLoading(false); }
  }

  useFocusEffect(useCallback(() => { load(role); }, [role]));

  async function action(id: string, act: string, extra?: Record<string, string>) {
    try {
      await api.patch(`/borrow-requests/${id}`, { action: act, ...extra });
      load(role);
    } catch (err: unknown) { Alert.alert('Error', (err as { message?: string }).message); }
  }

  const statusColor = (s: string) => ({ pending: '#f59e0b', accepted: '#22c55e', declined: '#ef4444', expired: '#9ca3af', returned: '#6366f1' }[s] ?? '#9ca3af');

  return (
    <View style={s.container}>
      <View style={s.toggle}>
        {(['borrower', 'owner'] as Role[]).map(r => (
          <TouchableOpacity key={r} style={[s.toggleBtn, role === r && s.toggleActive]} onPress={() => setRole(r)}>
            <Text style={[s.toggleText, role === r && s.toggleActiveText]}>{r === 'borrower' ? 'My Borrows' : 'My Lends'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && <ActivityIndicator style={{ margin: 16 }} />}

      <FlatList
        data={requests}
        keyExtractor={r => r.id}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.bookId}>Book: {item.bookId.slice(0, 8)}…</Text>
              <View style={[s.badge, { backgroundColor: statusColor(item.status) }]}>
                <Text style={s.badgeText}>{item.status}</Text>
              </View>
              {item.dueDate && <Text style={s.due}>Due: {item.dueDate}</Text>}
            </View>
            <View style={s.actions}>
              {role === 'owner' && item.status === 'pending' && <>
                <TouchableOpacity style={s.acceptBtn} onPress={() => {
                  const due = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]!;
                  action(item.id, 'accept', { dueDate: due });
                }}>
                  <Text style={s.actionText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.declineBtn} onPress={() => action(item.id, 'decline')}>
                  <Text style={s.actionText}>Decline</Text>
                </TouchableOpacity>
              </>}
              {item.status === 'accepted' && (
                <TouchableOpacity style={s.returnBtn} onPress={() => action(item.id, 'return')}>
                  <Text style={s.actionText}>Returned</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No {role === 'borrower' ? 'borrows' : 'lends'} yet.</Text> : null}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#fff' },
  toggle:          { flexDirection: 'row', margin: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', overflow: 'hidden' },
  toggleBtn:       { flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#fff' },
  toggleActive:    { backgroundColor: '#4285F4' },
  toggleText:      { fontWeight: '600', color: '#666' },
  toggleActiveText:{ color: '#fff' },
  card:            { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  bookId:          { fontSize: 14, fontWeight: '600' },
  badge:           { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  badgeText:       { color: '#fff', fontSize: 11, fontWeight: '600' },
  due:             { fontSize: 12, color: '#666', marginTop: 4 },
  actions:         { gap: 6 },
  acceptBtn:       { backgroundColor: '#22c55e', borderRadius: 6, padding: 8 },
  declineBtn:      { backgroundColor: '#ef4444', borderRadius: 6, padding: 8 },
  returnBtn:       { backgroundColor: '#6366f1', borderRadius: 6, padding: 8 },
  actionText:      { color: '#fff', fontSize: 12, fontWeight: '600' },
  empty:           { textAlign: 'center', color: '#999', margin: 32 },
});
