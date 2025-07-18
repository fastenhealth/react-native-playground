import { StatusBar } from 'expo-status-bar';
import { Modal, Button , StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import React, {useRef, useState} from 'react';

export default function App() {
    const [showNewWebView, setShowNewWebView] = useState(false);
    const [newWebViewUrl, setNewWebViewUrl] = useState('');

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //Primary WebView Handlers
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    const primaryWebViewRef = useRef(null);
    const primaryOnOpenWindow = ({ nativeEvent }) => {
        const { targetUrl } = nativeEvent
        console.log('Intercepted OpenWindow for', targetUrl)

        setNewWebViewUrl(nativeEvent.targetUrl);
        setShowNewWebView(true);
    };

    // const primaryOnMessage = ({ nativeEvent }) => {
    //     console.debug('Intercepted PrimaryWebView for', nativeEvent)
    //
    //     const data = nativeEvent.data;
    //     if(!data){
    //         console.warn('No data received in primaryOnMessage');
    //         return;
    //     }
    //
    //     const eventData = JSON.parse(data);
    //
    //     //this is a message sent from Modal WebView (via the Fasten Connect API Callback)
    //     console.debug('Received message from modal WebView:', eventData);
    //     if (modalWebViewRef.current) {
    //         //acknowledge the message by sending back a close request to the modal WebView
    //         modalWebViewRef.current.postMessage(JSON.stringify({"action": "WEBVIEW_CLOSE_REQUEST"}));
    //     } else {
    //         console.error('Modal WebView reference is not available');
    //     }
    // }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //Modal WebView Handlers
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    const modalWebViewRef = useRef(null);

    //messages will either be sent from the overridden window.close function, or from the overridden window.opener.postMessage function
    const modalOnMessage = ({ nativeEvent }) => {
        console.debug('Intercepted ModalWindow for', nativeEvent)

        const data = nativeEvent.data;
        if(!data){
            console.warn('No data received in modalOnMessage');
            return;
        }

        const eventData = JSON.parse(data);

        if (eventData.action === 'WEBVIEW_CLOSE_REQUEST') {
            // Perform actions to close the WebView, e.g., unmount the component on window.close request
            setShowNewWebView(false)
        } else {
            //this is a message sent from the Fasten Connect API Callback endpoint that needs to bubble up to the parentWebView
            console.debug('Received message from modal WebView:', eventData);
            if (primaryWebViewRef.current) {
                primaryWebViewRef.current.postMessage(JSON.stringify(eventData));
            } else {
                console.error('Primary WebView reference is not available');
            }
        }
    }


  return (

      <View style={{ flex: 1 }}>
          {/*
          Primary Webview
          This will show your webpage where the fasten widget is embedded.
           */}
          <WebView
              ref={primaryWebViewRef}
              source={{
                  // uri: `https://www.acmelabsdemo.com/v3`
                  uri: `https://www.acmelabsdemo.com/testing/popup`
              }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              mixedContentMode={'always'}
              originWhitelist={['*']}
              // This will intercept the window.open event and open a new modal WebView instead
              onOpenWindow={primaryOnOpenWindow}
              // onMessage={primaryOnMessage}
          />

          {/*
          Modal Webview
          This will show the popup that Fasten wants to open in a new WebView.
           */}
          <Modal
              visible={showNewWebView}
              onRequestClose={() => setShowNewWebView(false)}
          >
              <View style={{ flex: 1 }}>
                  <WebView
                      ref={modalWebViewRef}
                      source={{ uri: newWebViewUrl }}
                      javaScriptEnabled={true}
                      onMessage={modalOnMessage}


                      //you cant use `injectedJavaScript` because Modal webview will be redirected multiple times:
                      // first to the Fasten Connect API endpoint
                      // then to the Patient Portal (where the patient must login and consent)
                      // finally back to the Fasten Connect API Callback endpoint where data will be shared using the postMessage API
                      onNavigationStateChange={
                            (navState) => {
                                // Log the URL to see the navigation state
                                console.debug('Modal WebView Navigation State:', navState);

                                if(navState.loading == false && navState.url.includes('/destination.html')) {
                                    modalWebViewRef.current.injectJavaScript(`
                                        document.body.style.backgroundColor = 'lightblue'; //just for testing

                                        //override the window.close function to send a message to the React Native app, to close the Modal Webview
                                        const originalClose = window.close;
                                        window.close = function() {
                                            console.debug("custom close function called");
                                            if (window.ReactNativeWebView) {
                                                window.ReactNativeWebView.postMessage(JSON.stringify({"action": "WEBVIEW_CLOSE_REQUEST"}));
                                            }
                                            // originalClose(); // Optional: if you want the original behavior too
                                        };
                                        
                                        //override the window.opener.postMessage function to send messages to the React Native app
                                        window.opener = {
                                            postMessage: function(payload, targetOrigin){
                                                window.ReactNativeWebView.postMessage(payload)
                                            }
                                        }
                                        
                                        true; // Important: Return true to ensure the script executes
                                    `);
                                }
                            }
                      }
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
