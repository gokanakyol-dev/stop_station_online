import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import RouteSelectionScreen from './src/screens/RouteSelectionScreen';
import FieldMapScreen from './src/screens/FieldMapScreen';
import StatsScreen from './src/screens/StatsScreen';
import { Text, View } from 'react-native';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Field Stack (Route Selection -> Field Map)
function FieldStack() {
  return (
    <Stack.Navigator
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
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            backgroundColor: '#1F2937',
            borderBottomColor: '#374151',
            borderBottomWidth: 1,
            borderTopWidth: 0,
            height: 70,
            paddingTop: 40,
            paddingBottom: 10,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8
          },
          tabBarActiveTintColor: '#10B981',
          tabBarInactiveTintColor: '#6B7280',
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600'
          }
        }}
      >
        <Tab.Screen 
          name="Field" 
          component={FieldStack}
          options={{
            tabBarLabel: 'Saha',
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 24 }}>📍</Text>
            )
          }}
        />
        <Tab.Screen 
          name="Stats" 
          component={StatsScreen}
          options={{
            tabBarLabel: 'İstatistik',
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 24 }}>📊</Text>
            )
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
