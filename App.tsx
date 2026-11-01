import React, { useCallback } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {FastenStitchElement} from '@fastenhealth/fasten-stitch-element-react-native';

export default function App() {
  const colorScheme = useColorScheme();

  /* PROD */
  // const CUSTOMER_PUBLIC_ID = "public_test_6f5j7qj54rlyajv6u8r36z0iu5v9qjf87f77tzl3k6ezu";
  /* DEV LIVE */
  // const CUSTOMER_PUBLIC_ID = "public_live_4n19i60122b4ino0iyirvuv9jvvtny94kx3shodf4f1n5";
  /* DEV TEST */
  const CUSTOMER_PUBLIC_ID = "public_test_ngnymjxpctcn2ramgubdpx8vgc2cr6j3p784r8fo9br85";

  const handleEventBus = useCallback((message: unknown) => {
    console.debug('[FastenStitchElement onEventBus] message', message);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <SafeAreaView
        style={[styles.root, { backgroundColor: colorScheme === 'dark' ? '#000000' : '#ffffff' }]}
      >
        <FastenStitchElement
          publicId={CUSTOMER_PUBLIC_ID}
          debugModeEnabled
          onEventBus={handleEventBus}
          tefcaMode={true}
          brandingAccentColor={"#32a852"}
          brandingTheme={colorScheme ?? 'light'}
          // tefcaCspPromptForce={true}
          embedBaseUrl="https://embed.connect.fastenlabs.com"
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
