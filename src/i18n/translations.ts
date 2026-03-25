export type Locale = 'en' | 'ar' | 'tr';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
  tr: 'Türkçe',
};

export const localeDirection: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ar: 'rtl',
  tr: 'ltr',
};

type TranslationKeys = {
  // Common
  appName: string;
  loading: string;
  save: string;
  cancel: string;
  delete: string;
  confirm: string;
  back: string;
  search: string;
  settings: string;
  signOut: string;
  signIn: string;
  signUp: string;
  email: string;
  password: string;
  name: string;
  submit: string;
  
  // Auth
  authLoginTitle: string;
  authSignupTitle: string;
  authLoginSubtitle: string;
  authSignupSubtitle: string;
  authForgotPassword: string;
  authNoAccount: string;
  authHasAccount: string;
  authDisplayName: string;
  authCheckEmail: string;
  authCreateAccount: string;
  
  // Player
  playerSelectChannel: string;
  playerChannels: string;
  playerCategories: string;
  playerFavorites: string;
  playerSearchPlaceholder: string;
  playerResumeTitle: string;
  playerResumeMessage: string;
  playerResume: string;
  playerStartOver: string;
  
  // Playlist
  playlistTitle: string;
  playlistSubtitle: string;
  playlistM3U: string;
  playlistXtream: string;
  playlistURL: string;
  playlistLoad: string;
  
  // Access
  accessActivationRequired: string;
  accessTrialExpired: string;
  accessSubscribeNow: string;
  accessCheckActivation: string;
  accessManageDevices: string;
  accessTrialRemaining: string;
  accessActivateMessage: string;
  accessAccountSuspended: string;
  accessBanExpires: string;
  
  // Settings
  settingsTitle: string;
  settingsProfile: string;
  settingsDevices: string;
  settingsSecurity: string;
  settingsLanguage: string;
  settingsMaxDevices: string;
  settingsSubscription: string;
  settingsNoSubscription: string;
  settingsActiveUntil: string;
  settingsChangePassword: string;
  settingsNewPassword: string;
  settingsConfirmPassword: string;
  settingsUpdatePassword: string;
  settingsDevicesActive: string;
  
  // Notifications
  notificationsTitle: string;
  notificationsMarkAllRead: string;
  notificationsClearRead: string;
  notificationsEmpty: string;
  notificationsUnread: string;
  notificationsAll: string;
  notificationsDevice: string;
  notificationsSubscription: string;
  notificationsWarning: string;
  notificationsTrial: string;
  notificationsInfo: string;
  
  // Pricing
  pricingTitle: string;
  pricingSubtitle: string;
  pricingMonthly: string;
  pricingYearly: string;
  pricingLifetime: string;
  pricingMonth: string;
  pricingYear: string;
  pricingOneTime: string;
  pricingMostPopular: string;
  pricingGet: string;
  pricingProcessing: string;
  pricingInternational: string;
  pricingEgypt: string;
  pricingCouponPlaceholder: string;
  pricingApplyCoupon: string;
  pricingCouponApplied: string;
  
  // Subscription
  subscriptionTitle: string;
  subscriptionManage: string;
  subscriptionCurrentStatus: string;
  subscriptionLifetime: string;
  subscriptionActive: string;
  subscriptionFreeTrial: string;
  subscriptionNoActive: string;
  subscriptionPaymentHistory: string;
  subscriptionViewPlans: string;
  subscriptionUpgrade: string;
  
  // Admin
  adminTitle: string;
  adminUsers: string;
  adminDevices: string;
  adminSubs: string;
  adminAnalytics: string;
  adminPayments: string;
  adminNotify: string;
  adminBrand: string;
  adminTrial: string;
  adminApiKeys: string;
  adminResellers: string;
  adminCoupons: string;
  adminSecurity: string;
  adminTotalUsers: string;
  adminActiveDevices: string;
  adminActiveSubs: string;
  adminTotalSessions: string;
  adminGrantSubscription: string;
  
  // Reseller
  resellerPanel: string;
  resellerBalance: string;
  resellerCredits: string;
  resellerBuyCredits: string;
  resellerActivateUser: string;
  resellerTransactions: string;
  resellerCommission: string;
  
  // Coupon
  couponCreate: string;
  couponCode: string;
  couponDiscount: string;
  couponPercentage: string;
  couponFixed: string;
  couponTrialExtension: string;
  couponMaxUses: string;
  couponExpiry: string;
  couponActive: string;
  couponExpired: string;
  
  // Movies & Series
  moviesTitle: string;
  moviesSearchPlaceholder: string;
  moviesEmpty: string;
  seriesTitle: string;
  seriesSearchPlaceholder: string;
  seriesEmpty: string;
  allCategories: string;
  sortByName: string;
  sortByCategory: string;
  
  // Time
  timeJustNow: string;
  timeMinAgo: string;
  timeHoursAgo: string;
  timeDaysAgo: string;
};

const en: TranslationKeys = {
  appName: 'IPTV Player',
  loading: 'Loading...',
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  confirm: 'Confirm',
  back: 'Back',
  search: 'Search',
  settings: 'Settings',
  signOut: 'Sign Out',
  signIn: 'Sign In',
  signUp: 'Sign Up',
  email: 'Email',
  password: 'Password',
  name: 'Name',
  submit: 'Submit',
  
  authLoginTitle: 'Sign in to your account',
  authSignupTitle: 'Create a new account',
  authLoginSubtitle: 'Sign in to your account',
  authSignupSubtitle: 'Create a new account',
  authForgotPassword: 'Forgot password?',
  authNoAccount: "Don't have an account? ",
  authHasAccount: 'Already have an account? ',
  authDisplayName: 'Display Name',
  authCheckEmail: 'Check your email for a confirmation link!',
  authCreateAccount: 'Create Account',
  
  playerSelectChannel: 'Select a channel to start watching',
  playerChannels: 'channels',
  playerCategories: 'Categories',
  playerFavorites: 'Favorites',
  playerSearchPlaceholder: 'Search channels...',
  playerResumeTitle: 'Resume Playback',
  playerResumeMessage: 'Continue from where you left off?',
  playerResume: 'Resume',
  playerStartOver: 'Start Over',
  
  playlistTitle: 'Setup Your Playlist',
  playlistSubtitle: 'Add your IPTV source to get started',
  playlistM3U: 'M3U Playlist',
  playlistXtream: 'Xtream Codes',
  playlistURL: 'Playlist URL',
  playlistLoad: 'Load Playlist',
  
  accessActivationRequired: 'Activation Required',
  accessTrialExpired: 'Expired',
  accessSubscribeNow: 'Subscribe Now',
  accessCheckActivation: 'Check Activation',
  accessManageDevices: 'Manage Devices',
  accessTrialRemaining: 'day(s) remaining',
  accessActivateMessage: 'Contact your provider to activate your subscription. Once activated, the app will work immediately.',
  accessAccountSuspended: 'Account Temporarily Suspended',
  accessBanExpires: 'Access will be restored at',
  
  settingsTitle: 'Settings',
  settingsProfile: 'Profile',
  settingsDevices: 'Devices',
  settingsSecurity: 'Security',
  settingsLanguage: 'Language',
  settingsMaxDevices: 'Max Devices',
  settingsSubscription: 'Subscription',
  settingsNoSubscription: 'No active subscription',
  settingsActiveUntil: 'Active until',
  settingsChangePassword: 'Change Password',
  settingsNewPassword: 'New password',
  settingsConfirmPassword: 'Confirm new password',
  settingsUpdatePassword: 'Update Password',
  settingsDevicesActive: 'devices active',
  
  notificationsTitle: 'Notifications',
  notificationsMarkAllRead: 'Mark all read',
  notificationsClearRead: 'Clear read',
  notificationsEmpty: 'No notifications',
  notificationsUnread: 'Unread',
  notificationsAll: 'All',
  notificationsDevice: 'Device',
  notificationsSubscription: 'Subscription',
  notificationsWarning: 'Warning',
  notificationsTrial: 'Trial',
  notificationsInfo: 'Info',
  
  pricingTitle: 'Choose Your Plan',
  pricingSubtitle: 'Select a plan to unlock full access',
  pricingMonthly: 'Monthly',
  pricingYearly: 'Yearly',
  pricingLifetime: 'Lifetime',
  pricingMonth: '/month',
  pricingYear: '/year',
  pricingOneTime: 'one-time',
  pricingMostPopular: 'Most Popular',
  pricingGet: 'Get',
  pricingProcessing: 'Processing...',
  pricingInternational: 'International (USD)',
  pricingEgypt: 'Egypt (EGP)',
  pricingCouponPlaceholder: 'Enter coupon code',
  pricingApplyCoupon: 'Apply',
  pricingCouponApplied: 'Coupon applied!',
  
  subscriptionTitle: 'Subscription',
  subscriptionManage: 'Manage your subscription and payments',
  subscriptionCurrentStatus: 'Current Status',
  subscriptionLifetime: 'Lifetime Plan',
  subscriptionActive: 'Active Subscription',
  subscriptionFreeTrial: 'Free Trial',
  subscriptionNoActive: 'No Active Subscription',
  subscriptionPaymentHistory: 'Payment History',
  subscriptionViewPlans: 'View Plans & Subscribe',
  subscriptionUpgrade: 'Upgrade Plan',
  
  adminTitle: 'Admin Dashboard',
  adminUsers: 'Users',
  adminDevices: 'Devices',
  adminSubs: 'Subs',
  adminAnalytics: 'Analytics',
  adminPayments: 'Payments',
  adminNotify: 'Notify',
  adminBrand: 'Brand',
  adminTrial: 'Trial',
  adminApiKeys: 'API Keys',
  adminResellers: 'Resellers',
  adminCoupons: 'Coupons',
  adminSecurity: 'Security',
  adminTotalUsers: 'Total Users',
  adminActiveDevices: 'Active Devices',
  adminActiveSubs: 'Active Subs',
  adminTotalSessions: 'Total Sessions',
  adminGrantSubscription: 'Grant Subscription',
  
  resellerPanel: 'Reseller Panel',
  resellerBalance: 'Balance',
  resellerCredits: 'Credits',
  resellerBuyCredits: 'Buy Credits',
  resellerActivateUser: 'Activate User',
  resellerTransactions: 'Transactions',
  resellerCommission: 'Commission',
  
  couponCreate: 'Create Coupon',
  couponCode: 'Coupon Code',
  couponDiscount: 'Discount',
  couponPercentage: 'Percentage',
  couponFixed: 'Fixed Amount',
  couponTrialExtension: 'Trial Extension',
  couponMaxUses: 'Max Uses',
  couponExpiry: 'Expiry Date',
  couponActive: 'Active',
  couponExpired: 'Expired',
  
  moviesTitle: 'Movies',
  moviesSearchPlaceholder: 'Search movies...',
  moviesEmpty: 'No movies found',
  seriesTitle: 'Series',
  seriesSearchPlaceholder: 'Search series...',
  seriesEmpty: 'No series found',
  allCategories: 'All',
  sortByName: 'Sort by Name',
  sortByCategory: 'Sort by Category',
  
  timeJustNow: 'Just now',
  timeMinAgo: 'min ago',
  timeHoursAgo: 'h ago',
  timeDaysAgo: 'd ago',
};

const ar: TranslationKeys = {
  appName: 'مشغل IPTV',
  loading: 'جاري التحميل...',
  save: 'حفظ',
  cancel: 'إلغاء',
  delete: 'حذف',
  confirm: 'تأكيد',
  back: 'رجوع',
  search: 'بحث',
  settings: 'الإعدادات',
  signOut: 'تسجيل الخروج',
  signIn: 'تسجيل الدخول',
  signUp: 'إنشاء حساب',
  email: 'البريد الإلكتروني',
  password: 'كلمة المرور',
  name: 'الاسم',
  submit: 'إرسال',
  
  authLoginTitle: 'تسجيل الدخول إلى حسابك',
  authSignupTitle: 'إنشاء حساب جديد',
  authLoginSubtitle: 'قم بتسجيل الدخول إلى حسابك',
  authSignupSubtitle: 'أنشئ حساباً جديداً',
  authForgotPassword: 'نسيت كلمة المرور؟',
  authNoAccount: 'ليس لديك حساب؟ ',
  authHasAccount: 'لديك حساب بالفعل؟ ',
  authDisplayName: 'اسم العرض',
  authCheckEmail: 'تحقق من بريدك الإلكتروني لرابط التأكيد!',
  authCreateAccount: 'إنشاء حساب',
  
  playerSelectChannel: 'اختر قناة للمشاهدة',
  playerChannels: 'قناة',
  playerCategories: 'التصنيفات',
  playerFavorites: 'المفضلة',
  playerSearchPlaceholder: 'ابحث عن القنوات...',
  playerResumeTitle: 'استئناف التشغيل',
  playerResumeMessage: 'المتابعة من حيث توقفت؟',
  playerResume: 'استئناف',
  playerStartOver: 'البدء من جديد',
  
  playlistTitle: 'إعداد قائمة التشغيل',
  playlistSubtitle: 'أضف مصدر IPTV للبدء',
  playlistM3U: 'قائمة M3U',
  playlistXtream: 'Xtream Codes',
  playlistURL: 'رابط القائمة',
  playlistLoad: 'تحميل القائمة',
  
  accessActivationRequired: 'التفعيل مطلوب',
  accessTrialExpired: 'منتهي',
  accessSubscribeNow: 'اشترك الآن',
  accessCheckActivation: 'تحقق من التفعيل',
  accessManageDevices: 'إدارة الأجهزة',
  accessTrialRemaining: 'يوم متبقي',
  accessActivateMessage: 'تواصل مع المزود لتفعيل اشتراكك. بمجرد التفعيل، سيعمل التطبيق فوراً.',
  accessAccountSuspended: 'الحساب موقوف مؤقتاً',
  accessBanExpires: 'سيتم استعادة الوصول في',
  
  settingsTitle: 'الإعدادات',
  settingsProfile: 'الملف الشخصي',
  settingsDevices: 'الأجهزة',
  settingsSecurity: 'الأمان',
  settingsLanguage: 'اللغة',
  settingsMaxDevices: 'أقصى عدد أجهزة',
  settingsSubscription: 'الاشتراك',
  settingsNoSubscription: 'لا يوجد اشتراك نشط',
  settingsActiveUntil: 'نشط حتى',
  settingsChangePassword: 'تغيير كلمة المرور',
  settingsNewPassword: 'كلمة المرور الجديدة',
  settingsConfirmPassword: 'تأكيد كلمة المرور',
  settingsUpdatePassword: 'تحديث كلمة المرور',
  settingsDevicesActive: 'أجهزة نشطة',
  
  notificationsTitle: 'الإشعارات',
  notificationsMarkAllRead: 'تعليم الكل مقروء',
  notificationsClearRead: 'مسح المقروءة',
  notificationsEmpty: 'لا توجد إشعارات',
  notificationsUnread: 'غير مقروءة',
  notificationsAll: 'الكل',
  notificationsDevice: 'جهاز',
  notificationsSubscription: 'اشتراك',
  notificationsWarning: 'تحذير',
  notificationsTrial: 'تجريبي',
  notificationsInfo: 'معلومات',
  
  pricingTitle: 'اختر خطتك',
  pricingSubtitle: 'اختر خطة لفتح الوصول الكامل',
  pricingMonthly: 'شهري',
  pricingYearly: 'سنوي',
  pricingLifetime: 'مدى الحياة',
  pricingMonth: '/شهر',
  pricingYear: '/سنة',
  pricingOneTime: 'مرة واحدة',
  pricingMostPopular: 'الأكثر شعبية',
  pricingGet: 'احصل على',
  pricingProcessing: 'جاري المعالجة...',
  pricingInternational: 'دولي (دولار)',
  pricingEgypt: 'مصر (جنيه)',
  pricingCouponPlaceholder: 'أدخل كود الخصم',
  pricingApplyCoupon: 'تطبيق',
  pricingCouponApplied: 'تم تطبيق الكوبون!',
  
  subscriptionTitle: 'الاشتراك',
  subscriptionManage: 'إدارة اشتراكك والمدفوعات',
  subscriptionCurrentStatus: 'الحالة الحالية',
  subscriptionLifetime: 'خطة مدى الحياة',
  subscriptionActive: 'اشتراك نشط',
  subscriptionFreeTrial: 'فترة تجريبية',
  subscriptionNoActive: 'لا يوجد اشتراك نشط',
  subscriptionPaymentHistory: 'سجل المدفوعات',
  subscriptionViewPlans: 'عرض الخطط والاشتراك',
  subscriptionUpgrade: 'ترقية الخطة',
  
  adminTitle: 'لوحة الإدارة',
  adminUsers: 'المستخدمون',
  adminDevices: 'الأجهزة',
  adminSubs: 'الاشتراكات',
  adminAnalytics: 'التحليلات',
  adminPayments: 'المدفوعات',
  adminNotify: 'إشعارات',
  adminBrand: 'العلامة',
  adminTrial: 'التجربة',
  adminApiKeys: 'مفاتيح API',
  adminResellers: 'الموزعون',
  adminCoupons: 'الكوبونات',
  adminSecurity: 'الأمان',
  adminTotalUsers: 'إجمالي المستخدمين',
  adminActiveDevices: 'الأجهزة النشطة',
  adminActiveSubs: 'الاشتراكات النشطة',
  adminTotalSessions: 'إجمالي الجلسات',
  adminGrantSubscription: 'منح اشتراك',
  
  resellerPanel: 'لوحة الموزع',
  resellerBalance: 'الرصيد',
  resellerCredits: 'الأرصدة',
  resellerBuyCredits: 'شراء أرصدة',
  resellerActivateUser: 'تفعيل مستخدم',
  resellerTransactions: 'المعاملات',
  resellerCommission: 'العمولة',
  
  couponCreate: 'إنشاء كوبون',
  couponCode: 'كود الكوبون',
  couponDiscount: 'الخصم',
  couponPercentage: 'نسبة مئوية',
  couponFixed: 'مبلغ ثابت',
  couponTrialExtension: 'تمديد التجربة',
  couponMaxUses: 'أقصى استخدام',
  couponExpiry: 'تاريخ الانتهاء',
  couponActive: 'نشط',
  couponExpired: 'منتهي',
  
  moviesTitle: 'الأفلام',
  moviesSearchPlaceholder: 'ابحث عن الأفلام...',
  moviesEmpty: 'لا توجد أفلام',
  seriesTitle: 'المسلسلات',
  seriesSearchPlaceholder: 'ابحث عن المسلسلات...',
  seriesEmpty: 'لا توجد مسلسلات',
  allCategories: 'الكل',
  sortByName: 'ترتيب بالاسم',
  sortByCategory: 'ترتيب بالتصنيف',
  
  timeJustNow: 'الآن',
  timeMinAgo: 'دقيقة مضت',
  timeHoursAgo: 'ساعة مضت',
  timeDaysAgo: 'يوم مضى',
};

const tr: TranslationKeys = {
  appName: 'IPTV Oynatıcı',
  loading: 'Yükleniyor...',
  save: 'Kaydet',
  cancel: 'İptal',
  delete: 'Sil',
  confirm: 'Onayla',
  back: 'Geri',
  search: 'Ara',
  settings: 'Ayarlar',
  signOut: 'Çıkış Yap',
  signIn: 'Giriş Yap',
  signUp: 'Kayıt Ol',
  email: 'E-posta',
  password: 'Şifre',
  name: 'İsim',
  submit: 'Gönder',
  
  authLoginTitle: 'Hesabınıza giriş yapın',
  authSignupTitle: 'Yeni hesap oluşturun',
  authLoginSubtitle: 'Hesabınıza giriş yapın',
  authSignupSubtitle: 'Yeni bir hesap oluşturun',
  authForgotPassword: 'Şifremi unuttum?',
  authNoAccount: 'Hesabınız yok mu? ',
  authHasAccount: 'Zaten hesabınız var mı? ',
  authDisplayName: 'Görünen Ad',
  authCheckEmail: 'Onay bağlantısı için e-postanızı kontrol edin!',
  authCreateAccount: 'Hesap Oluştur',
  
  playerSelectChannel: 'İzlemek için bir kanal seçin',
  playerChannels: 'kanal',
  playerCategories: 'Kategoriler',
  playerFavorites: 'Favoriler',
  playerSearchPlaceholder: 'Kanal ara...',
  playerResumeTitle: 'Oynatmaya Devam Et',
  playerResumeMessage: 'Kaldığınız yerden devam etmek ister misiniz?',
  playerResume: 'Devam Et',
  playerStartOver: 'Baştan Başla',
  
  playlistTitle: 'Oynatma Listesi Kurulumu',
  playlistSubtitle: 'Başlamak için IPTV kaynağınızı ekleyin',
  playlistM3U: 'M3U Listesi',
  playlistXtream: 'Xtream Codes',
  playlistURL: 'Liste URL\'si',
  playlistLoad: 'Listeyi Yükle',
  
  accessActivationRequired: 'Aktivasyon Gerekli',
  accessTrialExpired: 'Süresi Dolmuş',
  accessSubscribeNow: 'Şimdi Abone Ol',
  accessCheckActivation: 'Aktivasyonu Kontrol Et',
  accessManageDevices: 'Cihazları Yönet',
  accessTrialRemaining: 'gün kaldı',
  accessActivateMessage: 'Aboneliğinizi etkinleştirmek için sağlayıcınızla iletişime geçin.',
  
  settingsTitle: 'Ayarlar',
  settingsProfile: 'Profil',
  settingsDevices: 'Cihazlar',
  settingsSecurity: 'Güvenlik',
  settingsLanguage: 'Dil',
  settingsMaxDevices: 'Maks Cihaz',
  settingsSubscription: 'Abonelik',
  settingsNoSubscription: 'Aktif abonelik yok',
  settingsActiveUntil: 'Şu tarihe kadar aktif',
  settingsChangePassword: 'Şifre Değiştir',
  settingsNewPassword: 'Yeni şifre',
  settingsConfirmPassword: 'Şifreyi onayla',
  settingsUpdatePassword: 'Şifreyi Güncelle',
  settingsDevicesActive: 'aktif cihaz',
  
  notificationsTitle: 'Bildirimler',
  notificationsMarkAllRead: 'Tümünü okundu işaretle',
  notificationsClearRead: 'Okunmuşları temizle',
  notificationsEmpty: 'Bildirim yok',
  notificationsUnread: 'Okunmamış',
  notificationsAll: 'Tümü',
  notificationsDevice: 'Cihaz',
  notificationsSubscription: 'Abonelik',
  notificationsWarning: 'Uyarı',
  notificationsTrial: 'Deneme',
  notificationsInfo: 'Bilgi',
  
  pricingTitle: 'Planınızı Seçin',
  pricingSubtitle: 'Tam erişim için bir plan seçin',
  pricingMonthly: 'Aylık',
  pricingYearly: 'Yıllık',
  pricingLifetime: 'Ömür Boyu',
  pricingMonth: '/ay',
  pricingYear: '/yıl',
  pricingOneTime: 'tek seferlik',
  pricingMostPopular: 'En Popüler',
  pricingGet: 'Al',
  pricingProcessing: 'İşleniyor...',
  pricingInternational: 'Uluslararası (USD)',
  pricingEgypt: 'Mısır (EGP)',
  pricingCouponPlaceholder: 'Kupon kodu girin',
  pricingApplyCoupon: 'Uygula',
  pricingCouponApplied: 'Kupon uygulandı!',
  
  subscriptionTitle: 'Abonelik',
  subscriptionManage: 'Aboneliğinizi ve ödemelerinizi yönetin',
  subscriptionCurrentStatus: 'Mevcut Durum',
  subscriptionLifetime: 'Ömür Boyu Plan',
  subscriptionActive: 'Aktif Abonelik',
  subscriptionFreeTrial: 'Ücretsiz Deneme',
  subscriptionNoActive: 'Aktif Abonelik Yok',
  subscriptionPaymentHistory: 'Ödeme Geçmişi',
  subscriptionViewPlans: 'Planları Görüntüle',
  subscriptionUpgrade: 'Planı Yükselt',
  
  adminTitle: 'Yönetici Paneli',
  adminUsers: 'Kullanıcılar',
  adminDevices: 'Cihazlar',
  adminSubs: 'Abonelikler',
  adminAnalytics: 'Analizler',
  adminPayments: 'Ödemeler',
  adminNotify: 'Bildirim',
  adminBrand: 'Marka',
  adminTrial: 'Deneme',
  adminApiKeys: 'API Anahtarları',
  adminResellers: 'Bayiler',
  adminCoupons: 'Kuponlar',
  adminSecurity: 'Güvenlik',
  adminTotalUsers: 'Toplam Kullanıcı',
  adminActiveDevices: 'Aktif Cihazlar',
  adminActiveSubs: 'Aktif Abonelikler',
  adminTotalSessions: 'Toplam Oturum',
  adminGrantSubscription: 'Abonelik Ver',
  
  resellerPanel: 'Bayi Paneli',
  resellerBalance: 'Bakiye',
  resellerCredits: 'Krediler',
  resellerBuyCredits: 'Kredi Satın Al',
  resellerActivateUser: 'Kullanıcı Etkinleştir',
  resellerTransactions: 'İşlemler',
  resellerCommission: 'Komisyon',
  
  couponCreate: 'Kupon Oluştur',
  couponCode: 'Kupon Kodu',
  couponDiscount: 'İndirim',
  couponPercentage: 'Yüzde',
  couponFixed: 'Sabit Tutar',
  couponTrialExtension: 'Deneme Uzatma',
  couponMaxUses: 'Maks Kullanım',
  couponExpiry: 'Son Kullanma',
  couponActive: 'Aktif',
  couponExpired: 'Süresi Dolmuş',
  
  moviesTitle: 'Filmler',
  moviesSearchPlaceholder: 'Film ara...',
  moviesEmpty: 'Film bulunamadı',
  seriesTitle: 'Diziler',
  seriesSearchPlaceholder: 'Dizi ara...',
  seriesEmpty: 'Dizi bulunamadı',
  allCategories: 'Tümü',
  sortByName: 'İsme Göre',
  sortByCategory: 'Kategoriye Göre',
  
  timeJustNow: 'Az önce',
  timeMinAgo: 'dk önce',
  timeHoursAgo: 'sa önce',
  timeDaysAgo: 'gün önce',
};

export const translations: Record<Locale, TranslationKeys> = { en, ar, tr };
