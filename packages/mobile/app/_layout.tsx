import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View } from 'react-native';
import { getToken } from '../src/api/client';

export default function RootLayout() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    getToken().then(setToken);
  }, []);

  useEffect(() => {
    if (token === undefined) return;
    const inAuth = segments[0] === '(auth)';
    if (!token && !inAuth) router.replace('/(auth)/login');
    if (token && inAuth) router.replace('/(tabs)/discover');
  }, [token, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
