import { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/api/client';

interface Conversation { userId: string; displayName: string; lastMessage: string; lastAt: string; unread: number }
interface Message { id: string; senderId: string; content: string; createdAt: string }

export default function MessagesScreen() {
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');

  useFocusEffect(useCallback(() => {
    if (!selected) loadConvos();
  }, [selected]));

  async function loadConvos() {
    setLoading(true);
    try { setConvos(await api.get<Conversation[]>('/messages/conversations')); }
    catch (err: unknown) { Alert.alert('Error', (err as { message?: string }).message); }
    finally { setLoading(false); }
  }

  async function openThread(c: Conversation) {
    setSelected(c);
    try { setMessages(await api.get<Message[]>(`/messages/${c.userId}`)); }
    catch (err: unknown) { Alert.alert('Error', (err as { message?: string }).message); }
  }

  async function send() {
    if (!draft.trim() || !selected) return;
    try {
      await api.post(`/messages/${selected.userId}`, { content: draft.trim() });
      setDraft('');
      setMessages(await api.get<Message[]>(`/messages/${selected.userId}`));
    } catch (err: unknown) { Alert.alert('Error', (err as { message?: string }).message); }
  }

  if (selected) return (
    <View style={s.container}>
      <TouchableOpacity style={s.back} onPress={() => { setSelected(null); loadConvos(); }}>
        <Text style={s.backText}>← {selected.displayName}</Text>
      </TouchableOpacity>
      <ScrollView style={{ padding: 12 }}>
        {messages.map(item => (
          <View key={item.id} style={[s.bubble, item.senderId === selected.userId ? s.bubbleLeft : s.bubbleRight]}>
            <Text style={s.bubbleText}>{item.content}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={s.inputRow}>
        <TextInput style={s.input} value={draft} onChangeText={setDraft} placeholder="Message..." multiline />
        <TouchableOpacity style={s.sendBtn} onPress={send}><Text style={s.sendBtnText}>Send</Text></TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={s.container}>
      {loading && <ActivityIndicator style={{ margin: 16 }} />}
      <FlatList
        data={convos}
        keyExtractor={c => c.userId}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.convo} onPress={() => openThread(item)}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{item.displayName}</Text>
              <Text style={s.last} numberOfLines={1}>{item.lastMessage}</Text>
            </View>
            {item.unread > 0 && <View style={s.unreadBadge}><Text style={s.unreadText}>{item.unread}</Text></View>}
          </TouchableOpacity>
        )}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No messages yet.</Text> : null}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#fff' },
  back:        { padding: 16, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  backText:    { fontSize: 16, fontWeight: '600', color: '#4285F4' },
  convo:       { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  name:        { fontSize: 15, fontWeight: '600' },
  last:        { fontSize: 13, color: '#666', marginTop: 2 },
  unreadBadge: { backgroundColor: '#4285F4', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  unreadText:  { color: '#fff', fontSize: 11, fontWeight: '700' },
  bubble:      { maxWidth: '75%', borderRadius: 12, padding: 10, marginBottom: 8 },
  bubbleLeft:  { backgroundColor: '#f0f0f0', alignSelf: 'flex-start' },
  bubbleRight: { backgroundColor: '#4285F4', alignSelf: 'flex-end' },
  bubbleText:  { fontSize: 14 },
  inputRow:    { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderColor: '#f0f0f0', gap: 8 },
  input:       { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14, maxHeight: 80 },
  sendBtn:     { backgroundColor: '#4285F4', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontWeight: '600' },
  empty:       { textAlign: 'center', color: '#999', margin: 32 },
});
