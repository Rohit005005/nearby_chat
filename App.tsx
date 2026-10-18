import "./global.css";
import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import MetroScreen from "./src/screens/MetroScreen";
import ChatScreen from "./src/screens/ChatScreen";
import { runOfflineSync } from "./src/lib/syncEngine";
import { initializeDatabase } from "./src/db/init";

const BACKGROUND_SYNC_TASK = "BACKGROUND_SYNC_TASK";

// 1. Define the task globally
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  const success = await runOfflineSync();
  return success
    ? BackgroundFetch.BackgroundFetchResult.NewData
    : BackgroundFetch.BackgroundFetchResult.Failed;
});

const Stack = createNativeStackNavigator();

initializeDatabase()

export default function App() {

  // 2. Register the task on app mount
  useEffect(() => {
    const registerSyncTask = async () => {
      try {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
          minimumInterval: 15 * 60, // Minimum 15 minutes between background runs
          stopOnTerminate: false, // Keep running even if app is swiped away
          startOnBoot: true,
        });
        console.log("Background sync task registered.");
      } catch (err) {
        console.error("Failed to register background task:", err);
      }
    };

    registerSyncTask();
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MetroScreen" component={MetroScreen} />
        <Stack.Screen name="ChatScreen" component={ChatScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
