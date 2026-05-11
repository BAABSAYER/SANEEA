import logoSvg from "@/assets/logo.png";

const sections = [
  {
    arTitle: "المعلومات التي نجمعها",
    arBody:
      "نجمع المعلومات التي تقدمها عند التسجيل أو استخدام خدمات سنيع، مثل الاسم، رقم الجوال، بيانات الحساب، تفاصيل المناسبة، الرسائل، والملفات أو الصور التي ترفعها داخل التطبيق.",
    enTitle: "Information We Collect",
    enBody:
      "We collect information you provide when registering or using Saneea, such as your name, mobile number, account details, event details, messages, and files or images you upload in the app.",
  },
  {
    arTitle: "كيفية استخدام المعلومات",
    arBody:
      "نستخدم المعلومات لتقديم خدمات حجز وتنظيم المناسبات، إدارة الطلبات، التواصل بين العملاء والإدارة أو المزودين، إرسال إشعارات الخدمة، تحسين تجربة المستخدم، ودعم الأمان ومنع إساءة الاستخدام.",
    enTitle: "How We Use Information",
    enBody:
      "We use information to provide event booking and planning services, manage requests, enable communication between clients, admins, and vendors, send service notifications, improve the user experience, and support safety and fraud prevention.",
  },
  {
    arTitle: "مشاركة المعلومات",
    arBody:
      "قد نشارك المعلومات الضرورية مع مزودي الخدمة المرتبطين بالمناسبة أو مزودي البنية التقنية مثل الاستضافة، التخزين، الرسائل، أو مزودي الدفع عند تفعيلها. لا نبيع بياناتك الشخصية.",
    enTitle: "Information Sharing",
    enBody:
      "We may share necessary information with event-related service providers or technical providers such as hosting, storage, messaging, or payment providers when enabled. We do not sell your personal data.",
  },
  {
    arTitle: "الحسابات وتسجيل الدخول",
    arBody:
      "قد يستخدم التطبيق رقم الجوال، كلمة المرور، رموز التحقق، أو رموز الدخول لحماية حسابك. يجب الحفاظ على سرية بيانات الدخول وإبلاغنا عند الاشتباه بأي استخدام غير مصرح به.",
    enTitle: "Accounts and Login",
    enBody:
      "The app may use your mobile number, password, verification codes, or access tokens to protect your account. You should keep login details confidential and notify us if you suspect unauthorized use.",
  },
  {
    arTitle: "الملفات والصور",
    arBody:
      "قد يتيح التطبيق رفع صور أو مستندات متعلقة بالمناسبات. يتم استخدام هذه الملفات لتقديم الخدمة المطلوبة وقد يتم تخزينها لدى مزودي تخزين سحابي آمنين.",
    enTitle: "Files and Images",
    enBody:
      "The app may allow uploading images or documents related to events. These files are used to provide the requested service and may be stored with secure cloud storage providers.",
  },
  {
    arTitle: "الاحتفاظ بالبيانات",
    arBody:
      "نحتفظ بالبيانات طالما كانت مطلوبة لتقديم الخدمة، الامتثال للالتزامات النظامية، حل النزاعات، أو الحفاظ على سجلات الأعمال. يمكنك طلب تحديث أو حذف بياناتك وفق ما تسمح به الأنظمة.",
    enTitle: "Data Retention",
    enBody:
      "We keep data as long as needed to provide the service, comply with legal obligations, resolve disputes, or maintain business records. You may request updates or deletion where permitted by law.",
  },
  {
    arTitle: "أمان البيانات",
    arBody:
      "نستخدم إجراءات تقنية وتنظيمية مناسبة لحماية البيانات، لكن لا توجد طريقة نقل أو تخزين إلكترونية آمنة بنسبة كاملة. نعمل على تقليل المخاطر وحماية معلوماتك قدر الإمكان.",
    enTitle: "Data Security",
    enBody:
      "We use appropriate technical and organizational measures to protect data, but no electronic transmission or storage method is completely secure. We work to reduce risks and protect your information as much as possible.",
  },
  {
    arTitle: "خصوصية الأطفال",
    arBody:
      "خدمات سنيع ليست موجهة للأطفال مباشرة. إذا علمنا بجمع بيانات طفل دون موافقة مناسبة، سنعمل على حذفها أو التعامل معها وفق المتطلبات النظامية.",
    enTitle: "Children's Privacy",
    enBody:
      "Saneea services are not directed to children. If we learn that we collected a child's data without appropriate consent, we will delete it or handle it according to applicable requirements.",
  },
  {
    arTitle: "التواصل معنا",
    arBody:
      "لأي أسئلة أو طلبات متعلقة بالخصوصية، يمكنك التواصل معنا عبر قنوات الدعم الرسمية لتطبيق سنيع.",
    enTitle: "Contact Us",
    enBody:
      "For privacy questions or requests, you can contact us through the official Saneea support channels.",
  },
];

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-[#f7f7f3] text-[#171717]">
      <section className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-6 py-10 text-center">
          <img src={logoSvg} alt="Saneea" className="mb-5 h-24 w-auto object-contain" />
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#1A5C32]">
            Saneea
          </p>
          <h1 className="text-3xl font-bold sm:text-5xl">سياسة الخصوصية | Privacy Policy</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            توضح هذه الصفحة كيفية تعامل سنيع مع بيانات المستخدمين في تطبيقات الويب والجوال.
            <span className="block">
              This page explains how Saneea handles user data across its web and mobile apps.
            </span>
          </p>
          <p className="mt-4 text-xs text-muted-foreground">Last updated: May 11, 2026</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-5 px-6 py-10">
        {sections.map((section) => (
          <article
            key={section.enTitle}
            className="grid gap-6 border-b border-black/10 bg-transparent py-6 md:grid-cols-2"
          >
            <div dir="rtl" className="text-right">
              <h2 className="text-xl font-bold text-[#1A5C32]">{section.arTitle}</h2>
              <p className="mt-3 text-sm leading-8 text-[#303030]">{section.arBody}</p>
            </div>
            <div dir="ltr">
              <h2 className="text-xl font-bold text-[#1A5C32]">{section.enTitle}</h2>
              <p className="mt-3 text-sm leading-7 text-[#303030]">{section.enBody}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
