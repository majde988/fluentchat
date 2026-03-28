#!/bin/bash
echo "========================================"
echo "  FluentChat Desktop Builder"
echo "========================================"
echo ""

# تثبيت التبعيات
echo "[1/3] تثبيت التبعيات..."
npm install

# تنزيل أيقونة مؤقتة
echo "[2/3] تحضير الأيقونة..."
if [ ! -f icon.png ]; then
  curl -s -o icon.png "https://via.placeholder.com/256x256/0a84ff/ffffff?text=FC"
fi

# بناء التطبيق
echo "[3/3] بناء التطبيق..."
echo ""
echo "اختر النظام:"
echo "  1) Windows (.exe)"
echo "  2) macOS (.dmg)"
echo "  3) Linux (.AppImage)"
read -p "اختيارك: " choice

case $choice in
  1) npm run build-win ;;
  2) npm run build-mac ;;
  3) npm run build-linux ;;
  *) echo "اختيار غير صحيح" ;;
esac

echo ""
echo "========================================"
echo "  تم البناء! الملفات في مجلد dist/"
echo "========================================"
