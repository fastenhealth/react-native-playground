import { StatusBar } from 'expo-status-bar';
import { Modal, Button , StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import React, {useRef, useState} from 'react';

export default function App() {
    const [showNewWebView, setShowNewWebView] = useState(false);
    const [newWebViewUrl, setNewWebViewUrl] = useState('');


    //TODO: replace with your public ID
    // const CUSTOMER_PUBLIC_ID = "public_test_rei2un7aagh5pquwikxh2dsyq23bsdyu4l8vm9eq29ftu";
    const CUSTOMER_PUBLIC_ID = "public_test_6f5j7qj54rlyajv6u8r36z0iu5v9qjf87f77tzl3k6ezu";

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
    // TODO: enums don't seem to work? Could be an issue with our development env, but we will use string constants instead.
    // TODO: these constants are hardcoded on the Fasten Connect API side as well, which is not ideal. Will require lock-step deployments
    const CommunicationEntityPrimaryWebView = 'FASTEN_CONNECT_PRIMARY_WEBVIEW'
    const CommunicationEntityModalWebView = 'FASTEN_CONNECT_MODAL_WEBVIEW'
    const CommunicationEntityReactNativeComponent = 'FASTEN_CONNECT_REACT_WEBVIEW' //this is the Fasten Connect React Native component that contains the two WebViews (this file)
    const CommunicationEntityExternal = 'FASTEN_CONNECT_EXTERNAL' // this is data that will be sent to the customer's app, for them to handle.

    // request to close the modal Webview.
    // eg. Parent window requests the Modal Webview be closed, or a JS window.close function is called.
    const CommunicationActionModalWebviewCloseRequest = 'FASTEN_CONNECT_MODAL_WEBVIEW_CLOSE_REQUEST'

    //example communication message structure, this is the format we will use to send messages between the entities
    interface CommunicationMessage {
        from: string; // The entity sending the message
        to: string; // The entity receiving the message

        // one of action or payload must be defined
        action?: string; // The action being performed
        payload?: string; // The data being sent with the message, this will be a stringified JSON object
    }

    //Since the standard postMessage API is not available in React Native WebViews,
    // we will override the window.close and window.opener.postMessage functions to send messages to the React Native app.
    const commonOnNavigationStateChangeScript = (currentWebviewEntity: string) => {
        return `
            // document.body.style.backgroundColor = 'lightblue'; //just for testing
            //override the window.close function to send a message to the React Native app, to close the Modal Webview
            const originalClose = window.close;
            window.close = function() {
                console.debug("custom close function called");
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        "from": "${currentWebviewEntity}",
                        "to": "${CommunicationEntityReactNativeComponent}",
                        "action": "${CommunicationActionModalWebviewCloseRequest}",
                    }));
                }
                // originalClose(); // Optional: if you want the original behavior too
            }; 

            true; // Important: Return true to ensure the script executes
        `;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //Messaging Bus to facilitate communication between the two WebViews and the React Native app
    // - as discussed above, Reach Native uses `onMessage` and `postMessage` to communicate between the WebViews and the React Native app.
    // - window.ReactNativeWebView.postMessage is called in Fasten Connect Callback API code directly.
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    const findWebviewRefByEntityName = (entityName: string): any => {
        switch (entityName) {
            case CommunicationEntityPrimaryWebView:
                return primaryWebViewRef?.current;
            case CommunicationEntityModalWebView:
                return modalWebViewRef?.current;
            case CommunicationEntityReactNativeComponent:
                console.warn('Cannot find WebView reference for React Native Component');
                return null; // React Native Component does not have a WebView reference
            default:
                console.error(`Unknown entity name: ${entityName}`);
                return null;
        }
    }

    const messageBusOnMessage = (currentWebviewEntity: string, {nativeEvent}) => {
        console.debug(`[${currentWebviewEntity}] onMessage`, nativeEvent)

        const data = nativeEvent.data;
        if(!data){
            console.warn(`[${currentWebviewEntity}] no "data" received: ${nativeEvent}`);
            return;
        }

        const communicationMessage: CommunicationMessage = JSON.parse(data); //should be a CommunicationMessage
        console.debug(`[${currentWebviewEntity}] parsed JSON data`, communicationMessage);

        if (communicationMessage.action === CommunicationActionModalWebviewCloseRequest) {
            //this message was sent from a webview to request the React Native app to close the popup WebView
            // this could happen if the window.close event is triggered, or the parent has acknowledged the popup message and wants to close it.
            //This should only be directed to the React Native component Modal WebView, so lets throw an error and bail
            if(communicationMessage.to !== CommunicationEntityReactNativeComponent) {
                console.error(`[${currentWebviewEntity}] received ${CommunicationActionModalWebviewCloseRequest}, but the message is not intended for the React Native Component`);
                return;
            }

            // Perform actions to close the WebView, e.g., unmount the component on window.close request
            setShowNewWebView(false)
            return
        }

        //check if the event is intended for our customer to handle
        if(communicationMessage.to === CommunicationEntityExternal) {
            //TODO: add bubble up code outside this component.
            console.warn(`[${CommunicationEntityExternal}] received message for external entity, this will be bubbled up to customer for use outside this component`, communicationMessage);
            return
        }

        //check if the message is intended for a different WebView
        if (communicationMessage.to && communicationMessage.to !== currentWebviewEntity) {
            console.debug(`[${currentWebviewEntity}] message is not for this WebView, forwarding to ${communicationMessage.to}`);
            //find the WebView reference for the target entity
            const targetWebViewRef = findWebviewRefByEntityName(communicationMessage.to);
            if (targetWebViewRef) {
                //post the message to the target WebView
                console.debug(`[${currentWebviewEntity}] posting message to: ${communicationMessage.to} from: ${communicationMessage.from}`, communicationMessage);

                //when the Modal webview calls primaryWebView.postMessage, the message is sent as a browser javascript event
                // however this javascript event may not be structured correctly for the Stitch.js event listener to parse it (so it will be ignored)
                // we need to unwrap the CommunicationMessage paylod object from the event.data and resend just the payload to the current page
                if( communicationMessage.from === CommunicationEntityModalWebView && communicationMessage.to === CommunicationEntityPrimaryWebView) {
                    //this is a message from the Modal WebView to the Primary WebView, we need to extract the payload and send it as a string
                    const payload = communicationMessage.payload;
                    if (payload) {
                        console.debug(`[${currentWebviewEntity}] forwarding payload from Modal WebView to Primary WebView`, payload);
                        targetWebViewRef.postMessage(payload);
                    } else {
                        console.error(`[${currentWebviewEntity}] no payload found in message from Modal WebView to Primary WebView`);
                    }
                    //since we know that the only communication from the modal to the parent window is related to a connection_id creation (or failure message)
                    // we can close the modal WebView after sending the message
                    setShowNewWebView(false);
                } else {
                    targetWebViewRef.postMessage(communicationMessage);
                }
            } else {
                console.error(`[${currentWebviewEntity}] could not find WebView reference for ${communicationMessage.to}`);
            }
        }
    }



    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //Primary WebView Handlers
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    const primaryWebViewRef = useRef(null);
    const modalWebViewRef = useRef(null);

    const primaryOnOpenWindow = ({ nativeEvent }) => {
        const { targetUrl } = nativeEvent
        console.debug(`[${CommunicationEntityPrimaryWebView}] Intercepted window.open() for`, targetUrl)

        setNewWebViewUrl(nativeEvent.targetUrl);
        setShowNewWebView(true);
    };

    const injectedModalScript: {[key: string]: boolean} = {}

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
                  // uri: `https://www.acmelabsdemo.com/testing/popup`
                  uri: `https://embed.connect.fastenhealth.com/?public-id=${CUSTOMER_PUBLIC_ID}&search-only=true&sdk-mode=react-native`
                  // uri: `https://embed.connect-dev.fastenhealth.com/?public-id=${CUSTOMER_PUBLIC_ID}&search-only=true&sdk-mode=react-native`
              }}
              javaScriptEnabled={true}
              webviewDebuggingEnabled={true} //TODO: not required in production
              domStorageEnabled={true}
              mixedContentMode={'always'}
              originWhitelist={['*']}
              // This will intercept the window.open event and open a new modal WebView instead
              onOpenWindow={primaryOnOpenWindow}
              onMessage={
                  (syntheticEvent) => {
                    messageBusOnMessage(CommunicationEntityPrimaryWebView, syntheticEvent);
                  }
              }
              onError={
                    (syntheticEvent) => {
                        const { nativeEvent } = syntheticEvent;
                        console.error(`[${CommunicationEntityPrimaryWebView}] WebView error: `, nativeEvent);
                    }
              }

              //you cant use `injectedJavaScript` because Modal webview will be redirected multiple times:
              // first to the Fasten Connect API endpoint
              // then to the Patient Portal (where the patient must login and consent)
              // finally back to the Fasten Connect API Callback endpoint where data will be shared using the postMessage API
              onNavigationStateChange={
                  (navState) => {
                      // Log the URL to see the navigation state
                      // console.debug('Primary WebView Navigation State:', navState);

                      if(navState.loading === false) {
                          primaryWebViewRef.current.injectJavaScript(commonOnNavigationStateChangeScript(CommunicationEntityPrimaryWebView));
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
                      webviewDebuggingEnabled={true} //TODO: not required in production
                      onMessage={
                          (syntheticEvent) => {
                              messageBusOnMessage(CommunicationEntityModalWebView, syntheticEvent);
                          }
                      }


                      //you cant use `injectedJavaScript` because Modal webview will be redirected multiple times:
                      // first to the Fasten Connect API endpoint
                      // then to the Patient Portal (where the patient must login and consent)
                      // finally back to the Fasten Connect API Callback endpoint where data will be shared using the postMessage API
                      //
                      // we also need to make sure that we inject the script as early as possible, since we need to overwrite the window.opener.postMessage() function,
                      // which is the only thing that is called in a popup window.

                        // OPTION 1
                      onNavigationStateChange={
                            (navState) => {
                                // Log the URL to see the navigation state
                                // console.debug('Modal WebView Navigation State:', navState);

                                //destination.html is used by the ACME Labs demo app to send the connection_id back to the parent window -- this can be removed in production code
                                //bridge/callback is used by Fasten Connect API in production to send the connection_id back to the parent window
                                if(navState.loading === false && (navState.url.includes('/destination.html') || navState.url.includes('/bridge/callback'))) {
                                    modalWebViewRef.current.injectJavaScript(commonOnNavigationStateChangeScript(CommunicationEntityModalWebView));
                                }
                            }
                      }

                      //BROKEN: OPTION 2
                      // onLoadStart={e => {
                      //     // injectedModalScript[e.nativeEvent.url] = false
                      //     console.log(`[${CommunicationEntityModalWebView}] load start: ${e.nativeEvent.url}`);
                      // }}
                      //
                      // onLoadProgress={e => {
                      //     console.log(`[${CommunicationEntityModalWebView}] progress:`, e.nativeEvent.progress, `url: ${e.nativeEvent.url}`);
                      //     // if ((e.nativeEvent.url.includes('/destination.html') || e.nativeEvent.url.includes('/bridge/callback')) && !injectedModalScript[e.nativeEvent.url]) {
                      //     if (e.nativeEvent.url.includes('/destination.html') || e.nativeEvent.url.includes('/bridge/callback')) {
                      //           // script has not been previously injected to this page, and the page is the destination.html or bridge/callback page
                      //         modalWebViewRef.current.injectJavaScript(commonOnNavigationStateChangeScript(CommunicationEntityModalWebView));
                      //         // injectedModalScript[e.nativeEvent.url] = true
                      //         console.log(`[${CommunicationEntityModalWebView}] injected`);
                      //     }
                      // }}

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
