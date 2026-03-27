import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/api/client';
import type { Book } from '@shelfshare/shared';

interface AddBookForm { isbn: string; title: string; author: string; genre: string }

export default function LibraryScreen() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddBookForm>({ isbn: '', title: '', author: '', genre: '' });
  const [lookingUp, setLookingUp] = useState(false);

  async function load() {
    setLoading(true);
    try { setBooks(await api.get<Book[]>('/books')); }
    catch (err: unknown) { Alert.alert('Error', (err as { message?: string }).message); }
    finally { setLoading(false); }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function lookupIsbn() {
    if (!form.isbn) return;
    setLookingUp(true);
    try {
      const meta = await api.get<{ title: string; author?: string; genre?: string }>(`/books/isbn/${form.isbn}`);
      setForm(f => ({ ...f, title: meta.title, author: meta.author ?? '', genre: meta.genre ?? '' }));
    } catch { Alert.alert('Not found', 'Could not find book for this ISBN. Fill in manually.'); }
    finally { setLookingUp(false); }
  }

  async function addBook() {
    if (!form.title) return Alert.alert('Title required');
    try {
      await api.post('/books', { isbn: form.isbn || undefined, title: form.title, author: form.author || undefined, genre: form.genre || undefined });
      setShowAdd(false);
      setForm({ isbn: '', title: '', author: '', genre: '' });
      load();
    } catch (err: unknown) { Alert.alert('Error', (err as { message?: string }).message); }
  }

  async function deleteBook(id: string) {
    Alert.alert('Remove book', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await api.delete(`/books/${id}`); load(); }
        catch (err: unknown) { Alert.alert('Error', (err as { message?: string }).message); }
      }},
    ]);
  }

  const statusColor = (s: string) => ({ available: '#22c55e', pending: '#f59e0b', lent_out: '#ef4444', unavailable: '#9ca3af' }[s] ?? '#9ca3af');

  return (
    <View style={s.container}>
      <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
        <Text style={s.addBtnText}>+ Add Book</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator style={{ margin: 16 }} />}

      <FlatList
        data={books}
        keyExtractor={b => b.id}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{item.title}</Text>
              <Text style={s.sub}>{item.author ?? 'Unknown author'}</Text>
              <View style={[s.badge, { backgroundColor: statusColor(item.status) }]}>
                <Text style={s.badgeText}>{item.status.replace('_', ' ')}</Text>
              </View>
            </View>
            {item.status !== 'lent_out' && (
              <TouchableOpacity onPress={() => deleteBook(item.id)}>
                <Text style={{ color: '#ef4444', fontSize: 20 }}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No books yet. Add your first book!</Text> : null}
      />

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <Text style={s.modalTitle}>Add Book</Text>
          <View style={s.isbnRow}>
            <TextInput style={[s.input, { flex: 1 }]} placeholder="ISBN (optional)" value={form.isbn} onChangeText={v => setForm(f => ({ ...f, isbn: v }))} keyboardType="numeric" />
            <TouchableOpacity style={s.lookupBtn} onPress={lookupIsbn} disabled={lookingUp}>
              {lookingUp ? <ActivityIndicator color="#fff" /> : <Text style={s.lookupBtnText}>Lookup</Text>}
            </TouchableOpacity>
          </View>
          <TextInput style={s.input} placeholder="Title *" value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} />
          <TextInput style={s.input} placeholder="Author" value={form.author} onChangeText={v => setForm(f => ({ ...f, author: v }))} />
          <TextInput style={s.input} placeholder="Genre" value={form.genre} onChangeText={v => setForm(f => ({ ...f, genre: v }))} />
          <TouchableOpacity style={s.addBtn} onPress={addBook}><Text style={s.addBtnText}>Add to Library</Text></TouchableOpacity>
          <TouchableOpacity style={s.cancelBtn} onPress={() => setShowAdd(false)}><Text style={s.cancelBtnText}>Cancel</Text></TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#fff' },
  addBtn:       { margin: 12, backgroundColor: '#4285F4', borderRadius: 8, padding: 14, alignItems: 'center' },
  addBtnText:   { color: '#fff', fontWeight: '600', fontSize: 15 },
  card:         { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  title:        { fontSize: 16, fontWeight: '600' },
  sub:          { fontSize: 13, color: '#666', marginTop: 2 },
  badge:        { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  badgeText:    { color: '#fff', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  empty:        { textAlign: 'center', color: '#999', margin: 32 },
  modal:        { flex: 1, padding: 24, backgroundColor: '#fff' },
  modalTitle:   { fontSize: 22, fontWeight: '700', marginBottom: 24 },
  isbnRow:      { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input:        { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 12 },
  lookupBtn:    { backgroundColor: '#4285F4', borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  lookupBtnText:{ color: '#fff', fontWeight: '600' },
  cancelBtn:    { marginTop: 8, padding: 14, alignItems: 'center' },
  cancelBtnText:{ color: '#666', fontSize: 15 },
});
