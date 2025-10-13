# 🔧 إصلاح Znet Adapter - استخدام oyun و kupur من Payload

## 🐛 المشكلة

كان `place_order()` في `znet.py` يتجاهل القيم المُرسلة في `payload.params` ويستخدم `provider_package_id` مباشرة:

```python
# قبل ❌
q: Dict[str, Any] = {
    'oyun': provider_package_id,  # 632 (خطأ!)
    'referans': referans,
}
if payload.get('kupur') is not None:
    q['kupur'] = payload.get('kupur')
```

**النتيجة:**
- `services.py` يرسل: `{'oyun': '1', 'kupur': '60'}` ✅
- لكن `znet.py` يستبدل oyun بـ `632` ❌
- المزود يرفض: "Kupur Bilgisi Bulunamadı"

---

## ✅ الإصلاح

### التعديلات:

```python
# بعد ✅
params_dict = payload.get('params', {})
oyun = params_dict.get('oyun') or provider_package_id
kupur = params_dict.get('kupur')

q: Dict[str, Any] = {
    'oyun': oyun,  # 1 من metadata! ✅
    'referans': referans,
}
if kupur is not None:
    q['kupur'] = kupur

# استخدام oyuncu_bilgi من params أولاً
oyuncu_bilgi = params_dict.get('oyuncu_bilgi') or payload.get('extraField')
if oyuncu_bilgi:
    q['oyuncu_bilgi'] = oyuncu_bilgi
```

### إضافة Logging:

```python
print(f"🌐 [ZNET] Final request URL params:")
print(f"   - oyun: {q.get('oyun')}")
print(f"   - kupur: {q.get('kupur')}")
print(f"   - oyuncu_bilgi: {q.get('oyuncu_bilgi')}")
print(f"   - referans: {q.get('referans')}")
print(f"   - musteri_tel: {q.get('musteri_tel')}")
```

---

## 🧪 الاختبار

أنشئ طلب جديد وسترى:

```
📤 Step 9: Building payload...
   - Params: {'oyuncu_bilgi': '5555', 'extra': '5555', 'oyun': '1', 'kupur': '60'}

🚀 Step 11: SENDING ORDER TO PROVIDER...
   📡 Calling adapter.place_order()...
   
   🌐 [ZNET] Final request URL params:
      - oyun: 1          ← ✅ القيمة الصحيحة!
      - kupur: 60        ← ✅ القيمة الصحيحة!
      - oyuncu_bilgi: 5555
      - referans: xxx-xxx
      - musteri_tel: 5555
   
   ✅ Provider responded!
   - Response: {'status': 'sent', 'note': 'OK|cost=37.60|balance=1234.56'}  ← ✅ نجح!
```

---

## 📝 الملخص

| المعامل | قبل | بعد |
|---------|-----|-----|
| `oyun` | 632 (package ID) ❌ | 1 (oyun_bilgi_id) ✅ |
| `kupur` | من payload مباشرة | من params أولاً ✅ |
| `oyuncu_bilgi` | من extraField فقط | من params أولاً ✅ |

الآن الـ adapter يحترم القيم المُجهزة في `services.py`! 🎯
