# 📺 تثبيت التطبيق على LG webOS TV

## الطريقة 1: عن طريق webOS CLI (موصى بها)

### المتطلبات
1. **Node.js** مثبت على الكمبيوتر
2. **webOS TV SDK** من LG:
   - حمّل من: https://webostv.developer.lge.com/develop/tools/cli-installation
   - أو: `npm install -g @anthropic/webos-cli`

### تفعيل Developer Mode على التلفزيون
1. على التلفزيون، افتح **LG Content Store**
2. ابحث عن **Developer Mode**
3. ثبّت التطبيق وافتحه
4. سجّل دخول بحساب LG Developer (سجّل مجاناً من https://webostv.developer.lge.com)
5. فعّل **Dev Mode** و **Key Server**
6. لاحظ الـ **IP Address** اللي بيظهر على الشاشة

### ربط الكمبيوتر بالتلفزيون
```bash
# أضف التلفزيون
ares-setup-device --add mytv --info "{'host':'IP_ADDRESS','port':'9922','username':'prisoner'}"

# اعمل مفتاح SSH
ares-novacom --device mytv --getkey

# تأكد من الاتصال
ares-device-info --device mytv
```

### بناء وتثبيت التطبيق
```bash
# 1. ابني التطبيق
bash scripts/build-webos.sh

# 2. اعمل ملف IPK
ares-package dist-webos

# 3. ثبّت على التلفزيون
ares-install --device mytv com.iptv.player_1.0.0_all.ipk

# 4. شغّل التطبيق
ares-launch --device mytv com.iptv.player
```

### تصحيح الأخطاء (Debug)
```bash
# افتح Inspector في المتصفح
ares-inspect --device mytv --app com.iptv.player --open
```
هيفتح Chrome DevTools تقدر تشوف فيه الـ console والـ network.

---

## الطريقة 2: عن طريق USB (بدون SDK)

> ⚠️ هذه الطريقة تحتاج تلفزيون في Dev Mode

1. ابني التطبيق:
   ```bash
   bash scripts/build-webos.sh
   ```

2. اضغط مجلد `dist-webos` كملف ZIP

3. غيّر الامتداد من `.zip` لـ `.ipk`

4. انقل ملف الـ IPK على فلاشة USB

5. على التلفزيون:
   - ادخل **Developer Mode** app
   - اختار **Install from USB**
   - اختار ملف الـ IPK

---

## الطريقة 3: Hosted App (الأسهل للتجربة)

بدل ما تثبّت التطبيق، ممكن تفتحه من متصفح التلفزيون مباشرة:

1. انشر التطبيق (Publish من Lovable)
2. على التلفزيون، افتح **Web Browser**
3. اكتب رابط التطبيق + `?tv=1`:
   ```
   https://your-app.lovable.app/?tv=1
   ```

> ملاحظة: متصفح LG بيدعم HTTP مباشرة، فالاتصال بـ Xtream هيشتغل بدون مشاكل.

---

## ملاحظات مهمة

- **الأيقونات**: محتاج `icon.png` (80×80) و `largeIcon.png` (130×130) في مجلد `public/tv/webos/`
- **Developer Mode** بينتهي كل 50 ساعة ومحتاج تجدده من التطبيق
- **الريموت**: التطبيق بيدعم التنقل بالأسهم والـ OK والـ Back
- **الأداء**: التلفزيون عنده رام محدود، التطبيق مصمم يكون خفيف
