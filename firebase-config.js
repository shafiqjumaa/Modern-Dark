// 🔧 خطوات التفعيل (راجع دليل النشر لو نسيت التفاصيل):
// 1) أنشئ مشروعاً على https://console.firebase.google.com
// 2) فعّل Firestore Database (Build → Firestore Database → Create database → Test mode)
// 3) من إعدادات المشروع → أضف تطبيق ويب (Web) → انسخ القيم بالأسفل وضعها هنا
// 4) بعد التعديل، الحفظ فقط — اللعبة تكتشف تلقائياً أنك فعّلت Firebase وتنتقل لوضع أونلاين حقيقي
//
// طالما القيم بالأسفل لم تُعدَّل، اللعبة تعمل بـ"وضع تجربة محلي" (لاعب واحد بمتصفح واحد، بدون مزامنة فعلية).

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

export const IS_CONFIGURED = firebaseConfig.apiKey !== "YOUR_API_KEY_HERE";
