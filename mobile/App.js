import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import RouteSelectionScreen from './src/screens/RouteSelectionScreen';
import FieldMapScreen from './src/screens/FieldMapScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="RouteSelection"
        screenOptions={{
          headerShown: false
        }}
      >
        <Stack.Screen 
          name="RouteSelection" 
          component={RouteSelectionScreen}
        />
        <Stack.Screen 
          name="FieldMap" 
          component={FieldMapScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
