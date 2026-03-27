import { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/api/client';
import type { Community } from '@shelfshare/shared';

export default function CommunitiesScreen() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  // Communities aren't listed globally — user sees ones they're in via borrow/discover context
  // For MVP, show recently created/joined (stored locally after create/join)
  const [joined, setJoined] = useState<Community[]>([]);

  async function create() {
    if (!name.trim()) return Alert.alert('Name required');
    try {
      const c = await api.post<Community>('/communities', { name: name.trim() });
      setJoined(j => [c, ...j]);
      setShowCreate(false);
      setName('');
    } catch (err: unknown) { Alert.alert('Error', (err as { message?: string }).message); }
  }

  async function join() {
    if (!inviteCode.trim()) return Alert.alert('Invite code required');
    try {
      const c = await api.post<Community>(`/communities/any/join`, { inviteCode: inviteCode.trim() });
      setJoined(j => [c, ...j]);
      setShowJoin(false);
      setInviteCode('');
    } catch (err: unknown) { Alert.alert('Error', (err as { message?: string }).message); }
  }

  return (
    <View style={s.container}>
      <View style={s.btnRow}>
        <TouchableOpacity style={s.btn} onPress={() => setShowCreate(true)}><Text style={s.btnText}>+ Create</Text></TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.btnOutline]} onPress={() => setShowJoin(true)}><Text style={[s.btnText, s.btnOutlineText]}>Join via Code</Text></TouchableOpacity>
      </View>

      <FlatList
        data={joined}
        keyExtractor={c => c.id}
        renderItem={({ item }) => (
          <View style={s.card}>
            <Text style={s.name}>{item.name}</Text>
            <Text style={s.code}>Invite: {item.inviteCode}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={s.empty}>No communities yet. Create one or join with an invite code.</Text>}
      />

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <Text style={s.modalTitle}>Create Community</Text>
          <TextInput style={s.input} placeholder="Community name" value={name} onChangeText={setName} />
          <TouchableOpacity style={s.btn} onPress={create}><Text style={s.btnText}>Create</Text></TouchableOpacity>
          <TouchableOpacity style={s.cancelBtn} onPress={() => setShowCreate(false)}><Text style={s.cancelText}>Cancel</Text></TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={showJoin} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <Text style={s.modalTitle}>Join Community</Text>
          <TextInput style={s.input} placeholder="Invite code" value={inviteCode} onChangeText={setInviteCode} autoCapitalize="none" />
          <TouchableOpacity style={s.btn} onPress={join}><Text style={s.btnText}>Join</Text></TouchableOpacity>
          <TouchableOpacity style={s.cancelBtn} onPress={() => setShowJoin(false)}><Text style={s.cancelText}>Cancel</Text></TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#fff' },
  btnRow:       { flexDirection: 'row', gap: 8, padding: 12 },
  btn:          { flex: 1, backgroundColor: '#4285F4', borderRadius: 8, padding: 14, alignItems: 'center' },
  btnText:      { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnOutline:   { backgroundColor: '#fff', borderWidth: 1, borderColor: '#4285F4' },
  btnOutlineText:{ color: '#4285F4' },
  card:         { padding: 16, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  name:         { fontSize: 16, fontWeight: '600' },
  code:         { fontSize: 13, color: '#666', marginTop: 4 },
  empty:        { textAlign: 'center', color: '#999', margin: 32 },
  modal:        { flex: 1, padding: 24, backgroundColor: '#fff' },
  modalTitle:   { fontSize: 22, fontWeight: '700', marginBottom: 24 },
  input:        { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 12 },
  cancelBtn:    { marginTop: 8, padding: 14, alignItems: 'center' },
  cancelText:   { color: '#666', fontSize: 15 },
});
