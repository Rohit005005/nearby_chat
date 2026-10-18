import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, SafeAreaView } from "react-native";
import useBLEChat from "../hooks/useBLEChat";

export default function ChatScreen({ route, navigation }: any) {
  // Parameters passed from MetroScreen after a successful handshake
  const { deviceId, sharedSecretHex, encounterId, bleManager } = route.params;

  const { messages, sendMessage } = useBLEChat(bleManager, deviceId, sharedSecretHex, encounterId);
  const [inputText, setInputText] = useState("");

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage(inputText.trim());
    setInputText("");
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <View className="flex-row items-center p-4 border-b border-slate-800 bg-slate-900">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
          <Text className="text-sky-500 font-semibold">{"< Leave"}</Text>
        </TouchableOpacity>
        <Text className="text-slate-100 font-bold text-lg">Secure Offline Chat</Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <View className={`mb-3 max-w-[80%] rounded-2xl px-4 py-2.5 ${
            item.isFromMe
              ? "bg-emerald-600 self-end rounded-tr-sm"
              : "bg-slate-800 self-start rounded-tl-sm"
          }`}>
            <Text className="text-white text-base">{item.text}</Text>
          </View>
        )}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="p-4 bg-slate-900 border-t border-slate-800 flex-row items-center"
      >
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type an offline message..."
          placeholderTextColor="#64748B"
          className="flex-1 bg-slate-800 text-slate-100 px-4 py-3 rounded-full mr-3"
        />
        <TouchableOpacity
          onPress={handleSend}
          className="bg-sky-500 w-12 h-12 rounded-full items-center justify-center"
        >
          <Text className="text-white font-bold">Send</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
