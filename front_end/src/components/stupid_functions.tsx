import * as Device from "expo-device";
import { createElement } from "react";
import { Platform } from "react-native";

import { ThemedText } from "@/components/themed-text";

export function getDevMenuHint() {
  if (Platform.OS === "web") {
    return createElement(ThemedText, { type: "small" }, "use browser devtools");
  }
  if (Device.isDevice) {
    return createElement(
      ThemedText,
      { type: "small" },
      "shake device or press ",
      createElement(ThemedText, { type: "code" }, "m"),
      " in terminal",
    );
  }
  const shortcut = Platform.OS === "android" ? "cmd+m (or ctrl+m)" : "cmd+d";
  return createElement(
    ThemedText,
    { type: "small" },
    "press ",
    createElement(ThemedText, { type: "code" }, shortcut),
  );
}

// Keep this outside useEffect so the text input can call it with current text.
export async function postMessage(message: string) {
  const response = await fetch("http://localhost:8000/messaging", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: message }),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
}

export async function checkBackend() {
  try {
    const response = await fetch("http://localhost:8000/test");

    if (!response.ok) {
      return "Unavailable";
    }

    const data = await response.json();
    return data.message;
  } catch {
    return "Unavailable";
  }
}
