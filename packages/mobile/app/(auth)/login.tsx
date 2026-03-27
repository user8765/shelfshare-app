import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useRouter } from 'expo-router';
import { api, setToken } from '../../src/api/client';

GoogleSignin.configure({
  webClientId: process.env['EXPO_PUBLIC_GOOGLE_CLIENT_ID'],
});

export default function LoginScreen() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      const { data } = await GoogleSignin.signIn();
      if (!data?.idToken) throw new Error('No ID token');

      const res = await api.post<{ token: string }>('/auth/google/callback', {
        idToken: data.idToken,
        inviteCode: inviteCode.trim() || undefined,
      });

      await setToken(res.token);
      router.replace('/(tabs)/discover');
    } catch (err: unknown) {
      const e = err as { message?: string };
      Alert.alert('Sign in failed', e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>ShelfShare</Text>
      <Text style={s.subtitle}>Community book lending</Text>

      <TextInput
        style={s.input}
        placeholder="Invite code (required for new users)"
        value={inviteCode}
        onChangeText={setInviteCode}
        autoCapitalize="none"
      />

      <TouchableOpacity style={s.button} onPress={handleGoogleSignIn} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Continue with Google</Text>}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#fff' },
  title:     { fontSize: 32, fontWeight: '700', marginBottom: 8 },
  subtitle:  { fontSize: 16, color: '#666', marginBottom: 48 },
  input:     { width: '100%', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 },
  button:    { width: '100%', backgroundColor: '#4285F4', borderRadius: 8, padding: 16, alignItems: 'center' },
  buttonText:{ color: '#fff', fontSize: 16, fontWeight: '600' },
});
