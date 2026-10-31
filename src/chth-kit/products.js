// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// Every public CHTH product, in the order they're shown. The bots' "✨ More from CHTH" screen
// and every site's footer are built from this list, so a new site or bot is added here once.
// A product leaves itself out of its own list (pass `self`).

/** @typedef {{en: string, fa: string, ar: string, ru: string, es: string}} Text */

/** @type {readonly {id: string, kind: 'site'|'bot', ico: string, url: string, name: Text, tagline: Text}[]} */
export const PRODUCTS = Object.freeze([
  {
    id: 'cafe', kind: 'site', ico: '☕', url: 'https://chth.cafe',
    name: { en: 'CHTH Café', fa: 'کافه CHTH', ar: 'مقهى CHTH', ru: 'CHTH Café', es: 'CHTH Café' },
    tagline: {
      en: 'Free café management: menu, orders, stock and staff',
      fa: 'مدیریت رایگان کافه: منو، سفارش، انبار و پرسنل',
      ar: 'إدارة مقهى مجانية: القائمة والطلبات والمخزون والموظفون',
      ru: 'Бесплатное управление кафе: меню, заказы, склад и персонал',
      es: 'Gestión gratuita de cafeterías: menú, pedidos, stock y personal',
    },
  },
  {
    id: 'gym', kind: 'site', ico: '🏋️', url: 'https://chth.space',
    name: { en: 'CHTH Gym', fa: 'باشگاه CHTH', ar: 'نادي CHTH', ru: 'CHTH Gym', es: 'CHTH Gym' },
    tagline: {
      en: 'Workout tracker, routines and progress charts',
      fa: 'ثبت تمرین، برنامهٔ تمرینی و نمودار پیشرفت',
      ar: 'متتبع التمارين والبرامج ومخططات التقدّم',
      ru: 'Дневник тренировок, программы и графики прогресса',
      es: 'Registro de entrenos, rutinas y gráficas de progreso',
    },
  },
  {
    id: 'shop', kind: 'site', ico: '👕', url: 'https://chth.shop',
    name: { en: 'CHTH Shop', fa: 'فروشگاه CHTH', ar: 'متجر CHTH', ru: 'CHTH Shop', es: 'CHTH Shop' },
    tagline: {
      en: 'Design your own merch in 3D, and shop from artists',
      fa: 'طراحی لباس سه‌بعدی و خرید از هنرمندها',
      ar: 'صمّم ملابسك بتقنية ثلاثية الأبعاد وتسوّق من الفنانين',
      ru: 'Создай свой мерч в 3D и покупай у художников',
      es: 'Diseña tu merch en 3D y compra a artistas',
    },
  },
  {
    id: 'chthgamesbot', kind: 'bot', ico: '🎰', url: 'https://t.me/chthgamesbot',
    name: { en: 'Games', fa: 'بازی‌ها', ar: 'ألعاب', ru: 'Игры', es: 'Juegos' },
    tagline: {
      en: 'Casino, poker, Hokm and party games',
      fa: 'کازینو، پوکر، حکم و بازی‌های گروهی',
      ar: 'كازينو وبوكر وحكم وألعاب جماعية',
      ru: 'Казино, покер, хокм и игры для компании',
      es: 'Casino, póker, hokm y juegos de grupo',
    },
  },
  {
    id: 'chthvpnbot', kind: 'bot', ico: '🛡', url: 'https://t.me/chthvpnbot',
    name: { en: 'Community VPN', fa: 'وی‌پی‌ان اشتراکی', ar: 'VPN مجتمعي', ru: 'VPN сообщества', es: 'VPN comunitaria' },
    tagline: {
      en: 'VPNs shared by their owners',
      fa: 'وی‌پی‌ان‌هایی که صاحب‌هاشون به اشتراک گذاشتن',
      ar: 'شبكات VPN يشاركها أصحابها',
      ru: 'VPN, которыми делятся владельцы',
      es: 'VPN compartidas por sus dueños',
    },
  },
  {
    id: 'chthbrbot', kind: 'bot', ico: '🎭', url: 'https://t.me/chthbrbot',
    name: { en: 'Anonymous messages', fa: 'پیام ناشناس', ar: 'رسائل مجهولة', ru: 'Анонимные сообщения', es: 'Mensajes anónimos' },
    tagline: {
      en: 'Get anonymous messages from a link',
      fa: 'با یه لینک پیام ناشناس بگیر',
      ar: 'استقبل رسائل مجهولة عبر رابط',
      ru: 'Получай анонимные сообщения по ссылке',
      es: 'Recibe mensajes anónimos con un enlace',
    },
  },
  {
    id: 'chthapibot', kind: 'bot', ico: '🧰', url: 'https://t.me/chthapibot',
    name: { en: 'Multi-tool', fa: 'ابزار همه‌کاره', ar: 'أدوات متعددة', ru: 'Мультитул', es: 'Multiherramienta' },
    tagline: {
      en: 'Crypto, scores, recipes and a daily briefing',
      fa: 'کریپتو، نتایج ورزشی، دستور پخت و خلاصهٔ روزانه',
      ar: 'عملات رقمية ونتائج ووصفات وموجز يومي',
      ru: 'Крипта, счёт матчей, рецепты и сводка дня',
      es: 'Cripto, resultados, recetas y resumen diario',
    },
  },
  {
    id: 'chsbrbot', kind: 'bot', ico: '🚨', url: 'https://t.me/chsbrbot',
    name: { en: 'CVE alerts', fa: 'هشدار CVE', ar: 'تنبيهات CVE', ru: 'Оповещения CVE', es: 'Alertas CVE' },
    tagline: {
      en: 'New and exploited vulnerabilities, as they land',
      fa: 'آسیب‌پذیری‌های تازه و فعال، همون لحظه',
      ar: 'الثغرات الجديدة والمستغلة فور ظهورها',
      ru: 'Новые и эксплуатируемые уязвимости сразу',
      es: 'Vulnerabilidades nuevas y explotadas al momento',
    },
  },
  {
    id: 'chthmusicbot', kind: 'bot', ico: '🎧', url: 'https://t.me/chthmusicbot',
    name: { en: 'Music sync', fa: 'همگام‌سازی موسیقی', ar: 'مزامنة الموسيقى', ru: 'Синхронизация музыки', es: 'Sincronizar música' },
    tagline: {
      en: 'Spotify, YouTube Music and Apple Music playlists in your chats',
      fa: 'پلی‌لیست‌های اسپاتیفای، یوتیوب موزیک و اپل موزیک توی چت‌هات',
      ar: 'قوائم Spotify وYouTube Music وApple Music في محادثاتك',
      ru: 'Плейлисты Spotify, YouTube Music и Apple Music в чатах',
      es: 'Listas de Spotify, YouTube Music y Apple Music en tus chats',
    },
  },
  {
    id: 'chthgrambot', kind: 'bot', ico: '🤵', url: 'https://t.me/chthgrambot',
    name: { en: 'AI secretary', fa: 'منشی هوش مصنوعی', ar: 'سكرتير ذكي', ru: 'ИИ-секретарь', es: 'Secretario IA' },
    tagline: {
      en: 'Answers your Telegram chats while you’re away',
      fa: 'وقتی نیستی جواب چت‌هات رو می‌ده',
      ar: 'يرد على محادثاتك في تيليجرام أثناء غيابك',
      ru: 'Отвечает в Telegram, пока тебя нет',
      es: 'Responde tus chats de Telegram cuando no estás',
    },
  },
]);

/** Products other than `self`, optionally of one kind. */
export function otherProducts(self, kind) {
  const me = String(self ?? '').toLowerCase();
  return PRODUCTS.filter((p) => p.id !== me && (!kind || p.kind === kind));
}

/**
 * A link to a product that tells it where the visitor came from: `?start=src_<from>` for bots
 * (Telegram passes it to /start) and `?ref=<from>` for sites. The hub's /funnel counts both.
 */
export function productLink(product, from) {
  if (!from) return product.url;
  const tag = String(from).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40);
  return product.kind === 'bot' ? `${product.url}?start=src_${tag}` : `${product.url}/?ref=${tag}`;
}

/** A product's name in a locale, English if missing. */
export const productName = (p, locale) => p.name[locale] ?? p.name.en;
export const productTagline = (p, locale) => p.tagline[locale] ?? p.tagline.en;
