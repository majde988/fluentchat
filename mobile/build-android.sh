#!/bin/bash
echo "========================================"
echo "  FluentChat Android Builder"
echo "========================================"
echo ""

echo "[1/4] تثبيت التبعيات..."
npm install

echo "[2/4] تهيئة Capacitor..."
npx cap init FluentChat com.fluentchat.app --web-dir ../public

echo "[3/4] إضافة Android..."
npx cap add android

echo "[4/4] مزامنة الملفات..."
npx cap sync android

echo ""
echo "========================================"
echo "  الخطوات التالية:"
echo "  1. افتح Android Studio"
echo "  2. npx cap open android"
echo "  3. Build > Build APK"
echo "========================================"
