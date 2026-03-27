import { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { api } from '../../src/api/client';
import type { Book } from '@shelfshare/shared';

export default function DiscoverScreen() {
  const [books, setBooks] = useState<Book[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      // Use a default community or radius — for now just search by text
      const results = await api.get<Book[]>(`/discover?${params}`);
      setBooks(results);
    } catch (err: unknown) {
      Alert.alert('Error', (err as { message?: string }).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { search(); }, []);

  async function requestBorrow(bookId: string) {
    try {
      await api.post('/borrow-requests', { bookId });
      Alert.alert('Requested!', 'The owner will be notified.');
      search();
    } catch (err: unknown) {
      Alert.alert('Error', (err as { message?: string }).message);
    }
  }

  return (
    <View style={s.container}>
      <View style={s.searchRow}>
        <TextInput style={s.input} placeholder="Search books..." value={q} onChangeText={setQ} returnKeyType="search" onSubmitEditing={search} />
        <TouchableOpacity style={s.searchBtn} onPress={search}><Text style={s.searchBtnText}>Go</Text></TouchableOpacity>
      </View>
      {loading && <ActivityIndicator style={{ margin: 16 }} />}
      <FlatList
        data={books}
        keyExtractor={b => b.id}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{item.title}</Text>
              <Text style={s.sub}>{item.author ?? 'Unknown author'}</Text>
              {item.genre ? <Text style={s.genre}>{item.genre}</Text> : null}
            </View>
            {item.status === 'available' && (
              <TouchableOpacity style={s.btn} onPress={() => requestBorrow(item.id)}>
                <Text style={s.btnText}>Request</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No books found. Try a search or join a community.</Text> : null}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#fff' },
  searchRow:    { flexDirection: 'row', padding: 12, gap: 8 },
  input:        { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15 },
  searchBtn:    { backgroundColor: '#4285F4', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  searchBtnText:{ color: '#fff', fontWeight: '600' },
  card:         { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  title:        { fontSize: 16, fontWeight: '600' },
  sub:          { fontSize: 13, color: '#666', marginTop: 2 },
  genre:        { fontSize: 12, color: '#999', marginTop: 2 },
  btn:          { backgroundColor: '#4285F4', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12 },
  btnText:      { color: '#fff', fontSize: 13, fontWeight: '600' },
  empty:        { textAlign: 'center', color: '#999', margin: 32 },
});
