import { createElement, useEffect, useState } from "react";
import { Platform, StyleSheet, Text, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedIcon } from "@/components/animated-icon";
import { HintRow } from "@/components/hint-row";
import {
  checkBackend,
  getDevMenuHint,
  postMessage,
} from "@/components/stupid_functions";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { WebBadge } from "@/components/web-badge";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";

export default function HomeScreen() {
  const [health, setHealth] = useState("Checking…");
  const [uptime, setUptime] = useState("...");
  const [uptime_message, setUptimeMessage] = useState("searching the ethers");
  const [message, setMessage] = useState("");
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);
  const [streamStatus, setStreamStatus] = useState(
    Platform.OS === "web"
      ? "Connecting to messages…"
      : "Live messaging is currently available in the web browser.",
  );
  const [sendStatus, setSendStatus] = useState("");
  const [sending, setSending] = useState(false);

  async function sendMessage() {
    if (!message.trim() || sending) return;

    const submittedMessage = message;

    setSending(true);
    setSendStatus("Sending…");

    try {
      await postMessage(submittedMessage.trim());

      // Clear only if the user hasn't typed something new while waiting.
      setMessage((current) => (current === submittedMessage ? "" : current));

      setSendStatus("Sent");
    } catch {
      setSendStatus("Message could not be sent. Try again.");
    } finally {
      setSending(false);
    }
  }


  useEffect(() => {

    let active = true;
    let counter: EventSource | undefined;
    let messages: EventSource | undefined;

    async function initialize() {
      const health = await checkBackend();
      if (!active) return;
      setHealth(health);

      if (typeof EventSource === "undefined") return;
      counter = new EventSource("http://localhost:8000/counter");

      counter.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // The backend sends the message and count in separate events.
        if (data.message !== undefined) setUptimeMessage(data.message);
        if (data.count !== undefined) setUptime(String(data.count));
      };

      counter.onerror = () => {
        setUptime("Unavailable");
        setUptimeMessage("Mainframe aborted the patch…");
      };

      messages = new EventSource("http://localhost:8000/messaging");
      messages.onopen = () => setStreamStatus("Listening for messages");
      messages.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (typeof data.message === "string") {
            setReceivedMessages((previous) =>
              [...previous, data.message].slice(-50),
            );
          }
        } catch {
          setStreamStatus("Received an invalid message");
        }
      };
      messages.onerror = () =>
        setStreamStatus("Messages disconnected—reconnecting…");
    }

    void initialize();

    return () => {
      active = false;
      counter?.close();
      messages?.close();
    };
  }, []);

  return createElement(
    ThemedView,
    { style: styles.container },
    createElement(
      SafeAreaView,
      { style: styles.safeArea },
      createElement(
        ThemedView,
        { style: styles.heroSection },
        createElement(AnimatedIcon),
        createElement(
          ThemedText,
          { type: "title", style: styles.title },
          "Welcome to Expo",
        ),
      ),
      createElement(
        ThemedText,
        { type: "code", style: styles.code },
        "get started",
      ),
      createElement(
        ThemedView,
        { type: "backgroundElement", style: styles.stepContainer },
        createElement(HintRow, {
          title: "Carter Tried editing, you should too",
          hint: createElement(
            ThemedText,
            { type: "code" },
            "src/app/index.tsx",
          ),
        }),
        createElement(HintRow, {
          title: "Developer tools",
          hint: getDevMenuHint(),
        }),
        createElement(HintRow, {
          title: "Fresh start",
          hint: createElement(
            ThemedText,
            { type: "code" },
            "pnpm reset-project",
          ),
        }),
        createElement(HintRow, {
          title: "Status of the backend API",
          hint: createElement(Text, null, "Backend: ", health),
        }),
        createElement(HintRow, {
          title: "How long have you been here?",
          hint: createElement(Text, null, " ", uptime_message, " ", uptime),
        }),
        createElement(ThemedText, { type: "small" }, streamStatus),
        ...receivedMessages.map((text, index) =>
          createElement(ThemedText, { key: index }, text),
        ),
        createElement(ThemedText, { type: "small" }, sendStatus),
        createElement(TextInput, {
          placeholder: "Type a message...",
          accessibilityLabel: "Message",
          value: message,
          onChangeText: setMessage,
          onSubmitEditing: () => {
            void sendMessage();
          },
          returnKeyType: "send",
          style: {
            borderWidth: 1,
            borderColor: "#888",
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
            backgroundColor: "#fff",
            color: "#111",
            width: "100%",
          },
        }),
      ),
      Platform.OS === "web" ? createElement(WebBadge) : null,
    ),
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    flexDirection: "row",
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: "center",
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: "center",
  },
  code: {
    textTransform: "uppercase",
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: "stretch",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
});
