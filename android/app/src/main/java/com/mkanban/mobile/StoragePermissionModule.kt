package com.mkanban.mobile

import android.os.Build
import android.os.Environment
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class StoragePermissionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "StoragePermissionModule"
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
            promise.reject("ERROR", "Failed to check permission: ${e.message}", e)
        }
    }

    @ReactMethod
    fun requestPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                if (!Environment.isExternalStorageManager()) {
                    val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                        data = Uri.parse("package:${reactApplicationContext.packageName}")
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
            promise.reject("ERROR", "Failed to request permission: ${e.message}", e)
        }
    }

    @ReactMethod
    fun getExternalStoragePath(promise: Promise) {
        try {
            val path = Environment.getExternalStorageDirectory().absolutePath
            promise.resolve(path)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get external storage path: ${e.message}", e)
        }
    }
}
