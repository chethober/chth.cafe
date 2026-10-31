// The chth.cafe landing page in five languages. The page is written in English; LANDING maps
// each English text (or a small HTML fragment, where markup sits inside a sentence) to Persian,
// Arabic, Russian and Spanish, and localizeLanding() translates the rendered page on the way out.
// The control plane allows no scripts, so the navbar's language menu is a <details> of plain ?lang= links.

import { dirOf, isLocale, localeCookie, localeFromCookie, pickLocale, type Locale } from '../../src/chth-kit/locales.js';
import { footerHtml } from '../../src/chth-kit/footer.js';
import { languageMenuHtml } from '../../src/chth-kit/language-menu.js';

type Row = [fa: string, ar: string, ru: string, es: string];
const COL: Record<Exclude<Locale, 'en'>, number> = { fa: 0, ar: 1, ru: 2, es: 3 };

export const LANDING: Record<string, Row> = {
  'Your café, running on <em>your own</em> Cloudflare.': ['کافه‌ات، روی <em>کلادفلر خودت</em>.', 'مقهاك، يعمل على <em>حسابك الخاص</em> في Cloudflare.', 'Ваше кафе — на <em>вашем собственном</em> Cloudflare.', 'Tu café, en <em>tu propio</em> Cloudflare.'],
  'Yes. Everything is on GitHub, and <code>wrangler deploy</code> gives you the same café.': ['بله. همه‌چیز روی GitHub است و <code>wrangler deploy</code> همین کافه را برایت می‌سازد.', 'نعم. كل شيء على GitHub، و<code>wrangler deploy</code> يمنحك المقهى نفسه.', 'Да. Всё есть на GitHub, и <code>wrangler deploy</code> даст то же кафе.', 'Sí. Todo está en GitHub, y <code>wrangler deploy</code> te da el mismo café.'],
  'Try again ↓': ['دوباره امتحان کن ↓', 'حاول مجددًا ↓', 'Попробовать снова ↓', 'Reintentar ↓'],
  'Open source': ['متن‌باز', 'مفتوح المصدر', 'Открытый код', 'Código abierto'],
  '· runs on the Cloudflare free plan': ['· روی پلن رایگان کلادفلر اجرا می‌شود', '· يعمل على خطة Cloudflare المجانية', '· работает на бесплатном тарифе Cloudflare', '· funciona con el plan gratuito de Cloudflare'],
  'Menu, QR orders, stock, shifts, bookings and the books, in one app. Deploy it to your Cloudflare account in about a minute. You keep the data and the bill. We only keep a way to send you updates.': ['منو، سفارش با QR، انبار، شیفت‌ها، رزروها و حساب‌وکتاب، در یک اپ. حدود یک دقیقه‌ای روی حساب کلادفلرت نصبش کن. داده و صورت‌حساب مال خودت است؛ ما فقط راهی برای فرستادن به‌روزرسانی نگه می‌داریم.', 'القائمة وطلبات QR والمخزون والورديات والحجوزات والحسابات في تطبيق واحد. انشره على حسابك في Cloudflare خلال دقيقة تقريبًا. البيانات والفاتورة لك، ونحتفظ فقط بطريقة لإرسال التحديثات.', 'Меню, заказы по QR, склад, смены, брони и учёт — в одном приложении. Разверните его в своём аккаунте Cloudflare примерно за минуту. Данные и счёт остаются у вас, у нас — только способ присылать обновления.', 'Menú, pedidos por QR, stock, turnos, reservas y cuentas, en una sola app. Despliégala en tu cuenta de Cloudflare en un minuto. Los datos y la factura son tuyos; solo guardamos una forma de enviarte actualizaciones.'],
  'Sign in with Cloudflare': ['ورود با کلادفلر', 'الدخول عبر Cloudflare', 'Войти через Cloudflare', 'Entrar con Cloudflare'],
  'See it working ↓': ['ببین چطور کار می‌کند ↓', 'شاهده يعمل ↓', 'Посмотреть в работе ↓', 'Verlo en acción ↓'],
  'No new account or password. You sign in with Cloudflare or an API token, and sign out whenever you like.': ['حساب و رمز تازه‌ای لازم نیست. با کلادفلر یا یک توکن API وارد می‌شوی و هر وقت خواستی خارج می‌شوی.', 'لا حساب ولا كلمة مرور جديدة. تدخل عبر Cloudflare أو رمز API وتخرج متى شئت.', 'Никаких новых аккаунтов и паролей. Входите через Cloudflare или API-токен и выходите когда угодно.', 'Sin cuentas ni contraseñas nuevas. Entras con Cloudflare o un token de API y sales cuando quieras.'],
  'Choose your passwords': ['رمزهایت را انتخاب کن', 'اختر كلمات المرور', 'Выберите пароли', 'Elige tus contraseñas'],
  'One-time setup link, never stored by us': ['لینک یک‌بارمصرف که ما ذخیره‌اش نمی‌کنیم', 'رابط إعداد لمرة واحدة لا نخزّنه', 'Одноразовая ссылка, мы её не храним', 'Enlace de un solo uso que no guardamos'],
  'Live': ['فعال', 'يعمل', 'Работает', 'Activo'],
  'The product': ['محصول', 'المنتج', 'Продукт', 'El producto'],
  'Everything behind the counter, in one place.': ['همهٔ پشت پیشخوان، یک‌جا.', 'كل ما وراء المنضدة في مكان واحد.', 'Всё, что за стойкой, в одном месте.', 'Todo lo de detrás de la barra, en un solo lugar.'],
  'Every café gets the whole app: the menu guests order from, the board the bar works from, and the numbers you close the day with.': ['هر کافه کل اپ را می‌گیرد: منویی که مهمان‌ها از آن سفارش می‌دهند، تابلویی که بار با آن کار می‌کند و عددهایی که روز را با آن می‌بندی.', 'كل مقهى يحصل على التطبيق كاملًا: القائمة التي يطلب منها الضيوف، واللوحة التي يعمل عليها البار، والأرقام التي تُغلق بها اليوم.', 'Каждое кафе получает всё: меню для гостей, доску для бара и цифры, с которыми вы закрываете день.', 'Cada café recibe la app completa: el menú desde el que piden los clientes, el tablero de la barra y los números con los que cierras el día.'],
  'A menu guests order from': ['منویی که مهمان‌ها از آن سفارش می‌دهند', 'قائمة يطلب منها الضيوف', 'Меню, из которого заказывают гости', 'Un menú desde el que piden los clientes'],
  'Guests scan the QR code at the table and order from their phone. Light and dark themes are built in.': ['مهمان‌ها QR روی میز را اسکن می‌کنند و با گوشی سفارش می‌دهند. تم روشن و تیره هم دارد.', 'يمسح الضيوف رمز QR على الطاولة ويطلبون من هواتفهم. الوضعان الفاتح والداكن مدمجان.', 'Гости сканируют QR-код на столе и заказывают с телефона. Есть светлая и тёмная темы.', 'Los clientes escanean el QR de la mesa y piden desde el móvil. Incluye temas claro y oscuro.'],
  'An order board for the bar': ['تابلوی سفارش برای بار', 'لوحة طلبات للبار', 'Доска заказов для бара', 'Un tablero de pedidos para la barra'],
  'Orders from the tables, the counter and the panel show up together, and move along as you make them.': ['سفارش‌های میزها، پیشخوان و پنل کنار هم نمایش داده می‌شوند و با آماده شدن جلو می‌روند.', 'تظهر طلبات الطاولات والمنضدة واللوحة معًا، وتتقدّم كلما حضّرتها.', 'Заказы со столов, стойки и панели появляются вместе и двигаются по мере готовности.', 'Los pedidos de mesas, barra y panel aparecen juntos y avanzan mientras los preparas.'],
  'Today’s sales': ['فروش امروز', 'مبيعات اليوم', 'Продажи сегодня', 'Ventas de hoy'],
  'Stock that counts itself down': ['انباری که خودش کم می‌شود', 'مخزون يُحسب تلقائيًا', 'Склад, который считает сам', 'Un stock que se descuenta solo'],
  'Recipes take out what each drink uses, and the app tells you before something runs out.': ['دستورها مصرف هر نوشیدنی را کم می‌کنند و اپ پیش از تمام شدن چیزی خبرت می‌کند.', 'تخصم الوصفات ما يستهلكه كل مشروب، ويُنبّهك التطبيق قبل نفاد أي شيء.', 'Рецепты списывают расход каждого напитка, а приложение предупреждает, пока что-то не закончилось.', 'Las recetas descuentan lo que usa cada bebida y la app avisa antes de que algo se acabe.'],
  'The café texts you on Telegram': ['کافه در تلگرام به تو پیام می‌دهد', 'المقهى يراسلك على تيليجرام', 'Кафе пишет вам в Telegram', 'El café te escribe por Telegram'],
  'New orders, low stock and new bookings arrive in your pocket, so you can step away from the screen.': ['سفارش‌های تازه، کمبود انبار و رزروهای جدید به جیبت می‌رسند تا بتوانی از صفحه دور شوی.', 'تصلك الطلبات الجديدة ونقص المخزون والحجوزات في جيبك، لتبتعد عن الشاشة.', 'Новые заказы, нехватка товара и брони приходят в карман — можно отойти от экрана.', 'Pedidos nuevos, stock bajo y reservas llegan a tu bolsillo, para que puedas alejarte de la pantalla.'],
  'Shifts, events and bookings': ['شیفت‌ها، رویدادها و رزروها', 'الورديات والفعاليات والحجوزات', 'Смены, события и брони', 'Turnos, eventos y reservas'],
  'Plan who works when, run tastings and classes, and let guests book a seat.': ['برنامه بریز چه کسی کی کار کند، کلاس و تست برگزار کن و بگذار مهمان‌ها جا رزرو کنند.', 'خطّط لمن يعمل ومتى، ونظّم التذوّق والدروس، ودع الضيوف يحجزون مقاعدهم.', 'Планируйте смены, проводите дегустации и мастер-классы, принимайте брони гостей.', 'Planifica quién trabaja y cuándo, organiza catas y clases y deja que los clientes reserven.'],
  'How it works': ['چطور کار می‌کند', 'كيف يعمل', 'Как это работает', 'Cómo funciona'],
  'From sign-in to the first order in three steps.': ['از ورود تا اولین سفارش در سه قدم.', 'من تسجيل الدخول إلى أول طلب في ثلاث خطوات.', 'От входа до первого заказа — три шага.', 'Del inicio de sesión al primer pedido en tres pasos.'],
  'You don’t need a terminal, git or wrangler. If you can sign in to Cloudflare, you can run this.': ['ترمینال، git یا wrangler لازم نیست. اگر می‌توانی وارد کلادفلر شوی، می‌توانی این را راه بیندازی.', 'لا تحتاج إلى طرفية أو git أو wrangler. إن كنت تستطيع الدخول إلى Cloudflare فيمكنك تشغيله.', 'Не нужны ни терминал, ни git, ни wrangler. Если вы можете войти в Cloudflare — справитесь.', 'No necesitas terminal, git ni wrangler. Si sabes entrar en Cloudflare, puedes usarlo.'],
  'Approve on Cloudflare’s own consent screen, or paste an API token made from our prefilled template. That one step is your whole sign-up.': ['در صفحهٔ تأیید خود کلادفلر اجازه بده، یا توکن API ساخته‌شده از قالب آماده‌مان را بچسبان. همین یک قدم کل ثبت‌نامت است.', 'وافق في شاشة Cloudflare نفسها، أو الصق رمز API من قالبنا الجاهز. هذه الخطوة هي كل التسجيل.', 'Подтвердите на экране согласия Cloudflare или вставьте API-токен из нашего готового шаблона. Это и есть вся регистрация.', 'Aprueba en la pantalla de Cloudflare o pega un token de API hecho con nuestra plantilla. Ese paso es todo el registro.'],
  'Name your café and deploy': ['اسم کافه را بگذار و منتشر کن', 'سمِّ مقهاك وانشره', 'Назовите кафе и разверните', 'Ponle nombre a tu café y despliégalo'],
  'We create the Worker, database and storage in your account. Use workers.dev, or your own domain with admin. and panel. subdomains.': ['ما Worker، پایگاه داده و فضای ذخیره را در حساب خودت می‌سازیم. از workers.dev استفاده کن یا دامنهٔ خودت با زیردامنه‌های admin. و panel.', 'ننشئ الـ Worker وقاعدة البيانات والتخزين في حسابك. استخدم workers.dev أو نطاقك مع النطاقين الفرعيين admin. وpanel.', 'Мы создаём Worker, базу и хранилище в вашем аккаунте. workers.dev или свой домен с поддоменами admin. и panel.', 'Creamos el Worker, la base de datos y el almacenamiento en tu cuenta. Usa workers.dev o tu dominio con los subdominios admin. y panel.'],
  '~1 min': ['~۱ دقیقه', '~1 دقيقة', '~1 мин', '~1 min'],
  'demo menu optional': ['منوی نمونه اختیاری', 'قائمة تجريبية اختيارية', 'демо-меню по желанию', 'menú de prueba opcional'],
  'Open the one-time setup link and choose the admin and staff passwords. We never see them, and from there the café runs on its own.': ['لینک یک‌بارمصرف را باز کن و رمز مدیر و کارکنان را انتخاب کن. ما هرگز آن‌ها را نمی‌بینیم و از آن به بعد کافه خودش کار می‌کند.', 'افتح رابط الإعداد واختر كلمتي مرور المدير والموظفين. لا نراهما أبدًا، ومن هناك يعمل المقهى بمفرده.', 'Откройте одноразовую ссылку и задайте пароли админа и персонала. Мы их не видим, дальше кафе работает само.', 'Abre el enlace de un solo uso y elige las contraseñas de admin y personal. Nunca las vemos, y a partir de ahí el café funciona solo.'],
  'one-click updates': ['به‌روزرسانی با یک کلیک', 'تحديثات بنقرة', 'обновления в один клик', 'actualizaciones en un clic'],
  'Ownership': ['مالکیت', 'الملكية', 'Владение', 'Propiedad'],
  'We deploy it. It lives in your account.': ['ما منتشرش می‌کنیم. در حساب تو زندگی می‌کند.', 'نحن ننشره، وهو يعيش في حسابك.', 'Разворачиваем мы. Живёт оно у вас.', 'Nosotros lo desplegamos. Vive en tu cuenta.'],
  'The café is a regular Worker in your Cloudflare account. If this site disappeared tomorrow, your café would keep serving.': ['کافه یک Worker معمولی در حساب کلادفلر توست. اگر این سایت فردا ناپدید شود، کافه‌ات همچنان کار می‌کند.', 'المقهى Worker عادي في حسابك. لو اختفى هذا الموقع غدًا لاستمر مقهاك في العمل.', 'Кафе — обычный Worker в вашем аккаунте. Если этот сайт завтра исчезнет, кафе продолжит работать.', 'El café es un Worker normal en tu cuenta. Si este sitio desapareciera mañana, tu café seguiría funcionando.'],
  'You': ['تو', 'أنت', 'Вы', 'Tú'],
  'Sign in': ['ورود', 'الدخول', 'Вход', 'Entrar'],
  'OAuth or an API token, that you can revoke at any time': ['OAuth یا توکن API که هر وقت بخواهی باطلش می‌کنی', 'OAuth أو رمز API يمكنك إلغاؤه في أي وقت', 'OAuth или API-токен, который можно отозвать в любой момент', 'OAuth o un token de API que puedes revocar cuando quieras'],
  'Deploys &amp; updates': ['انتشار و به‌روزرسانی', 'النشر والتحديثات', 'Развёртывание и обновления', 'Despliegues y actualizaciones'],
  'Keeps your account name, encrypted access and your café list': ['نام حساب، دسترسی رمزگذاری‌شده و فهرست کافه‌هایت را نگه می‌دارد', 'يحتفظ باسم حسابك ووصول مشفّر وقائمة مقاهيك', 'Хранит имя аккаунта, зашифрованный доступ и список кафе', 'Guarda el nombre de tu cuenta, el acceso cifrado y tu lista de cafés'],
  'Your Cloudflare account': ['حساب کلادفلر تو', 'حسابك في Cloudflare', 'Ваш аккаунт Cloudflare', 'Tu cuenta de Cloudflare'],
  'Your café': ['کافهٔ تو', 'مقهاك', 'Ваше кафе', 'Tu café'],
  'Orders, menu, staff and money all stay here': ['سفارش‌ها، منو، کارکنان و پول همه همین‌جا می‌مانند', 'الطلبات والقائمة والموظفون والمال كلها تبقى هنا', 'Заказы, меню, персонал и деньги — всё здесь', 'Pedidos, menú, personal y dinero se quedan aquí'],
  'Encrypted access': ['دسترسی رمزگذاری‌شده', 'وصول مشفّر', 'Зашифрованный доступ', 'Acceso cifrado'],
  'Your Cloudflare access is stored AES-GCM encrypted and bound to your account.': ['دسترسی کلادفلرت با AES-GCM رمزگذاری و به حسابت گره خورده ذخیره می‌شود.', 'يُخزَّن وصولك إلى Cloudflare مشفّرًا بـ AES-GCM ومرتبطًا بحسابك.', 'Доступ к Cloudflare хранится в шифре AES-GCM и привязан к вашему аккаунту.', 'Tu acceso a Cloudflare se guarda cifrado con AES-GCM y ligado a tu cuenta.'],
  'Blind to passwords': ['بی‌خبر از رمزها', 'لا نرى كلمات المرور', 'Пароли нам не видны', 'Ciegos a las contraseñas'],
  'You set the café’s passwords through a one-time link, and we keep no copy of it.': ['رمزهای کافه را با یک لینک یک‌بارمصرف تعیین می‌کنی و ما نسخه‌ای نگه نمی‌داریم.', 'تحدد كلمات مرور المقهى عبر رابط لمرة واحدة، ولا نحتفظ بنسخة منه.', 'Пароли кафе задаются по одноразовой ссылке, мы не храним её копию.', 'Pones las contraseñas con un enlace de un solo uso, y no guardamos copia.'],
  'Updates in one click': ['به‌روزرسانی با یک کلیک', 'تحديثات بنقرة واحدة', 'Обновления в один клик', 'Actualizaciones en un clic'],
  'New releases show up on your dashboard. Your data and secrets stay as they are.': ['نسخه‌های تازه روی داشبوردت ظاهر می‌شوند. داده‌ها و رمزهایت دست‌نخورده می‌مانند.', 'تظهر الإصدارات الجديدة في لوحتك، وتبقى بياناتك وأسرارك كما هي.', 'Новые версии появляются на панели. Данные и секреты остаются как есть.', 'Las nuevas versiones aparecen en tu panel. Tus datos y secretos no cambian.'],
  'Leave anytime': ['هر وقت خواستی برو', 'غادر متى شئت', 'Уйти можно в любой момент', 'Vete cuando quieras'],
  'Disconnect and the café keeps running. Or delete it and everything in it.': ['قطع اتصال کن و کافه همچنان کار می‌کند. یا آن را با همه‌چیزش حذف کن.', 'افصل الاتصال وسيستمر المقهى في العمل، أو احذفه بكل ما فيه.', 'Отключитесь — кафе продолжит работать. Или удалите его со всем содержимым.', 'Desconecta y el café sigue funcionando. O bórralo con todo lo que contiene.'],
  'Get started': ['شروع کن', 'ابدأ', 'Начать', 'Empieza'],
  'Sign in with the account your café will live in.': ['با حسابی وارد شو که کافه‌ات در آن زندگی خواهد کرد.', 'سجّل الدخول بالحساب الذي سيعيش فيه مقهاك.', 'Войдите в аккаунт, где будет жить ваше кафе.', 'Entra con la cuenta donde vivirá tu café.'],
  'There’s no separate sign-up. The Cloudflare account you sign in with is your account here, and anyone who can reach that account sees its cafés.': ['ثبت‌نام جداگانه‌ای نیست. حساب کلادفلری که با آن وارد می‌شوی همین‌جا حساب توست و هر کس به آن حساب دسترسی دارد کافه‌هایش را می‌بیند.', 'لا تسجيل منفصل. حساب Cloudflare الذي تدخل به هو حسابك هنا، ومن يصل إلى ذلك الحساب يرى مقاهيه.', 'Отдельной регистрации нет. Аккаунт Cloudflare, через который вы входите, — ваш аккаунт здесь, и все с доступом к нему видят его кафе.', 'No hay registro aparte. La cuenta de Cloudflare con la que entras es tu cuenta aquí, y quien acceda a ella ve sus cafés.'],
  'Continue with Cloudflare': ['ادامه با کلادفلر', 'المتابعة مع Cloudflare', 'Продолжить с Cloudflare', 'Continuar con Cloudflare'],
  'or use an API token': ['یا از توکن API استفاده کن', 'أو استخدم رمز API', 'или используйте API-токен', 'o usa un token de API'],
  'Create a token on Cloudflare': ['یک توکن در کلادفلر بساز', 'أنشئ رمزًا في Cloudflare', 'Создайте токен в Cloudflare', 'Crea un token en Cloudflare'],
  '. The permissions come filled in: Workers Scripts, Workers KV Storage and D1 set to Edit, Account Settings set to Read.': ['. دسترسی‌ها از پیش پر شده‌اند: Workers Scripts، Workers KV Storage و D1 روی Edit و Account Settings روی Read.', '. الأذونات معبّأة مسبقًا: Workers Scripts وWorkers KV Storage وD1 على Edit، وAccount Settings على Read.', '. Права уже заполнены: Workers Scripts, Workers KV Storage и D1 — Edit, Account Settings — Read.', '. Los permisos vienen rellenados: Workers Scripts, Workers KV Storage y D1 en Edit, Account Settings en Read.'],
  'For your own domain,': ['برای دامنهٔ خودت،', 'لنطاقك الخاص،', 'Для своего домена', 'Para tu propio dominio,'],
  'use this template instead': ['از این قالب استفاده کن', 'استخدم هذا القالب بدلًا منه', 'используйте этот шаблон', 'usa esta plantilla'],
  '. It adds Zone: Read and Workers Routes: Edit.': ['. این قالب Zone: Read و Workers Routes: Edit را اضافه می‌کند.', '. يضيف Zone: Read وWorkers Routes: Edit.', '. Он добавляет Zone: Read и Workers Routes: Edit.', '. Añade Zone: Read y Workers Routes: Edit.'],
  'API token': ['توکن API', 'رمز API', 'API-токен', 'Token de API'],
  'Paste your token': ['توکنت را بچسبان', 'الصق رمزك', 'Вставьте токен', 'Pega tu token'],
  'The token reaches more than one account?': ['توکن به بیش از یک حساب دسترسی دارد؟', 'الرمز يصل إلى أكثر من حساب؟', 'Токен даёт доступ к нескольким аккаунтам?', '¿El token llega a más de una cuenta?'],
  'Account ID': ['شناسهٔ حساب', 'معرّف الحساب', 'ID аккаунта', 'ID de cuenta'],
  '32 hex characters, from the dashboard URL': ['۳۲ نویسهٔ hex، از نشانی داشبورد', '32 حرفًا ست عشريًا من رابط لوحة التحكم', '32 шестнадцатеричных символа из адреса панели', '32 caracteres hex, de la URL del panel'],
  'Sign in with token': ['ورود با توکن', 'الدخول بالرمز', 'Войти с токеном', 'Entrar con token'],
  'Questions': ['پرسش‌ها', 'أسئلة', 'Вопросы', 'Preguntas'],
  'Good to know': ['خوب است بدانی', 'من الجيد أن تعرف', 'Полезно знать', 'Conviene saber'],
  'What does it cost?': ['هزینه‌اش چقدر است؟', 'كم يكلّف؟', 'Сколько это стоит?', '¿Cuánto cuesta?'],
  'The software is free and open source. The café runs on your Cloudflare account, and the free plan is enough for one café. Whatever Cloudflare bills, it bills to you directly.': ['نرم‌افزار رایگان و متن‌باز است. کافه روی حساب کلادفلر تو اجرا می‌شود و پلن رایگان برای یک کافه کافی است. هر هزینه‌ای کلادفلر بگیرد، مستقیم از تو می‌گیرد.', 'البرنامج مجاني ومفتوح المصدر. يعمل المقهى على حسابك في Cloudflare، والخطة المجانية تكفي لمقهى واحد. وأي رسوم تفرضها Cloudflare تُحتسب عليك مباشرة.', 'Программа бесплатная и с открытым кодом. Кафе работает в вашем аккаунте Cloudflare, бесплатного тарифа хватает на одно кафе. Всё, что выставит Cloudflare, он выставит вам напрямую.', 'El software es gratuito y de código abierto. El café funciona en tu cuenta de Cloudflare y el plan gratuito basta para un café. Lo que cobre Cloudflare, te lo cobra directamente.'],
  'What can you see in my account?': ['در حسابم چه چیزی را می‌بینید؟', 'ماذا ترون في حسابي؟', 'Что вы видите в моём аккаунте?', '¿Qué podéis ver en mi cuenta?'],
  'We can see what your token or consent allows: Workers, D1 and KV, and Zone and Routes if you add your own domain. We use that only to deploy, update or delete cafés when you ask. Every action goes in an audit log.': ['همان چیزی که توکن یا اجازه‌ات اجازه می‌دهد: Workers، D1 و KV، و اگر دامنهٔ خودت را اضافه کنی Zone و Routes. فقط وقتی بخواهی برای انتشار، به‌روزرسانی یا حذف کافه از آن استفاده می‌کنیم. هر کار در گزارش ممیزی ثبت می‌شود.', 'ما يسمح به رمزك أو موافقتك: Workers وD1 وKV، وZone وRoutes إن أضفت نطاقك. نستخدم ذلك فقط للنشر أو التحديث أو الحذف عند طلبك. يُسجَّل كل إجراء في سجل التدقيق.', 'То, что разрешает токен или согласие: Workers, D1 и KV, а также Zone и Routes, если добавите домен. Используем это только для развёртывания, обновления или удаления по вашему запросу. Каждое действие пишется в журнал.', 'Lo que permita tu token o consentimiento: Workers, D1 y KV, y Zone y Routes si añades tu dominio. Solo lo usamos para desplegar, actualizar o borrar cafés cuando lo pides. Todo queda en un registro de auditoría.'],
  'Why sign in with Cloudflare and not an email?': ['چرا با کلادفلر وارد شوم و نه ایمیل؟', 'لماذا الدخول عبر Cloudflare وليس البريد؟', 'Почему вход через Cloudflare, а не email?', '¿Por qué entrar con Cloudflare y no con un email?'],
  'Your café lives in your Cloudflare account anyway, so that account is your identity here. There’s no extra password for us to store or for you to lose.': ['کافه‌ات به هر حال در حساب کلادفلرت است، پس همان حساب هویت تو در اینجاست. رمز اضافه‌ای نیست که ما نگه داریم یا تو گمش کنی.', 'مقهاك يعيش في حسابك على Cloudflare أصلًا، لذا فهو هويتك هنا. لا كلمة مرور إضافية نخزّنها أو تفقدها.', 'Кафе всё равно живёт в вашем аккаунте Cloudflare, поэтому он и есть ваша личность здесь. Нет лишнего пароля, который мы храним или вы теряете.', 'Tu café vive en tu cuenta de Cloudflare igualmente, así que esa cuenta es tu identidad aquí. No hay contraseña extra que guardar ni perder.'],
  'What happens if I disconnect?': ['اگر قطع اتصال کنم چه می‌شود؟', 'ماذا يحدث إن فصلت الاتصال؟', 'Что будет, если отключиться?', '¿Qué pasa si me desconecto?'],
  'We forget your access and sign you out everywhere. Your cafés keep running with all their data. Sign in again whenever you want one-click updates back.': ['دسترسی‌ات را فراموش می‌کنیم و از همه‌جا خارجت می‌کنیم. کافه‌هایت با همهٔ داده‌ها کار می‌کنند. هر وقت به‌روزرسانی یک‌کلیکی خواستی دوباره وارد شو.', 'ننسى وصولك ونسجّل خروجك من كل مكان. تستمر مقاهيك بكل بياناتها. سجّل الدخول مجددًا متى أردت التحديثات بنقرة.', 'Мы забываем доступ и выходим отовсюду. Кафе работают со всеми данными. Войдите снова, когда захотите обновления в один клик.', 'Olvidamos tu acceso y cerramos tu sesión en todas partes. Tus cafés siguen con todos sus datos. Vuelve a entrar cuando quieras actualizaciones en un clic.'],
  'Can I use my own domain?': ['می‌توانم دامنهٔ خودم را داشته باشم؟', 'هل يمكنني استخدام نطاقي؟', 'Можно свой домен?', '¿Puedo usar mi propio dominio?'],
  'Yes. Give us a domain on a zone in your account, and the menu opens at the domain, the admin at admin. and the staff panel at panel.': ['بله. دامنه‌ای روی یک zone در حسابت بده؛ منو روی همان دامنه، مدیریت روی admin. و پنل کارکنان روی panel. باز می‌شود.', 'نعم. أعطنا نطاقًا في منطقة بحسابك، فتفتح القائمة على النطاق، والإدارة على admin. ولوحة الموظفين على panel.', 'Да. Укажите домен в зоне вашего аккаунта: меню откроется на нём, админка — на admin., панель персонала — на panel.', 'Sí. Danos un dominio de una zona de tu cuenta: el menú abre en el dominio, el admin en admin. y el panel en panel.'],
  'Can I host it myself, without this site?': ['می‌توانم بدون این سایت خودم میزبانی کنم؟', 'هل يمكنني استضافته بنفسي دون هذا الموقع؟', 'Можно развернуть самому, без этого сайта?', '¿Puedo alojarlo yo, sin este sitio?'],
  'Product': ['محصول', 'المنتج', 'Продукт', 'Producto'],
  'FAQ': ['پرسش‌های رایج', 'الأسئلة الشائعة', 'Вопросы', 'Preguntas'],
  'Example: deploying a café called Corner Beans': ['نمونه: انتشار کافه‌ای به نام Corner Beans', 'مثال: نشر مقهى باسم Corner Beans', 'Пример: развёртывание кафе Corner Beans', 'Ejemplo: desplegar un café llamado Corner Beans'],
  'Your café, on your own Cloudflare': ['کافه‌ات، روی کلادفلر خودت', 'مقهاك على Cloudflare الخاص بك', 'Ваше кафе на вашем Cloudflare', 'Tu café, en tu propio Cloudflare'],
  'Menu, orders, stock, staff and finances for your café, deployed in one click to your own Cloudflare account.': ['منو، سفارش، انبار، کارکنان و مالی کافه‌ات، با یک کلیک روی حساب کلادفلر خودت.', 'القائمة والطلبات والمخزون والموظفون والمالية لمقهاك، تُنشر بنقرة على حسابك في Cloudflare.', 'Меню, заказы, склад, персонал и финансы кафе — в один клик в вашем аккаунте Cloudflare.', 'Menú, pedidos, stock, personal y finanzas de tu café, desplegados en un clic en tu cuenta de Cloudflare.'],
  'CHTH Café Cloud · open source café management on Cloudflare': ['CHTH Café Cloud · مدیریت متن‌باز کافه روی کلادفلر', 'CHTH Café Cloud · إدارة مقاهٍ مفتوحة المصدر على Cloudflare', 'CHTH Café Cloud · управление кафе с открытым кодом на Cloudflare', 'CHTH Café Cloud · gestión de cafés de código abierto en Cloudflare'],
  'Main': ['اصلی', 'الرئيسي', 'Главное', 'Principal'],
  'Switch to light appearance': ['حالت روشن', 'الوضع الفاتح', 'Светлая тема', 'Modo claro'],
  'Switch to dark appearance': ['حالت تیره', 'الوضع الداكن', 'Тёмная тема', 'Modo oscuro'],
  'Cloudflare did not sign you in. Try again, or use an API token.': ['کلادفلر وارد نشد. دوباره امتحان کن یا از توکن API استفاده کن.', 'لم يسجّل Cloudflare دخولك. حاول مجددًا أو استخدم رمز API.', 'Cloudflare не выполнил вход. Попробуйте снова или используйте API-токен.', 'Cloudflare no inició tu sesión. Inténtalo de nuevo o usa un token de API.'],
  'Signed out and forgot your Cloudflare access. Your cafés keep running.': ['خارج شدی و دسترسی کلادفلرت فراموش شد. کافه‌هایت همچنان کار می‌کنند.', 'سُجّل خروجك ونُسي وصولك إلى Cloudflare. تستمر مقاهيك في العمل.', 'Вы вышли, доступ к Cloudflare забыт. Кафе продолжают работать.', 'Sesión cerrada y acceso a Cloudflare olvidado. Tus cafés siguen funcionando.'],
  // The feature marquee
  'Public menu & QR ordering': ['منوی عمومی و سفارش با QR', 'قائمة عامة وطلب عبر QR', 'Меню и заказ по QR', 'Menú público y pedidos por QR'],
  'Public menu &amp; QR ordering': ['منوی عمومی و سفارش با QR', 'قائمة عامة وطلب عبر QR', 'Меню и заказ по QR', 'Menú público y pedidos por QR'],
  'Order board': ['تابلوی سفارش', 'لوحة الطلبات', 'Доска заказов', 'Tablero de pedidos'],
  'Stock & recipes': ['انبار و دستورها', 'المخزون والوصفات', 'Склад и рецепты', 'Stock y recetas'],
  'Stock &amp; recipes': ['انبار و دستورها', 'المخزون والوصفات', 'Склад и рецепты', 'Stock y recetas'],
  'Discounts': ['تخفیف‌ها', 'الخصومات', 'Скидки', 'Descuentos'],
  'Staff shifts': ['شیفت کارکنان', 'ورديات الموظفين', 'Смены персонала', 'Turnos del personal'],
  'Events & bookings': ['رویدادها و رزروها', 'الفعاليات والحجوزات', 'События и брони', 'Eventos y reservas'],
  'Events &amp; bookings': ['رویدادها و رزروها', 'الفعاليات والحجوزات', 'События и брони', 'Eventos y reservas'],
  'Telegram alerts': ['هشدارهای تلگرام', 'تنبيهات تيليجرام', 'Оповещения в Telegram', 'Avisos por Telegram'],
  'Finances': ['امور مالی', 'المالية', 'Финансы', 'Finanzas'],
  'Backups': ['پشتیبان‌گیری', 'النسخ الاحتياطي', 'Резервные копии', 'Copias de seguridad'],
  'Your own domain': ['دامنهٔ خودت', 'نطاقك الخاص', 'Свой домен', 'Tu propio dominio'],
};

/** The visitor's language: ?lang= (remembered), the shared chth_lang cookie, then the browser. */
export function landingLocale(req: Request): { locale: Locale; setCookie?: string } {
  const param = new URL(req.url).searchParams.get('lang');
  if (isLocale(param)) return { locale: param, setCookie: localeCookie(param) };
  const cookie = localeFromCookie(req.headers.get('Cookie'));
  if (cookie) return { locale: cookie };
  return { locale: pickLocale([req.headers.get('Accept-Language')]) };
}

const LANDING_CSS = `
html[dir="rtl"] body{font-family:var(--chth-font-rtl)}html[dir="rtl"] .window,html[dir="rtl"] .phone,html[dir="rtl"] .board{direction:ltr}html[dir="rtl"] .display{font-family:var(--chth-font-rtl);letter-spacing:0}
`;

/** Translates the rendered landing page, adds the navbar language menu and localizes the CHTH footer. */
export function localizeLanding(page: string, locale: Locale): string {
  // The footer is swapped before translating, so the translator never sees its English text.
  let out = page.replace(footerHtml('en', 'cafe'), footerHtml(locale, 'cafe'));
  if (locale !== 'en') {
    const col = COL[locale];
    // Fragments with markup first, then plain text nodes and text attributes.
    for (const [en, row] of Object.entries(LANDING)) if (en.includes('<')) out = out.split(en).join(row[col]);
    const tr = (text: string) => {
      const key = text.trim().replace(/\s+/g, ' ');
      const row = LANDING[key];
      return row ? text.replace(text.trim(), row[col]) : null;
    };
    out = out.split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>)/i).map((part, i) => i % 2 ? part : part
      .replace(/>([^<>]+)</g, (m, text: string) => { const t = tr(text); return t == null ? m : `>${t}<`; })
      .replace(/\b(aria-label|placeholder|content)="([^"]*)"/g, (m, name: string, value: string) => { const t = tr(value); return t == null ? m : `${name}="${t}"`; })
    ).join('');
    out = out.replace(/<title>([^<]*) · CHTH Café Cloud<\/title>/, (m, title: string) => { const t = tr(title); return t == null ? m : `<title>${t} · CHTH Café Cloud</title>`; });
  }
  return out
    .replace('<html lang="en" data-chth-product="cafe">', `<html lang="${locale}" dir="${dirOf(locale)}" data-chth-product="cafe">`)
    .replace('</head>', `<style>${LANDING_CSS}</style></head>`)
    .replace('<!--chth-lang-->', languageMenuHtml(locale));
}
