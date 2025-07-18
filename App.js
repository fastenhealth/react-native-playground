import { StatusBar } from 'expo-status-bar';
import { Modal, Button , StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import React, {useRef, useState} from 'react';

export default function App() {
    const [showNewWebView, setShowNewWebView] = useState(false);
    const [newWebViewUrl, setNewWebViewUrl] = useState('');

    /* *
    * This component is intended to replace the Fasten Connect Stitch.js widget in a React Native app.
    *
    * The Stitch.js Widget is responsible for the following:
    * 1. Allowing patients to find their healthcare providers
    * 2. Opening a modal popup to the Fasten Connect API `connect` endpoint - https://docs.connect.fastenhealth.com/api-reference/registration/connect
    * 3. Redirecting the user to the Patient Portal for their healthcare institution to login and consent
    * 4. Redirecting back to the Fasten Connect API Callback endpoint
    * 5. Sending data back to the customer regarding the connection Fasten Connect has established with the patient & their healthcare provider
    *
    * While this process is straightforward in a web browser, it is complicated in a React Native app:
    * - `window.open` does not work as expected in React Native WebViews, as it is designed for web browsers.
    * - `window.close` does not work in React Native WebViews, as it is also designed for web browsers.
    * - messaging between the popup and the parent window is done via Javascript postMessage API, which depends on browser behavior to set the trusted event.source and window.parent associations
    *
    * Instead, our React Native solution involves two WebViews and 4 "entities" that need to communicate with each other:
    * 1. The Primary WebView - this is the main WebView that loads the webpage where the Fasten Connect widget is embedded.
    * 2. The Modal WebView - this is the WebView that opens when the Fasten Connect widget tries to open a popup.
    * 3. The React Native Component - this is the React Native component that contains the two WebViews and handles the communication between them.
    *
    * Communication between WebViews and the React Native app is done in one of 3 ways:
    * To send data from app to webview, use injectedJavaScript (or injectJavascript) - https://github.com/react-native-webview/react-native-webview/blob/master/docs/Reference.md#injectedjavascript
    * To send data from webview to app, use postMessage - https://github.com/react-native-webview/react-native-webview/blob/master/docs/Reference.md#postmessagestr
    * To receive data in webview sent by postMessage, use onMessage - https://github.com/react-native-webview/react-native-webview/blob/master/docs/Reference.md#onmessage
    *
    * We will make use of all of these methods to coordinate the communication between the two WebViews and the React Native app, making sure that messages and events are handled correctly.
    * */

    //List of entities that need to communicate with each other
    enum CommunicationEntity {
        PrimaryWebView = 'PrimaryWebView',
        ModalWebView = 'ModalWebView',
        ReactNativeApp = 'ReactNativeApp'
    }

    enum CommunicationAction {
        WEBVIEW_CLOSE_REQUEST = 'WEBVIEW_CLOSE_REQUEST', // request to close the Webview. eg. Parent window requests the Modal Webview be closed, or a JS window.close function is called.
    }

    interface CommunicationMessage {
        from: CommunicationEntity; // The entity sending the message
        to: CommunicationEntity; // The entity receiving the message

        // one of action or payload must be defined
        action?: CommunicationAction; // The action being performed
        payload?: string; // Optional data being sent with the message
    }

    //Since the standard postMessage API is not available in React Native WebViews,
    // we will override the window.close and window.opener.postMessage functions to send messages to the React Native app.
    const commonOnNavigationStateChangeScript = (currentWebviewEntity: CommunicationEntity) => {
        return `
        document.body.style.backgroundColor = 'lightblue'; //just for testing
        //override the window.close function to send a message to the React Native app, to close the Modal Webview
        const originalClose = window.close;
        window.close = function() {
            console.debug("custom close function called");
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    "from": "${currentWebviewEntity}",
                    "to": "${CommunicationEntity.ReactNativeApp}",
                    "action": "${CommunicationAction.WEBVIEW_CLOSE_REQUEST}",
                }));
            }
            // originalClose(); // Optional: if you want the original behavior too
        };
        
        //override the window.opener.postMessage function to send messages to the React Native app
        window.opener = {
            postMessage: function(payload, targetOrigin){
                //TODO: validate targetOrigin
                console.error('custom postMessage function called with payload:', payload);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    "from": "${currentWebviewEntity}",
                    "to": "${CommunicationEntity.ReactNativeApp}",
                    "payload": payload
                }))
            }
        }
        
        true; // Important: Return true to ensure the script executes
    `}


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

    const primaryOnMessage = ({ nativeEvent }) => {
        console.error('Intercepted PrimaryWindow for', nativeEvent)

        const data = nativeEvent.data;
        if(!data){
            console.warn('No data received in primaryOnMessage');
            return;
        }

        const eventData = JSON.parse(data);

        //this is a message sent from Modal WebView (via the Fasten Connect API Callback)
        console.debug('Received message from modal facilitated by WebView:', eventData);
        if (modalWebViewRef.current) {
            //acknowledge the message by sending back a close request to the modal WebView
            // modalWebViewRef.current.postMessage(JSON.stringify({"action": "WEBVIEW_CLOSE_REQUEST"}));
            setShowNewWebView(false)
        } else {
            console.error('Modal WebView reference is not available');
        }
    }

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
                console.log("Sending message to primary WebView:", eventData);
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
              onMessage={primaryOnMessage}
              onError={
                    (syntheticEvent) => {
                        const { nativeEvent } = syntheticEvent;
                        console.error('WebView error: ', nativeEvent);
                    }
              }

              //you cant use `injectedJavaScript` because Modal webview will be redirected multiple times:
              // first to the Fasten Connect API endpoint
              // then to the Patient Portal (where the patient must login and consent)
              // finally back to the Fasten Connect API Callback endpoint where data will be shared using the postMessage API
              onNavigationStateChange={
                  (navState) => {
                      // Log the URL to see the navigation state
                      console.debug('Primary WebView Navigation State:', navState);

                      if(navState.loading === false) {
                          primaryWebViewRef.current.injectJavaScript(commonOnNavigationStateChangeScript(CommunicationEntity.PrimaryWebView));
                      }
                  }
              }
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

                                if(navState.loading === false && navState.url.includes('/destination.html')) {
                                    modalWebViewRef.current.injectJavaScript(commonOnNavigationStateChangeScript(CommunicationEntity.ModalWebView));
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
