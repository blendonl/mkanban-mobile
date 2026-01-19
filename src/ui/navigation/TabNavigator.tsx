import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import FloatingTabBar from './FloatingTabBar';

import BoardListScreen from '../screens/BoardListScreen';
import BoardScreen from '../screens/BoardScreen';
import ItemDetailScreen from '../screens/ItemDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';

import ProjectListScreen from '../screens/projects/ProjectListScreen';
import ProjectDetailScreen from '../screens/projects/ProjectDetailScreen';
import AgendaScreen from '../screens/agenda/AgendaScreen';
import AgendaDayScreen from '../screens/agenda/AgendaDayScreen';
import TaskScheduleScreen from '../screens/agenda/TaskScheduleScreen';
import { AgendaItemDetailScreen } from '../screens/agenda/AgendaItemDetailScreen';
import GoalsListScreen from '../screens/goals/GoalsListScreen';
import GoalDetailScreen from '../screens/goals/GoalDetailScreen';
import NotesListScreen from '../screens/notes/NotesListScreen';
import NoteEditorScreen from '../screens/notes/NoteEditorScreen';
import TimeOverviewScreen from '../screens/time/TimeOverviewScreen';
import TimeLogDetailScreen from '../screens/time/TimeLogDetailScreen';

export type ProjectStackParamList = {
  ProjectList: undefined;
  ProjectDetail: { projectId: string };
  ProjectSettings: { projectId: string };
};

export type BoardStackParamList = {
  BoardList: { projectId?: string };
  Board: { boardId: string; projectId?: string };
  ItemDetail: { boardId: string; itemId?: string; columnId?: string };
  Settings: undefined;
};

export type AgendaStackParamList = {
  AgendaMain: undefined;
  AgendaDay: { date: string };
  AgendaItemDetail: { agendaItemId: string };
  AgendaItemForm: {
    agendaItemId?: string;
    projectId?: string;
    boardId?: string;
    taskId?: string;
    date?: string;
  };
  TaskSchedule: {
    taskId: string;
    boardId: string;
    taskData?: Record<string, any>;
    allowTypeEdit?: boolean;
  };
};

export type NotesStackParamList = {
  NotesList: { projectId?: string; boardId?: string; tagFilter?: string };
  NoteEditor: {
    noteId?: string;
    projectIds?: string[];
    boardIds?: string[];
    taskIds?: string[];
  };
};

export type TimeStackParamList = {
  TimeOverview: { projectId?: string };
  TimeLogDetail: { date: string; projectId?: string };
};

export type GoalsStackParamList = {
  GoalsList: undefined;
  GoalDetail: { goalId: string };
};

export type RootTabParamList = {
  ProjectsTab: undefined;
  BoardsTab: undefined;
  AgendaTab: undefined;
  GoalsTab: undefined;
  NotesTab: undefined;
  TimeTab: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const ProjectStack = createStackNavigator<ProjectStackParamList>();
const BoardStack = createStackNavigator<BoardStackParamList>();
const AgendaStack = createStackNavigator<AgendaStackParamList>();
const GoalsStack = createStackNavigator<GoalsStackParamList>();
const NotesStack = createStackNavigator<NotesStackParamList>();
const TimeStack = createStackNavigator<TimeStackParamList>();

const screenOptions = {
  headerShown: false,
};

function ProjectsStackNavigator() {
  return (
    <ProjectStack.Navigator screenOptions={screenOptions}>
      <ProjectStack.Screen name="ProjectList" component={ProjectListScreen} />
      <ProjectStack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
    </ProjectStack.Navigator>
  );
}

function BoardsStackNavigator() {
  return (
    <BoardStack.Navigator screenOptions={screenOptions}>
      <BoardStack.Screen name="BoardList" component={BoardListScreen} />
      <BoardStack.Screen name="Board" component={BoardScreen} />
      <BoardStack.Screen
        name="ItemDetail"
        component={ItemDetailScreen}
        options={{ presentation: 'modal' }}
      />
      <BoardStack.Screen name="Settings" component={SettingsScreen} />
    </BoardStack.Navigator>
  );
}

function AgendaStackNavigator() {
  return (
    <AgendaStack.Navigator screenOptions={screenOptions}>
      <AgendaStack.Screen name="AgendaMain" component={AgendaScreen} />
      <AgendaStack.Screen name="AgendaDay" component={AgendaDayScreen} />
      <AgendaStack.Screen name="AgendaItemDetail" component={AgendaItemDetailScreen} />
      <AgendaStack.Screen
        name="TaskSchedule"
        component={TaskScheduleScreen}
        options={{ presentation: 'modal', headerShown: false }}
      />
    </AgendaStack.Navigator>
  );
}

function GoalsStackNavigator() {
  return (
    <GoalsStack.Navigator screenOptions={screenOptions}>
      <GoalsStack.Screen name="GoalsList" component={GoalsListScreen} />
      <GoalsStack.Screen name="GoalDetail" component={GoalDetailScreen} />
    </GoalsStack.Navigator>
  );
}

function NotesStackNavigator() {
  return (
    <NotesStack.Navigator screenOptions={screenOptions}>
      <NotesStack.Screen name="NotesList" component={NotesListScreen} />
      <NotesStack.Screen
        name="NoteEditor"
        component={NoteEditorScreen}
        options={{ presentation: 'modal' }}
      />
    </NotesStack.Navigator>
  );
}

function TimeStackNavigator() {
  return (
    <TimeStack.Navigator screenOptions={screenOptions}>
      <TimeStack.Screen name="TimeOverview" component={TimeOverviewScreen} />
      <TimeStack.Screen name="TimeLogDetail" component={TimeLogDetailScreen} />
    </TimeStack.Navigator>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="ProjectsTab" component={ProjectsStackNavigator} />
      <Tab.Screen name="BoardsTab" component={BoardsStackNavigator} />
      <Tab.Screen name="AgendaTab" component={AgendaStackNavigator} />
      <Tab.Screen name="GoalsTab" component={GoalsStackNavigator} />
      <Tab.Screen name="NotesTab" component={NotesStackNavigator} />
      <Tab.Screen name="TimeTab" component={TimeStackNavigator} />
    </Tab.Navigator>
  );
}
