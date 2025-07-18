import { StatusBar } from 'expo-status-bar';
import { Modal, Button , StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import React, { useState } from 'react';

export default function App() {
    const [showNewWebView, setShowNewWebView] = useState(false);
    const [newWebViewUrl, setNewWebViewUrl] = useState('');

    const handleOpenWindow = ({ nativeEvent }) => {
        const { targetUrl } = nativeEvent
        console.log('Intercepted OpenWindow for', targetUrl)

        setNewWebViewUrl(nativeEvent.targetUrl);
        setShowNewWebView(true);
    };

    const handleModalMessage = ({ nativeEvent }) => {
        console.log('Intercepted ModalWindow for', nativeEvent)

        const data = nativeEvent.data;
        if (data === 'WEBVIEW_CLOSE_REQUEST') {
            // Perform actions to close the WebViewd, e.g., unmount the component
            setShowNewWebView(false)
        }
    }


  return (

      <View style={{ flex: 1 }}>
          <WebView
              source={{
                  uri: `https://www.acmelabsdemo.com/testing/popup`
              }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              mixedContentMode={'always'}
              originWhitelist={['*']}
              onOpenWindow={handleOpenWindow}
          />

          <Modal
              visible={showNewWebView}
              onRequestClose={() => setShowNewWebView(false)}
          >
              <View style={{ flex: 1 }}>
                  <WebView
                      source={{ uri: newWebViewUrl }}
                      javaScriptEnabled={true}
                      onMessage={handleModalMessage}

                      injectedJavaScript={`
                        const originalClose = window.close;
                        window.close = function() {
                            console.log("Custom close function called");
                            if (window.ReactNativeWebView) {
                                window.ReactNativeWebView.postMessage('WEBVIEW_CLOSE_REQUEST');
                            }
                            // originalClose(); // Optional: if you want the original behavior too
                        };
                        true; // Important: Return true to ensure the script executes
                    `}
                  />
                  <Button title="Close" onPress={() => setShowNewWebView(false)} />
              </View>
          </Modal>
      </View>



  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
