const { withMainApplication, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const STORAGE_PERMISSION_MODULE = `package com.mkanban.mprojectmanager

import android.os.Build
import android.os.Environment
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Arguments
import java.io.File

class StoragePermissionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "StoragePermissionModule"
    }

    override fun getName(): String {
        return NAME
    }

    @ReactMethod
    fun checkPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val granted = Environment.isExternalStorageManager()
                promise.resolve(granted)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to check permission: \${e.message}", e)
        }
    }

    @ReactMethod
    fun requestPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                if (!Environment.isExternalStorageManager()) {
                    val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                        data = Uri.parse("package:\${reactApplicationContext.packageName}")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    reactApplicationContext.startActivity(intent)
                    promise.resolve(false)
                } else {
                    promise.resolve(true)
                }
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to request permission: \${e.message}", e)
        }
    }

    @ReactMethod
    fun getExternalStoragePath(promise: Promise) {
        try {
            val path = Environment.getExternalStorageDirectory().absolutePath
            promise.resolve(path)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get external storage path: \${e.message}", e)
        }
    }

    @ReactMethod
    fun createDirectory(path: String, promise: Promise) {
        try {
            val dir = File(path)
            if (dir.exists()) {
                promise.resolve(true)
                return
            }
            val created = dir.mkdirs()
            promise.resolve(created)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to create directory: \${e.message}", e)
        }
    }

    @ReactMethod
    fun isPathWritable(path: String, promise: Promise) {
        try {
            val dir = File(path)
            if (!dir.exists()) {
                val created = dir.mkdirs()
                if (!created) {
                    promise.resolve(false)
                    return
                }
            }
            val testFile = File(dir, ".write-test-\${System.currentTimeMillis()}")
            val canWrite = testFile.createNewFile()
            if (canWrite) {
                testFile.delete()
            }
            promise.resolve(canWrite)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun writeFile(path: String, content: String, promise: Promise) {
        try {
            val file = File(path)
            file.parentFile?.mkdirs()
            file.writeText(content, Charsets.UTF_8)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to write file: \${e.message}", e)
        }
    }

    @ReactMethod
    fun readFile(path: String, promise: Promise) {
        try {
            val file = File(path)
            if (!file.exists()) {
                promise.reject("NOT_FOUND", "File does not exist: \$path")
                return
            }
            val content = file.readText(Charsets.UTF_8)
            promise.resolve(content)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to read file: \${e.message}", e)
        }
    }

    @ReactMethod
    fun deleteFile(path: String, promise: Promise) {
        try {
            val file = File(path)
            if (!file.exists()) {
                promise.resolve(true)
                return
            }
            val deleted = file.delete()
            promise.resolve(deleted)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to delete file: \${e.message}", e)
        }
    }

    @ReactMethod
    fun fileExists(path: String, promise: Promise) {
        try {
            val file = File(path)
            promise.resolve(file.exists() && file.isFile)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to check file: \${e.message}", e)
        }
    }

    @ReactMethod
    fun directoryExists(path: String, promise: Promise) {
        try {
            val file = File(path)
            promise.resolve(file.exists() && file.isDirectory)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to check directory: \${e.message}", e)
        }
    }

    @ReactMethod
    fun moveFile(sourcePath: String, destPath: String, promise: Promise) {
        try {
            val sourceFile = File(sourcePath)
            val destFile = File(destPath)
            if (!sourceFile.exists()) {
                promise.reject("NOT_FOUND", "Source file does not exist")
                return
            }
            destFile.parentFile?.mkdirs()
            val success = sourceFile.renameTo(destFile)
            promise.resolve(success)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to move file: \${e.message}", e)
        }
    }

    @ReactMethod
    fun copyFile(sourcePath: String, destPath: String, promise: Promise) {
        try {
            val sourceFile = File(sourcePath)
            val destFile = File(destPath)
            if (!sourceFile.exists()) {
                promise.reject("NOT_FOUND", "Source file does not exist")
                return
            }
            destFile.parentFile?.mkdirs()
            sourceFile.copyTo(destFile, overwrite = true)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to copy file: \${e.message}", e)
        }
    }

    @ReactMethod
    fun listDirectory(path: String, promise: Promise) {
        try {
            val dir = File(path)
            if (!dir.exists() || !dir.isDirectory) {
                promise.resolve(Arguments.createArray())
                return
            }
            val items = Arguments.createArray()
            dir.listFiles()?.forEach { file ->
                val item = Arguments.createMap()
                item.putString("name", file.name)
                item.putBoolean("isDirectory", file.isDirectory)
                items.pushMap(item)
            }
            promise.resolve(items)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to list directory: \${e.message}", e)
        }
    }
}
`;

const STORAGE_PERMISSION_PACKAGE = `package com.mkanban.mprojectmanager

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class StoragePermissionPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(StoragePermissionModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;

function withStoragePermissionFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const packagePath = path.join(
        projectRoot,
        'android/app/src/main/java/com/mkanban/mprojectmanager'
      );

      fs.mkdirSync(packagePath, { recursive: true });

      fs.writeFileSync(
        path.join(packagePath, 'StoragePermissionModule.kt'),
        STORAGE_PERMISSION_MODULE
      );

      fs.writeFileSync(
        path.join(packagePath, 'StoragePermissionPackage.kt'),
        STORAGE_PERMISSION_PACKAGE
      );

      return config;
    },
  ]);
}

function withStoragePermissionMainApplication(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('StoragePermissionPackage')) {
      contents = contents.replace(
        /PackageList\(this\)\.packages\.apply\s*\{/,
        `PackageList(this).packages.apply {
              add(StoragePermissionPackage())`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = function withStoragePermission(config) {
  config = withStoragePermissionFiles(config);
  config = withStoragePermissionMainApplication(config);
  return config;
};
