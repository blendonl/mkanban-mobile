import { NativeModules, Platform } from 'react-native';

const { StoragePermissionModule } = NativeModules;

interface DirectoryItem {
  name: string;
  isDirectory: boolean;
}

interface StoragePermissionInterface {
  checkPermission(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  getExternalStoragePath(): Promise<string>;
  createDirectory(path: string): Promise<boolean>;
  isPathWritable(path: string): Promise<boolean>;
  writeFile(path: string, content: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  deleteFile(path: string): Promise<boolean>;
  fileExists(path: string): Promise<boolean>;
  directoryExists(path: string): Promise<boolean>;
  moveFile(sourcePath: string, destPath: string): Promise<boolean>;
  copyFile(sourcePath: string, destPath: string): Promise<boolean>;
  listDirectory(path: string): Promise<DirectoryItem[]>;
}

export const StoragePermission: StoragePermissionInterface = {
  async checkPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }
    try {
      return await StoragePermissionModule.checkPermission();
    } catch (error) {
      console.error('Failed to check storage permission:', error);
      return false;
    }
  },

  async requestPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }
    try {
      return await StoragePermissionModule.requestPermission();
    } catch (error) {
      console.error('Failed to request storage permission:', error);
      return false;
    }
  },

  async getExternalStoragePath(): Promise<string> {
    if (Platform.OS !== 'android') {
      return '';
    }
    try {
      return await StoragePermissionModule.getExternalStoragePath();
    } catch (error) {
      console.error('Failed to get external storage path:', error);
      return '';
    }
  },

  async createDirectory(path: string): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    try {
      return await StoragePermissionModule.createDirectory(path);
    } catch (error) {
      console.error('Failed to create directory:', error);
      return false;
    }
  },

  async isPathWritable(path: string): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    try {
      return await StoragePermissionModule.isPathWritable(path);
    } catch (error) {
      console.error('Failed to check path writability:', error);
      return false;
    }
  },

  async writeFile(path: string, content: string): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    return await StoragePermissionModule.writeFile(path, content);
  },

  async readFile(path: string): Promise<string> {
    if (Platform.OS !== 'android') {
      throw new Error('Not supported on this platform');
    }
    return await StoragePermissionModule.readFile(path);
  },

  async deleteFile(path: string): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    try {
      return await StoragePermissionModule.deleteFile(path);
    } catch (error) {
      console.error('Failed to delete file:', error);
      return false;
    }
  },

  async fileExists(path: string): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    try {
      return await StoragePermissionModule.fileExists(path);
    } catch (error) {
      return false;
    }
  },

  async directoryExists(path: string): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    try {
      return await StoragePermissionModule.directoryExists(path);
    } catch (error) {
      return false;
    }
  },

  async moveFile(sourcePath: string, destPath: string): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    return await StoragePermissionModule.moveFile(sourcePath, destPath);
  },

  async copyFile(sourcePath: string, destPath: string): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    return await StoragePermissionModule.copyFile(sourcePath, destPath);
  },

  async listDirectory(path: string): Promise<DirectoryItem[]> {
    if (Platform.OS !== 'android') {
      return [];
    }
    try {
      return await StoragePermissionModule.listDirectory(path);
    } catch (error) {
      console.error('Failed to list directory:', error);
      return [];
    }
  },
};

export async function hasExternalStorageAccess(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }
  const hasPermission = await StoragePermission.checkPermission();
  const externalPath = await StoragePermission.getExternalStoragePath();
  return hasPermission && externalPath.length > 0;
}

export async function getDefaultExternalBoardsPath(): Promise<string | null> {
  if (Platform.OS !== 'android') {
    return null;
  }
  const hasAccess = await hasExternalStorageAccess();
  if (!hasAccess) {
    return null;
  }
  const externalPath = await StoragePermission.getExternalStoragePath();
  return `${externalPath}/mkanban/boards/`;
}

export async function getDefaultExternalDataPath(): Promise<string | null> {
  if (Platform.OS !== 'android') {
    return null;
  }
  const hasAccess = await hasExternalStorageAccess();
  if (!hasAccess) {
    return null;
  }
  const externalPath = await StoragePermission.getExternalStoragePath();
  return `${externalPath}/mkanban/`;
}
