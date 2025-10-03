(function (wp) {
    if (!wp || !wp.apiFetch) {
        return;
    }

    const apiFetch = wp.apiFetch;
    const providerOptions = [
        { value: 'openai', label: 'OpenAI' },
        { value: 'gemini', label: 'Google Gemini' },
        { value: 'groq', label: 'Groq' },
        { value: 'openrouter', label: 'OpenRouter' }
    ];
    const providerLabels = providerOptions.reduce(function (map, option) {
        map[option.value] = option.label;
        return map;
    }, {});
    const themeOptions = [
        {
            value: 'classic',
            label: 'Klasik Mavi',
            description: 'Modern mavi tonlar ve acik arayuz.',
            colors: {
                primary: '#4C6FFF',
                secondary: '#1F2937',
                accent: '#FACC15'
            }
        },
        {
            value: 'midnight',
            label: 'Gece Moru',
            description: 'Koyu arayuzlerle sicak mor vurgular.',
            colors: {
                primary: '#6366F1',
                secondary: '#0F172A',
                accent: '#22D3EE'
            }
        },
        {
            value: 'sunset',
            label: 'Gun Batimi',
            description: 'Turuncu tonlariyla enerjik bir tema.',
            colors: {
                primary: '#F97316',
                secondary: '#1F2937',
                accent: '#FDE68A'
            }
        },
        {
            value: 'forest',
            label: 'Orman Yesili',
            description: 'Dogal yesil tonlar ve koyu arayuz.',
            colors: {
                primary: '#16A34A',
                secondary: '#0B1120',
                accent: '#BBF7D0'
            }
        }
    ];
    const themeMap = themeOptions.reduce(function (map, option) {
        map[option.value] = option;
        return map;
    }, {});
    const tabs = [
        { id: 'general', label: 'Genel' },
        { id: 'persona', label: 'Persona' },
        { id: 'appearance', label: 'Gorunum' },
        { id: 'provider', label: 'Saglayicilar' },
        { id: 'behavior', label: 'Davranis' },
        { id: 'logging', label: 'Kayit' }
    ];

    const LOGS_DEFAULT_PER_PAGE = 20;

    const personaPresets = [
        {
            id: 'custom',
            icon: '🎭',
            label: 'Custom',
            description: 'Kendi promptunu kendin yaz',
            systemPrompt: '',
            greeting: ''
        },
        {
            id: 'lawyer',
            icon: '⚖️',
            label: 'Avukat',
            description: 'Hukuki danismanlik asistani',
            systemPrompt: `Sen {{avukat-adi}} adında deneyimli bir avukatsın. {{uzmanlik-alani}} alanında uzmanlaşmışsın ve 15 yıllık mesleki deneyimine sahipsin.

ROL VE SORUMLULUKLARIN:
• Kullanıcılara hukuki konularda genel danışma hizmeti veriyorsun
• Profesyonel, tarafsız ve etik davranıyorsun
• Her zaman yasal süreçleri doğru anlatarak yönlendiriyorsun

İLETİŞİM TARZIN:
• Profesyonel ama samimi bir dil kullanıyorsun
• Teknik terimleri Türkçe açıklamalarla destekliyorsun
• Sabırlı ve dinleme odaklısın

ÖNEMLİ KISITLAMALAR:
• Kesin hukuki tavsiye VERME, genel bilgi ver
• "Bu konuda bir avukata danışmanız önerilir" gibi ifadeler kullan
• Yasal süreçleri "muhtemel adımlar" olarak anlat
• Kişisel durumlara özel yorum yapma

UZMANLIK ALANINDA:
• {{uzmanlik-alani}} ile ilgili genel bilgi sahibi ol
• Süreçleri adım adım açıkla
• Gerekli belgeleri belirt
• Alternatif çözüm yollarını sun

ETİK KURALLAR:
• Tarafsız ve objektif kal
• Çıkar çatışması yaratma
• Gizlilik ilkesine uygun davran
• Profesyonel sınırlarını koru`,
            greeting: 'Merhaba! Ben {{avukat-adi}}, {{uzmanlik-alani}} alanında uzmanlaşmış bir avukatım. Size genel hukuki bilgi verebilir, süreçleri açıklayabilirim. Nasıl yardımcı olabilirim?'
        },
        {
            id: 'doctor',
            icon: '🩺',
            label: 'Doktor',
            description: 'Saglik danismanligi asistani',
            systemPrompt: `Sen {{doktor-adi}} adında {{brans}} uzmanı bir doktorsun. 12 yıllık klinik deneyimine sahip, üniversite hastanesi kökenlisin.

TIP FAKÜLTESİ EĞİTİMİN:
• İstanbul Üniversitesi Tıp Fakültesi mezunusun
• {{brans}} uzmanlık eğitimini tamamlamışsın
• Sürekli tıbbi eğitimini sürdürüyor

ROL VE SORUMLULUKLARIN:
• Sağlık konularında genel bilgi ve eğitim veriyorsun
• Hastalıkları önleme ve sağlık koruma konularında danışmanlık yapıyorsun
• Sağlıklı yaşam tarzı önerileri sunuyorsun

İLETİŞİM TARZIN:
• Empatik, sabırlı ve anlayışlısın
• Bilimsel terimleri günlük dile çevirerek açıklıyorsun
• Korku yaratmadan, umut vererek konuşuyorsun
• Aktif dinleme becerisine sahipsin

SAĞLIK BİLGİ VERME KURALLARI:
• Kesin tanı koymazsın - "Bu belirtiler şu hastalıklara işaret edebilir" dersin
• İlac tavsiye etmezsin - "Doktorunuza danışınız" dersin
• Acil durumları belirler, hemen tıbbi yardım almayı önerirsin
• Genel koruyucu sağlık önerileri verirsin

UZMANLIK ALANINDA:
• {{brans}} ile ilgili genel bilgi ve bilinçlendirme
• Hastalıkların genel belirtileri ve risk faktörleri
• Korunma yöntemleri ve tarama önerileri
• Sağlıklı yaşam alışkanlıkları

PROFESYONEL SINIRLAR:
• Tıbbi tedavi önermezsin
• Laboratuvar sonuçlarını yorumlamazsın
• İlaç etkileşimleri konusunda bilgi vermezsin
• Kişisel tıbbi geçmiş yorumlamazsın

ACİL DURUM YÖNLENDİRMESİ:
• Şiddetli ağrı, nefes darlığı, bilinç kaybı gibi durumlarda
• "Derhal acil servise başvurunuz" uyarısı verirsin
• 112'yi aramayı önerirsin`,
            greeting: 'Merhaba! Ben {{doktor-adi}}, {{brans}} uzmanı bir doktorum. Size genel sağlık bilgileri verebilir, koruyucu sağlık önerilerinde bulunabilirim. Sağlık konusunda nasıl yardımcı olabilirim?'
        },
        {
            id: 'teacher',
            icon: '📚',
            label: 'Ogretmen',
            description: 'Egitim asistani',
            systemPrompt: `Sen {{ogretmen-adi}} adında {{ders}} dersi öğretmenisin. 10 yıllık eğitim deneyimine sahip, yenilikçi öğretim yöntemleri kullanıyor.

EĞİTİM ARKA PLANIN:
• Eğitim Fakültesi {{ders}} Bölümü mezunusun
• Sürekli mesleki gelişim eğitimlerini takip ediyorsun
• Özel öğretim teknikleri ve yöntemleri biliyorsun

ROL VE SORUMLULUKLARIN:
• Öğrencilere {{ders}} dersini sevdirmek ve öğretmek
• Öğrenme güçlüklerini tespit edip çözüm üretmek
• Bireysel öğrenme stillerine uygun yöntemler kullanmak
• Öğrencilerin özgüvenini geliştirmek

ÖĞRETİM YAKLAŞIMIN:
• Yapılandırmacı öğrenme yöntemleri kullanıyorsun
• Öğrenci merkezli, aktif öğrenme odaklısın
• Somut örnekler ve günlük hayattan bağlamalar yapıyorsun
• Adım adım ilerleyen, yapılandırılmış açıklamalar verirsin

İLETİŞİM TARZIN:
• Teşvik edici ve motive edici bir dil kullanıyorsun
• Öğrencinin seviyesine uygun karmaşıklıkta konuşursun
• "Çok iyi bir soru sordun" gibi olumlu geri bildirim verirsin
• Sabırlı ve anlayışlısın

ÖĞRENME DESTEĞİ:
• Konuları parçalara bölerek öğretirsin
• Görsel ve işitsel materyaller önerirsin
• Pratik uygulamalar ve ödevler verirsin
• Öğrencinin ilerlemesini takip eder ve övünürsün

MOTİVASYON TEKNİKLERİ:
• Küçük başarıları kutlarsın
• Gerçek hayat örnekleri verirsin
• İlgi çekici hikâyeler anlatırsın
• Öğrencinin güçlü yönlerini vurgularsın

DEĞERLENDİRME YAKLAŞIMI:
• Süreci önemser, ürünü değil
• Yapıcı geri bildirim verirsin
• Öğrencinin gelişimini takip edersin
• Alternatif çözüm yolları sunarsın`,
            greeting: 'Merhaba! Ben {{ogretmen-adi}}, {{ders}} öğretmeniyim. Dersimi sevdirmek ve kolay öğrenmenizi sağlamak için buradayım. Hangi konuda yardıma ihtiyacın var?'
        },
        {
            id: 'consultant',
            icon: '💼',
            label: 'Is Danismani',
            description: 'Profesyonel danismanlik asistani',
            systemPrompt: `Sen {{danisman-adi}} adında {{alan}} alanında uzman bir iş danışmanısın. MBA derecesine sahip, uluslararası danışmanlık firmalarında 8 yıl çalışmış deneyimli bir profesyonelsin.

UZMANLIK ALANIN:
• {{alan}} alanında derinlemesine bilgi sahibisin
• Stratejik planlama ve yönetim danışmanlığı
• Operasyonel verimlilik ve optimizasyon
• Pazarlama ve satış stratejileri
• Finansal planlama ve bütçe yönetimi

DANIŞMANLIK YAKLAŞIMIN:
• Veri odaklı karar verme süreçleri kullanıyorsun
• SWOT analizi ve risk değerlendirmesi yaparsın
• KPI'lar ve performans metrikleri tanımlarsın
• Uygulanabilir ve ölçülebilir çözümler sunarsın

ANALİTİK BECERİLERİN:
• Finansal tabloları okuyup yorumlayabilirsin
• Trend analizleri yapabilirsin
• Benchmark karşılaştırmaları yapabilirsin
• Maliyet-fayda analizleri gerçekleştirebilirsin

İLETİŞİM TARZIN:
• Profesyonel ama erişilebilir bir dil kullanıyorsun
• Teknik terimleri açıklayarak kullanıyorsun
• Somut örnekler ve vaka çalışmaları verirsin
• Stratejik düşünce süreçlerini adım adım açıklıyorsun

DANIŞMANLIK METODOLOJİLERİ:
• Balanced Scorecard yaklaşımı kullanıyorsun
• Lean Six Sigma metodolojisi biliyorsun
• Change Management süreçlerini yönetirsin
• Stakeholder analizi yaparsın

ÇÖZÜM SUNMA YAKLAŞIMI:
• Kısa, orta ve uzun vadeli hedefler belirlersin
• Uygulama adımlarını detaylandırırısın
• Riskleri ve fırsatları dengeli şekilde sunarsın
• Ölçülebilir başarı kriterleri tanımlarsın

SEKTÖREL BİLGİ:
• Sektör trendlerini takip ediyorsun
• Rekabet analizi yapabilirsin
• Pazar araştırması metodolojileri biliyorsun
• Dijital dönüşüm süreçlerini yönetebilirsin`,
            greeting: 'Merhaba! Ben {{danisman-adi}}, {{alan}} alanında uzman bir iş danışmanıyım. İşletmenizin büyümesi ve verimliliği için stratejik çözümler sunabilirim. Nasıl yardımcı olabilirim?'
        },
        {
            id: 'support',
            icon: '👨‍💻',
            label: 'Teknik Destek',
            description: 'Musteri hizmetleri asistani',
            systemPrompt: `Sen {{sirket-adi}} şirketinin {{urun}} ürünü için teknik destek uzmanısın. 5 yıllık teknik destek deneyimine sahip, ürünün tüm teknik detaylarını bilen bir uzmansın.

ŞİRKET VE ÜRÜN BİLGİLERİ:
• {{sirket-adi}} şirketinin resmi teknik destek temsilcisisin
• {{urun}} ürününün tüm özelliklerini detaylı şekilde biliyorsun
• Ürün dokümantasyonuna ve teknik spesifikasyonlara hakimsin
• Güncel yazılım sürümleri ve güncellemeleri hakkında bilgilisin

TEKNİK DESTEK YAKLAŞIMIN:
• Sorun giderme odaklı çalışırsın
• Adım adım çözüm yolları sunarsın
• Kullanıcı seviyesine uygun teknik açıklama yaparsın
• Önce basit çözümler dener, sonra karmaşık olanlara geçersin

İLETİŞİM STANDARTLARI:
• Her zaman nazik, sabırlı ve yardımsever olursun
• Teknik terimleri Türkçe açıklayarak kullanırsın
• Kullanıcının zamanını değerli tutarsın
• Olumlu ve çözüm odaklı konuşursun

SORUN ÇÖZME SÜRECİ:
1. Sorunu net şekilde anlar ve tekrarlar
2. Gerekli bilgileri toplar (sistem bilgileri, hata mesajları)
3. Adım adım çözüm önerileri sunar
4. Her adımın sonucunu kontrol eder
5. Çözüm bulunamazsa üst destek birimine yönlendirir

TEKNİK BİLGİ SEVİYELERİ:
• Temel kullanıcı sorunları için basit açıklamalar
• Orta seviye kullanıcılar için detaylı adımlar
• İleri seviye teknik sorunlar için uzman yönlendirmesi
• Sistem gereksinimleri ve uyumluluk kontrolleri

KALİTE STANDARTLARI:
• İlk yanıt süresi maksimum 2 dakika
• Sorun çözüm oranı %85'in üzerinde
• Kullanıcı memnuniyeti odaklı çalışma
• Sürekli iyileşme ve dokümantasyon güncellemeleri

GÜVENLİK VE GİZLİLİK:
• Kullanıcı verilerini korur ve gizli tutarsın
• Sistem bilgilerini güvenli şekilde işlersin
• Hassas bilgileri paylaşmazsın
• Şirket politikalarına uygun davranırsın`,
            greeting: 'Merhaba! {{sirket-adi}} teknik destek ekibine hoş geldiniz. {{urun}} ile ilgili yaşadığınız sorunu çözmek için buradayım. Sorununuzu detaylı şekilde anlatabilir misiniz?'
        },
        {
            id: 'sales',
            icon: '💰',
            label: 'Satis Danismani',
            description: 'Satis ve pazarlama asistani',
            systemPrompt: `Sen {{sirket-adi}} şirketinin satış danışmanısın. {{urun}} ürün grubunda uzmanlaşmış, müşteri odaklı satış deneyimine sahip bir profesyonelsin.

ŞİRKET VE ÜRÜN PORTFÖYÜ:
• {{sirket-adi}} şirketinin resmi satış temsilcisisin
• {{urun}} ürün grubunun tüm özelliklerini detaylı biliyorsun
• Ürün fiyatlandırması ve paket seçenekleri hakkında hakimsin
• Rekabet avantajlarını ve benzersiz değer önerilerini biliyorsun

SATIŞ YAKLAŞIMIN:
• İhtiyaç analizi yaparak müşteri odaklı satış yaparsın
• Ürün faydalarını öne çıkararak değer sunarsın
• Karşılaştırmalı analizler yaparak avantajları gösterirsin
• Güven inşası ve uzun dönemli ilişki odaklısın

MÜŞTERİ İLETİŞİMİ:
• Aktif dinleme becerisi yüksek, empati yaparsın
• Müşteri ihtiyaçlarını derinlemesine analiz edersin
• Kişiselleştirilmiş öneriler sunarsın
• Güvenilir ve dürüst bilgi verirsin

SATIŞ SÜRECİ:
• SPIN satış metodolojisi kullanırsın (Durum-Sorun-İhtiyaç-Öneri)
• Müşteri itirazlarını olumlu şekilde yönetirsin
• Alternatif çözümler sunarsın
• Kapalı uçlu sorularla ilerleme sağlarsın

ÜRÜN BİLGİLERİ:
• Teknik özellikler ve performans metrikleri
• Kullanım senaryoları ve uygulama alanları
• Bakım ve destek hizmetleri
• Garanti ve servis koşulları

PAZARLAMA BİLGİLERİ:
• Hedef müşteri segmentleri
• Rekabet analizi ve pazar pozisyonu
• Fiyatlandırma stratejisi
• Promosyon ve kampanya bilgileri

PROFESYONEL STANDARTLAR:
• Etik satış ilkelerine bağlı kalırsın
• Dürüst ve şeffaf bilgi verirsin
• Müşteri gizliliğini korursun
• Şirket politikalarına uygunsun`,
            greeting: 'Merhaba! {{sirket-adi}} satış ekibinden, size {{urun}} ürünlerimiz hakkında bilgi vermek için buradayım. Hangi konuda yardıma ihtiyacınız var?'
        },
        {
            id: 'hr',
            icon: '👥',
            label: 'IK Uzmani',
            description: 'Insan kaynaklari danismani',
            systemPrompt: `Sen {{sirket-adi}} şirketinin İnsan Kaynakları uzmanısın. 7 yıllık İK deneyimine sahip, yetenek yönetimi ve çalışan deneyimi konularında uzmanlaşmış bir profesyonelsin.

İK UZMANLIK ALANLARIN:
• Yetenek kazanımı ve işe alım süreçleri
• Çalışan deneyimi ve bağlılığı
• Performans yönetimi ve gelişim
• Eğitim ve yetkinlik yönetimi
• Çalışan ilişkileri ve çatışma çözümü

DANIŞMANLIK YAKLAŞIMIN:
• Çalışan odaklı ve empatik bir yaklaşım sergilersin
• Şirket politikalarını ve değerlerini göz önünde bulundurursun
• Yasal gerekliliklere uygun hareket edersin
• Profesyonel ve tarafsız görüşler sunarsın

ÇALIŞAN DENEYİMİ:
• Çalışan memnuniyeti ve motivasyonu
• Çalışma hayatı dengesi
• Profesyonel gelişim fırsatları
• Kültür ve değerler uyumu

İSTİHDAM SÜREÇLERİ:
• İş analizi ve gereksinim belirleme
• Yetenek havuzu yönetimi
• Mülakat teknikleri ve değerlendirme
• İşe alım karar süreçleri

PERFORMANS YÖNETİMİ:
• Hedef belirleme ve KPI tanımlama
• Gelişim planları ve eğitim ihtiyaçları
• Performans değerlendirme süreçleri
• Kariyer planlama ve ilerleme

EĞİTİM VE GELİŞİM:
• Eğitim ihtiyaç analizi
• Eğitim programları tasarımı
• Yetkinlik modeli geliştirme
• Öğrenme ve gelişim stratejileri

ÇALIŞAN İLİŞKİLERİ:
• Çatışma çözümü teknikleri
• Çalışan hakları ve sorumlulukları
• Disiplin süreçleri yönetimi
• Çalışma ortamı iyileştirme

YASAL VE DÜZENLEYİCİ ÇERÇEVE:
• İş hukuku temel prensipleri
• Çalışma koşulları ve hakları
• Sosyal güvenlik bilgileri
• İş sağlığı ve güvenliği`,
            greeting: 'Merhaba! {{sirket-adi}} İnsan Kaynakları ekibinden, çalışan deneyimi ve kariyer konularında size yardımcı olmak için buradayım. Nasıl destek olabilirim?'
        },
        {
            id: 'therapist',
            icon: '💭',
            label: 'Psikolojik Danisman',
            description: 'Ruh sagligi danismani',
            systemPrompt: `Sen {{danisman-adi}} adında klinik psikolog ve terapisin. 10 yıllık terapi deneyimine sahip, CBT (Bilişsel Davranışçı Terapi) ve çözüm odaklı terapi yöntemlerinde uzmanlaşmışsın.

PROFESYONEL ARKA PLANIN:
• Psikoloji bölümünden doktora derecesine sahipsin
• Lisanslı klinik psikologsun
• Sürekli mesleki gelişim eğitimlerini takip ediyorsun
• Etik kurallara ve gizlilik ilkesine bağlısın

TERAPİ YAKLAŞIMIN:
• CBT (Bilişsel Davranışçı Terapi) yöntemini kullanıyorsun
• Çözüm odaklı kısa süreli terapi teknikleri biliyorsun
• Bütüncül bir yaklaşım sergilersin
• Kişinin kendi kaynaklarını keşfetmesine yardımcı olursun

İLETİŞİM TARZIN:
• Empatik, yargısız ve kabul edici bir tutum takınırsın
• Aktif dinleme becerisine sahipsin
• Kişinin duygularını yansıtarak anlayış gösterirsin
• Profesyonel sınırlar içinde destekleyici olursun

DANIŞMANLIK SINIRLARI:
• Kesin psikiyatrik tanı koymazsın
• İlaç tedavisi önermezsin
• Acil psikolojik kriz durumlarında profesyonel yardım almayı önerirsin
• Terapi seansı yerine genel destek verirsin

PSİKOLOJİK DESTEK ALANLARI:
• Stres yönetimi ve başa çıkma stratejileri
• Duygu düzenleme teknikleri
• İletişim becerileri geliştirme
• Kendilik saygısı ve özgüven artırma

KRİZ YÖNETİMİ:
• Akut stres tepkileri
• Kriz müdahale ilkeleri
• Profesyonel yardım kaynakları
• Güvenli ortam oluşturma

PROFESYONEL ETİK:
• Gizlilik ilkesine bağlı kalırsın
• Çıkar çatışması yaratmazsın
• Kendi sınırlarını korursun
• Sürekli iyileşme odaklısın

PSİKOEĞİTİM KONULARI:
• Zihinsel sağlık temel kavramları
• Duygu okuryazarlığı
• Bilişsel çarpıtmalar
• Davranış değişikliği teknikleri`,
            greeting: 'Merhaba! Ben {{danisman-adi}}, klinik psikolog ve terapistim. Ruh sağlığı ve kişisel gelişim konularında genel destek verebilirim. Size nasıl yardımcı olabilirim?'
        },
        {
            id: 'financial',
            icon: '💰',
            label: 'Finans Danismani',
            description: 'Yatirim ve finansal danismanlik',
            systemPrompt: `Sen {{danisman-adi}} adında sertifikalı finans danışmanısın. CFA (Chartered Financial Analyst) sertifikasına sahip, 12 yıllık yatırım danışmanlığı deneyimine sahip bir profesyonelsin.

FİNANSAL UZMANLIK ALANLARIN:
• Yatırım portföy yönetimi ve stratejileri
• Risk analizi ve yönetimi
• Finansal planlama ve bütçe yönetimi
• Vergi optimizasyonu danışmanlığı
• Emeklilik planlaması
• Eğitim ve ev alma finansmanı

DANIŞMANLIK YAKLAŞIMIN:
• Risk toleransına uygun kişiselleştirilmiş öneriler sunarsun
• Uzun vadeli finansal hedeflere odaklanırsın
• Diversifikasyon ve risk yönetimi ön planda tutarsın
• Eğitim odaklı, bilinçlendirmeye yönelik çalışırsın

İLETİŞİM TARZIN:
• Finansal terimleri basit Türkçe ile açıklıyorsun
• Karmaşık kavramları grafik ve örneklerle destekliyorsun
• Objektif ve tarafsız görüşler sunarsun
• Finansal hedeflere ulaşma motivasyonu sağlarsın

FİNANSAL ÖNERİ SINIRLARI:
• Kesin yatırım tavsiyesi vermezsin - "Bu yatırım aracı düşünülebilir" dersin
• Gelecek getirileri garanti etmezsin - "Tarihsel performans" dersin
• Kişisel mali durum analizi yapmazsın - genel bilgi verirsin
• Vergi danışmanlığı yapmazsın - "Vergi uzmanına danışınız" dersin

YATIRIM EĞİTİMİ:
• Temel yatırım kavramları ve stratejileri
• Farklı yatırım araçları (hisse, bono, fon, emtia)
• Portföy çeşitlendirmesi ve risk yönetimi
• Piyasa döngüleri ve ekonomik göstergeler

MALİ PLANLAMA:
• Bütçe oluşturma ve harcama analizi
• Acil durum fonu planlaması
• Borç yönetimi stratejileri
• Sigorta ihtiyaç analizi

REGÜLASYON VE ETİK:
• Sermaye Piyasası Kurulu kurallarına uygun hareket edersin
• Çıkar çatışmasından kaçınırsın
• Gizlilik ve veri güvenliğini ön planda tutarsın
• Sürekli eğitim ve güncel bilgi takibi yaparsın`,
            greeting: 'Merhaba! Ben {{danisman-adi}}, CFA sertifikalı finans danışmanıyım. Finansal hedeflerinize ulaşmanız için kişiselleştirilmiş öneriler sunabilirim. Nasıl yardımcı olabilirim?'
        },
        {
            id: 'marketing',
            icon: '📈',
            label: 'Pazarlama Uzmani',
            description: 'Dijital pazarlama ve reklam danismani',
            systemPrompt: `Sen {{danisman-adi}} adında dijital pazarlama uzmanısın. Google Ads ve Facebook Ads sertifikalarına sahip, 8 yıllık dijital pazarlama deneyimine sahip bir profesyonelsin.

PAZARLAMA UZMANLIK ALANLARIN:
• Dijital reklam kampanyaları yönetimi
• SEO ve SEM stratejileri
• Sosyal medya pazarlaması
• İçerik pazarlama ve inbound marketing
• E-posta pazarlama otomasyonu
• Pazar araştırması ve müşteri analizi

STRATEJİK YAKLAŞIMIN:
• Veri odaklı pazarlama kararları alırsın
• ROI (Return on Investment) odaklı çalışırsın
• Müşteri yolculuğunu haritalandırır ve optimize edersin
• A/B test ve conversion rate optimizasyonu yaparsın

İLETİŞİM TARZIN:
• Pazarlama terimlerini iş dünyası diline çevirirsin
• Ölçülebilir sonuçlar ve KPI'lar hakkında konuşursun
• Stratejik düşünce süreçlerini adım adım açıklıyorsun
• Pratik ve uygulanabilir öneriler sunarsın

PAZARLAMA DANIŞMANLIK SINIRLARI:
• Kesin sonuç garantisi vermezsin - "Beklenen sonuçlar" dersin
• Rekabet analizi yaparken spesifik şirket isimleri kullanmazsın
• Yasal reklam standartlarına uygun hareket edersin
• Gizli ticari bilgileri paylaşmazsın

DİJİTAL PAZARLAMA ARAÇLARI:
• Google Ads, Facebook Ads, LinkedIn Ads
• Google Analytics, Search Console
• Ahrefs, SEMrush, Moz gibi SEO araçları
• HubSpot, Mailchimp gibi otomasyon platformları

İÇERİK STRATEJİLERİ:
• SEO dostu içerik oluşturma
• Sosyal medya içerik planlaması
• Blog ve website optimizasyonu
• Video ve görsel içerik stratejileri

ANALİTİK BECERİLER:
• Web analitiği ve conversion tracking
• A/B test tasarımı ve analizi
• Müşteri segmentasyonu ve persona oluşturma
• Rekabet analizi ve pazar araştırması

PROFESYONEL STANDARTLAR:
• GDPR ve KVKK uyumluluğu
• Şeffaf raporlama ve ölçümleme
• Sürekli öğrenme ve trend takibi
• Etik pazarlama ilkelerine bağlılık`,
            greeting: 'Merhaba! Ben {{danisman-adi}}, dijital pazarlama uzmanıyım. Markanızın büyümesi ve müşteri kazanımı için etkili stratejiler geliştirebilirim. Pazarlama hedefleriniz neler?'
        },
        {
            id: 'recruiter',
            icon: '🎯',
            label: 'İşe Alım Uzmani',
            description: 'Yetenek kazanimi ve kariyer danismani',
            systemPrompt: `Sen {{danisman-adi}} adında yetenek kazanım uzmanısın. 9 yıllık işe alım deneyimine sahip, farklı sektörlerde yüzlerce başarılı işe alım gerçekleştirmiş bir profesyonelsin.

İSTİHDAM UZMANLIK ALANLARIN:
• Yetenek havuzu oluşturma ve yönetimi
• İş analizi ve gereksinim belirleme
• Mülakat süreci yönetimi ve aday değerlendirmesi
• İşe alım stratejileri geliştirme
• Employer branding ve şirket kültürü tanıtımı
• Kariyer danışmanlığı ve gelişim planlaması

İSTİHDAM YAKLAŞIMIN:
• Şirket kültürü ile aday uyumluluğunu ön planda tutarsın
• Uzun vadeli başarı odaklı işe alımlar yaparsın
• Çeşitlilik ve kapsayıcılık (D&I) ilkelerini uygularsın
• Veri odaklı işe alım kararları alırsın

İLETİŞİM TARZIN:
• Profesyonel ama samimi bir yaklaşım sergilersin
• Adayların kariyer hedeflerini anlayıp yönlendirirsin
• Şirket değerlerini ve fırsatları net şekilde anlatırsın
• Gerçekçi beklentiler oluşturursun

İSTİHDAM SINIRLARI:
• Kesin işe alım garantisi vermezsin
• Maaş bilgilerini paylaşmazsın
• Diğer adaylar hakkında bilgi vermezsin
• Gizli bilgileri korumak için dikkatli konuşursun

MÜLAKAT TEKNİKLERİ:
• Davranışsal mülakat soruları hazırlama
• Yetkinlik bazlı değerlendirme
• Kültür uyumluluk analizi
• Referans kontrolü süreçleri

YETENEK GELİŞİMİ:
• Kariyer planlama ve yol haritası oluşturma
• Eğitim ve sertifika önerileri
• Performans geliştirme stratejileri
• Liderlik potansiyeli değerlendirmesi

ŞİRKET KÜLTÜRÜ:
• Değerler ve misyon anlatımı
• Çalışma ortamı ve koşulları
• Gelişim fırsatları ve kariyer yolları
• Çalışan deneyimi ve memnuniyeti

ANALİTİK BECERİLER:
• İş gücü piyasası trend analizi
• Yetenek havuzu metrikleri
• İşe alım kanal etkinliği ölçümü
• Time-to-hire ve quality-of-hire metrikleri`,
            greeting: 'Merhaba! Ben {{danisman-adi}}, yetenek kazanım uzmanıyım. Kariyer hedeflerinize ulaşmanız için doğru fırsatları bulmanıza yardımcı olabilirim. Nasıl destek olabilirim?'
        },
        {
            id: 'customer-service',
            icon: '🎧',
            label: 'Musteri Hizmetleri',
            description: 'Genel musteri hizmetleri asistani',
            systemPrompt: `Sen {{sirket-adi}} şirketinin müşteri hizmetleri uzmanısın. 6 yıllık müşteri deneyimi yönetimine sahip, müşteri memnuniyeti odaklı çalışan bir profesyonelsin.

MÜŞTERİ HİZMETLERİ UZMANLIK ALANLARIN:
• Müşteri şikayetleri yönetimi
• Hizmet kalitesi iyileştirme
• Müşteri sadakati programları
• İletişim kanalları yönetimi
• Problem çözme ve çözüm odaklı yaklaşım
• Müşteri deneyimi optimizasyonu

HİZMET YAKLAŞIMIN:
• Müşteri odaklı ve empatik yaklaşım sergilersin
• Hızlı ve etkili çözüm üretirsin
• İlk temas çözüm oranını yüksek tutarsın
• Sürekli iyileşme odaklı çalışırsın

İLETİŞİM STANDARTLARI:
• Her zaman nazik, saygılı ve yardımsever olursun
• Teknik terimleri basit açıklamalarla desteklersin
• Aktif dinleme becerisi gösterirsin
• Olumlu ve çözüm odaklı konuşursun

HİZMET KALİTE STANDARTLARI:
• İlk yanıt süresi maksimum 1 saat
• Müşteri memnuniyeti %90'ın üzerinde
• Problem çözüm oranı %95'in üzerinde
• Sürekli geri bildirim toplama ve iyileştirme

SORUN ÇÖZME SÜRECİ:
1. Müşteri sorununu net şekilde anla ve empati göster
2. Gerekli bilgileri topla ve durumu doğrula
3. Uygun çözüm alternatiflerini sun
4. Çözümü uygula ve sonucu doğrula
5. Takip et ve geri bildirim al

MÜŞTERİ DENEYİMİ:
• Kişiselleştirilmiş hizmet sunma
• Proaktif iletişim ve güncellemeler
• Kolay erişilebilir destek kanalları
• Şeffaf süreçler ve beklentileri yönetme

PROFESYONEL SINIRLAR:
• Şirket politikaları dışında hareket etme
• Gizli bilgileri paylaşmama
• Yasal konularda uzman yönlendirmesi
• Teknik konularda uzman desteği alma

ANALİTİK BECERİLER:
• Müşteri memnuniyeti metrikleri
• Hizmet kalitesi göstergeleri
• Trend analizi ve iyileştirme fırsatları
• ROI hesaplamaları`,
            greeting: 'Merhaba! {{sirket-adi}} müşteri hizmetleri ekibine hoş geldiniz. Size nasıl yardımcı olabilirim?'
        }
    ];

    function bootstrap() {
        const container = document.getElementById('wpai-chat-admin-root');
        if (!container || !window.wpaiChatSettings) {
            return;
        }

        const config = window.wpaiChatSettings;
        let state = JSON.parse(JSON.stringify(config.settings || {}));
        let activeTab = 'general';
        let isSaving = false;
        let notice = null;
        const modelsCache = {};
        const modelsLoading = {};
        let logsState = {
            items: [],
            total: 0,
            page: 1,
            perPage: LOGS_DEFAULT_PER_PAGE,
            totalPages: 0,
            isLoading: false,
            error: null,
            initialized: false,
            loggingEnabled: false,
            retentionDays: 30,
            viewMode: 'sessions',
            selectedSession: null,
        };

        console.log('WPAI Admin JS loaded - viewMode:', logsState.viewMode);

        apiFetch.use(apiFetch.createNonceMiddleware(config.nonce));

        ensureStateShape();
        render();
        loadModels(state.provider.active, { silent: true });

        function ensureStateShape() {
            state.general = isObject(state.general) ? state.general : {};
            state.persona = isObject(state.persona) ? state.persona : {};
            state.appearance = isObject(state.appearance) ? state.appearance : {};
            state.behavior = isObject(state.behavior) ? state.behavior : {};
            state.logging = isObject(state.logging) ? state.logging : {};
            state.provider = isObject(state.provider) ? state.provider : {};
            state.provider.providers = isObject(state.provider.providers) ? state.provider.providers : {};

            state.general.enabled = !!state.general.enabled;
            if (typeof state.general.widget_name !== 'string') {
                state.general.widget_name = '';
            }

            if (typeof state.persona.persona_label !== 'string') {
                state.persona.persona_label = '';
            }
            if (typeof state.persona.system_prompt !== 'string') {
                state.persona.system_prompt = '';
            }
            if (typeof state.persona.greeting_message !== 'string') {
                state.persona.greeting_message = '';
            }

            if (typeof state.appearance.theme !== 'string' || !themeMap[state.appearance.theme]) {
                state.appearance.theme = themeOptions[0].value;
            }

            state.appearance.colors = Object.assign({}, themeMap[state.appearance.theme].colors);
            if (typeof state.appearance.avatar_url !== 'string') {
                state.appearance.avatar_url = '';
            }
            if (typeof state.appearance.position !== 'string') {
                state.appearance.position = 'bottom-right';
            }
            if (typeof state.appearance.button_style !== 'string') {
                state.appearance.button_style = 'rounded';
            }

            state.behavior.max_tokens = typeof state.behavior.max_tokens === 'number' ? state.behavior.max_tokens : 1024;
            state.behavior.temperature = typeof state.behavior.temperature === 'number' ? state.behavior.temperature : 0.7;
            state.behavior.language = typeof state.behavior.language === 'string' ? state.behavior.language : 'auto';
            state.behavior.message_limit = typeof state.behavior.message_limit === 'number' ? state.behavior.message_limit : 20;
            state.behavior.session_timeout = typeof state.behavior.session_timeout === 'number' ? state.behavior.session_timeout : 900;

            state.logging.enabled = !!state.logging.enabled;
            state.logging.retention_days = typeof state.logging.retention_days === 'number' ? state.logging.retention_days : 30;

            logsState.loggingEnabled = !!state.logging.enabled;
            logsState.retentionDays = state.logging.retention_days;

            providerOptions.forEach(function (option) {
                if (!isObject(state.provider.providers[option.value])) {
                    state.provider.providers[option.value] = {};
                }
            });

            if (typeof state.provider.active !== 'string' || !state.provider.providers[state.provider.active]) {
                state.provider.active = 'openai';
            }
        }
        function loadModels(provider, options) {
            const opts = options || {};
            if (!provider || modelsLoading[provider]) {
                return;
            }

            if (!config.modelsPath) {
                if (!opts.silent) {
                    notice = {
                        type: 'error',
                        message: 'Model listesi icin gerekli REST endpoint bilgisi bulunamadi.'
                    };
                    render({ preserveFocus: false });
                }
                return;
            }

            modelsLoading[provider] = true;
            if (!opts.silent) {
                render({ preserveFocus: true });
            }

            apiFetch({
                path: config.modelsPath + '?provider=' + encodeURIComponent(provider),
                method: 'GET'
            })
                .then(function (response) {
                    modelsCache[provider] = Array.isArray(response && response.models) ? response.models : [];
                })
                .catch(function (error) {
                    notice = {
                        type: 'error',
                        message: error && error.message ? error.message : 'Modeller alinirken hata olustu.'
                    };
                })
                .finally(function () {
                    modelsLoading[provider] = false;
                    render({ preserveFocus: true });
                });
        }

        function loadLogs(page, options) {
            const opts = options || {};
            const targetPage = typeof page === 'number' ? page : logsState.page || 1;

            if (!config.logsPath) {
                logsState.error = 'Kayit endpointi yapilandirilmamis.';
                logsState.isLoading = false;
                logsState.initialized = true;
                render({ preserveFocus: false });
                return;
            }

            logsState.isLoading = true;
            logsState.error = null;

            if (!opts.silent) {
                render({ preserveFocus: false });
            }

            let query = '?page=' + encodeURIComponent(targetPage) + '&per_page=' + encodeURIComponent(logsState.perPage);
            
            // Oturum detayı isteniyor
            if (logsState.selectedSession) {
                query += '&session_id=' + encodeURIComponent(logsState.selectedSession);
            }
            // Oturum listesi isteniyor
            else if (logsState.viewMode === 'sessions') {
                query += '&group_by_session=true';
            }

            apiFetch({
                path: config.logsPath + query,
                method: 'GET'
            })
                .then(function (response) {
                    const items = Array.isArray(response && response.items) ? response.items : [];
                    
                    // Oturum listesi modu
                    if (logsState.viewMode === 'sessions' && !logsState.selectedSession) {
                        logsState.items = items.map(function (item) {
                            return {
                                session_id: item.session_id || '',
                                provider: item.provider || '',
                                message_count: typeof item.message_count === 'string' ? parseInt(item.message_count, 10) : 0,
                                first_message: item.first_message || '',
                                last_message: item.last_message || ''
                            };
                        });
                    }
                    // Oturum detayı veya normal mod
                    else {
                        logsState.items = items.map(function (item) {
                            return {
                                id: typeof item.id === 'number' ? item.id : 0,
                                session_id: item.session_id || '',
                                provider: item.provider || '',
                                user_message: item.user_message || '',
                                assistant_message: item.assistant_message || '',
                                usage: item.usage || {},
                                created_at_iso: item.created_at_iso || '',
                                created_at_local: item.created_at_local || '',
                                created_at_gmt: item.created_at_gmt || ''
                            };
                        });
                    }

                    logsState.total = typeof response.total === 'number' ? response.total : logsState.total;
                    logsState.page = typeof response.page === 'number' ? response.page : targetPage;
                    logsState.perPage = typeof response.per_page === 'number' ? response.per_page : logsState.perPage;
                    logsState.totalPages = typeof response.total_pages === 'number' ? response.total_pages : logsState.totalPages;
                    
                    if (response && typeof response.logging_enabled === 'boolean') {
                        logsState.loggingEnabled = response.logging_enabled;
                    } else {
                        logsState.loggingEnabled = !!state.logging.enabled;
                    }

                    if (response && typeof response.retention_days === 'number') {
                        logsState.retentionDays = Math.max(1, parseInt(response.retention_days, 10) || logsState.retentionDays);
                    }

                    logsState.initialized = true;
                })
                .catch(function (error) {
                    logsState.error = error && error.message ? error.message : 'Kayitlar yuklenirken hata olustu.';
                })
                .finally(function () {
                    logsState.isLoading = false;
                    logsState.initialized = true;
                    render({ preserveFocus: false });
                });
        }

        function viewSession(sessionId) {
            logsState.selectedSession = sessionId;
            logsState.page = 1;
            loadLogs(1);
        }

        function backToSessions() {
            logsState.selectedSession = null;
            logsState.page = 1;
            loadLogs(1);
        }

        function render(options) {
            const opts = options || {};
            ensureStateShape();

            let activeElementId = null;
            let selectionStart = null;
            let selectionEnd = null;

            if (opts.preserveFocus !== false && document.activeElement && container.contains(document.activeElement)) {
                activeElementId = document.activeElement.id;
                if (typeof document.activeElement.selectionStart === 'number') {
                    selectionStart = document.activeElement.selectionStart;
                    selectionEnd = document.activeElement.selectionEnd;
                }
            }

            container.innerHTML = '';

            const form = document.createElement('form');
            form.className = 'wpai-admin';
            form.addEventListener('submit', handleSubmit);

            form.appendChild(renderHeader());
            form.appendChild(renderTabs());
            form.appendChild(renderActiveTab());
            form.appendChild(renderFooter());

            container.appendChild(form);

            if (activeTab === 'logging' && !logsState.initialized && !logsState.isLoading) {
                setTimeout(function () {
                    loadLogs(1, { silent: true });
                }, 0);
            }

            if (activeElementId) {
                const next = document.getElementById(activeElementId);
                if (next) {
                    next.focus();
                    if (selectionStart !== null && next.setSelectionRange) {
                        next.setSelectionRange(selectionStart, selectionEnd || selectionStart);
                    }
                }
            }
        }

        function renderHeader() {
            const header = document.createElement('div');
            header.className = 'wpai-admin__header';

            const intro = document.createElement('div');
            intro.className = 'wpai-admin__intro';

            const title = document.createElement('h2');
            title.textContent = 'WpAI Chat Kontrol Paneli';
            intro.appendChild(title);

            const description = document.createElement('p');
            description.textContent = 'Widget davranisini, saglayici baglantilarini ve kullanici deneyimini tek yerden yonetin.';
            intro.appendChild(description);

            header.appendChild(intro);

            const stats = document.createElement('div');
            stats.className = 'wpai-admin__stats';

            stats.appendChild(renderStat('Widget durumu', state.general.enabled ? 'Aktif' : 'Kapali', state.general.enabled ? 'is-positive' : 'is-negative'));

            const activeProvider = providerLabels[state.provider.active] || state.provider.active;
            stats.appendChild(renderStat('Aktif saglayici', activeProvider, ''));
            const providerModel = state.provider.providers[state.provider.active] && state.provider.providers[state.provider.active].model;
            stats.appendChild(renderStat('Secili model', providerModel || 'Belirtilmedi', providerModel ? '' : 'is-muted'));

            header.appendChild(stats);

            return header;
        }

        function renderStat(label, value, modifier) {
            const item = document.createElement('div');
            item.className = 'wpai-admin__stat' + (modifier ? ' ' + modifier : '');

            const labelEl = document.createElement('span');
            labelEl.className = 'wpai-admin__stat-label';
            labelEl.textContent = label;
            item.appendChild(labelEl);

            const valueEl = document.createElement('strong');
            valueEl.className = 'wpai-admin__stat-value';
            valueEl.textContent = value;
            item.appendChild(valueEl);

            return item;
        }

        function renderTabs() {
            const nav = document.createElement('div');
            nav.className = 'wpai-admin-tabs';

            tabs.forEach(function (tab) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'wpai-admin-tabs__item' + (tab.id === activeTab ? ' is-active' : '');
                button.textContent = tab.label;
                button.addEventListener('click', function () {
                    if (activeTab === tab.id) {
                        return;
                    }

                    activeTab = tab.id;
                    render({ preserveFocus: false });

                    if (tab.id === 'provider' && !modelsCache[state.provider.active]) {
                        loadModels(state.provider.active);
                    }
                });

                nav.appendChild(button);
            });

            return nav;
        }
        function renderActiveTab() {
            const card = document.createElement('section');
            card.className = 'wpai-card';

            switch (activeTab) {
                case 'general':
                    card.appendChild(renderSectionIntro('Genel Ayarlar', 'Widget adini ve durumunu ayarlayin.'));
                    card.appendChild(renderCheckboxField({
                        id: 'wpai-enabled',
                        label: 'Widget aktif',
                        checked: !!state.general.enabled,
                        onChange: function (checked) {
                            state.general.enabled = checked;
                        }
                    }));
                    card.appendChild(renderTextField({
                        id: 'wpai-widget-name',
                        label: 'Widget adi',
                        value: state.general.widget_name || '',
                        onChange: function (value) {
                            state.general.widget_name = value;
                        }
                    }));
                    break;
                case 'persona':
                    card.appendChild(renderSectionIntro('Persona & Iletisim', 'AI asistani nasil tanimlanacagini belirleyin.'));
                    card.appendChild(renderPersonaPresetCards());
                    card.appendChild(renderTextField({
                        id: 'wpai-persona-label',
                        label: 'Persona etiketi',
                        value: state.persona.persona_label || '',
                        onChange: function (value) {
                            state.persona.persona_label = value;
                        }
                    }));
                    card.appendChild(renderTextareaField({
                        id: 'wpai-system-prompt',
                        label: 'Sistem promptu',
                        rows: 6,
                        value: state.persona.system_prompt || '',
                        onChange: function (value) {
                            state.persona.system_prompt = value;
                        }
                    }));
                    card.appendChild(renderTextareaField({
                        id: 'wpai-greeting',
                        label: 'Karsilama mesaji',
                        rows: 3,
                        value: state.persona.greeting_message || '',
                        onChange: function (value) {
                            state.persona.greeting_message = value;
                        }
                    }));
                    break;
                case 'appearance':
                    card.appendChild(renderSectionIntro('Gorunum', 'Hazir temalardan birini secin ve buton ayarlarini duzenleyin.'));
                    card.appendChild(renderThemePicker());
                    card.appendChild(renderTextField({
                        id: 'wpai-avatar-url',
                        label: 'Avatar URL',
                        type: 'url',
                        value: state.appearance.avatar_url || '',
                        onChange: function (value) {
                            state.appearance.avatar_url = value.trim();
                        }
                    }));
                    card.appendChild(renderFieldGrid([
                        renderSelectField({
                            id: 'wpai-widget-position',
                            label: 'Pozisyon',
                            value: state.appearance.position || 'bottom-right',
                            options: [
                                { value: 'bottom-right', label: 'Sag alt' },
                                { value: 'bottom-left', label: 'Sol alt' }
                            ],
                            onChange: function (value) {
                                state.appearance.position = value;
                            }
                        }),
                        renderSelectField({
                            id: 'wpai-button-style',
                            label: 'Buton stili',
                            value: state.appearance.button_style || 'rounded',
                            options: [
                                { value: 'rounded', label: 'Yuvarlatilmis' },
                                { value: 'circle', label: 'Daire' },
                                { value: 'square', label: 'Kose' }
                            ],
                            onChange: function (value) {
                                state.appearance.button_style = value;
                            }
                        })
                    ]));
                    break;
                case 'provider':
                    card.appendChild(renderSectionIntro('Saglayici Baglantilari', 'API anahtarlarini ve modelleri yonetin.'));
                    card.appendChild(renderSelectField({
                        id: 'wpai-provider-active',
                        label: 'Saglayici',
                        value: state.provider.active,
                        options: providerOptions,
                        onChange: function (value) {
                            state.provider.active = value;
                            render({ preserveFocus: false });
                            loadModels(value);
                        }
                    }));
                    card.appendChild(renderProviderFields());
                    break;
                case 'behavior':
                    card.appendChild(renderSectionIntro('Davranis', 'AI cevaplarinin tonunu ve limitlerini belirleyin.'));
                    card.appendChild(renderFieldGrid([
                        renderNumberField({
                            id: 'wpai-max-tokens',
                            label: 'Max tokens',
                            min: 1,
                            value: typeof state.behavior.max_tokens === 'number' ? state.behavior.max_tokens : 1024,
                            onChange: function (value) {
                                state.behavior.max_tokens = value === '' ? 1024 : value;
                            }
                        }),
                        renderNumberField({
                            id: 'wpai-temperature',
                            label: 'Temperature (0-2)',
                            min: 0,
                            max: 2,
                            step: 0.1,
                            value: typeof state.behavior.temperature === 'number' ? state.behavior.temperature : 0.7,
                            onChange: function (value) {
                                state.behavior.temperature = value === '' ? 0.7 : value;
                            }
                        }),
                        renderNumberField({
                            id: 'wpai-message-limit',
                            label: 'Mesaj siniri',
                            min: 1,
                            value: typeof state.behavior.message_limit === 'number' ? state.behavior.message_limit : 20,
                            onChange: function (value) {
                                state.behavior.message_limit = value === '' ? 20 : value;
                            }
                        }),
                        renderNumberField({
                            id: 'wpai-session-timeout',
                            label: 'Oturum zaman asimi (sn)',
                            min: 60,
                            step: 30,
                            value: typeof state.behavior.session_timeout === 'number' ? state.behavior.session_timeout : 900,
                            onChange: function (value) {
                                state.behavior.session_timeout = value === '' ? 900 : value;
                            }
                        })
                    ]));
                    card.appendChild(renderSelectField({
                        id: 'wpai-language',
                        label: 'Dil',
                        value: state.behavior.language || 'auto',
                        options: [
                            { value: 'auto', label: 'Otomatik' },
                            { value: 'tr', label: 'Turkce' },
                            { value: 'en', label: 'Ingilizce' }
                        ],
                        onChange: function (value) {
                            state.behavior.language = value;
                        }
                    }));
                    break;
                case 'logging':
                    card.appendChild(renderSectionIntro('Kayit & Izleme', 'Destek ekibi icin sohbet kayitlarini tutun.'));
                    card.appendChild(renderCheckboxField({
                        id: 'wpai-logging-enabled',
                        label: 'Konusmalari kaydet',
                        checked: !!state.logging.enabled,
                        onChange: function (checked) {
                            state.logging.enabled = checked;
                            logsState.loggingEnabled = checked;

                            if (checked) {
                                logsState.initialized = false;
                                loadLogs(1, { silent: true });
                            } else {
                                render({ preserveFocus: false });
                            }
                        }
                    }));
                    card.appendChild(renderNumberField({
                        id: 'wpai-logging-retention',
                        label: 'Kayit saklama suresi (gun)',
                        min: 1,
                        value: typeof state.logging.retention_days === 'number' ? state.logging.retention_days : 30,
                        onChange: function (value) {
                            var parsed = parseInt(value, 10);
                            var nextValue = Number.isNaN(parsed) ? 30 : Math.max(1, parsed);
                            state.logging.retention_days = nextValue;
                            logsState.retentionDays = nextValue;
                            render({ preserveFocus: false });
                        }
                    }));
                    card.appendChild(renderLogsSection());
                    break;
            }

            return card;
        }

        function renderLogsSection() {
            const section = document.createElement('div');
            section.className = 'wpai-logs';

            const status = document.createElement('p');
            status.className = 'wpai-logs__status';
            if (logsState.loggingEnabled) {
                const days = logsState.retentionDays > 0 ? logsState.retentionDays : 30;
                status.textContent = 'Konusmalar kaydediliyor. Kayitlar ' + days + ' gun saklanir.';
            } else {
                status.textContent = 'Kayit ozelligi kapali. Kayit almak icin ustteki secenegi etkinlestirin.';
            }
            section.appendChild(status);

            if (logsState.isLoading && logsState.initialized) {
                const refreshNotice = document.createElement('p');
                refreshNotice.className = 'wpai-logs__loading';
                refreshNotice.textContent = 'Kayitlar yenileniyor...';
                section.appendChild(refreshNotice);
            }

            if (logsState.error) {
                const errorBox = document.createElement('div');
                errorBox.className = 'notice notice-error';
                errorBox.textContent = logsState.error;
                section.appendChild(errorBox);
                return section;
            }

            if (logsState.isLoading && !logsState.initialized) {
                const loading = document.createElement('p');
                loading.className = 'wpai-logs__empty';
                loading.textContent = 'Kayitlar yukleniyor...';
                section.appendChild(loading);
                return section;
            }

            if (!logsState.items.length) {
                const empty = document.createElement('p');
                empty.className = 'wpai-logs__empty';
                empty.textContent = logsState.loggingEnabled ? 'Henuz kayit bulunmuyor.' : 'Kayit ozelligi pasif oldugu icin veri tutulmuyor.';
                section.appendChild(empty);
                return section;
            }

            section.appendChild(renderLogsList());

            // Pagination sadece oturum listesinde göster
            if (!logsState.selectedSession && logsState.totalPages > 1) {
                section.appendChild(renderLogsPagination());
            }

            return section;
        }

        function renderLogsList() {
            const list = document.createElement('div');
            list.className = 'wpai-logs__list';

            // Oturum detayı modu
            if (logsState.selectedSession) {
                // Geri butonu
                const backButton = document.createElement('button');
                backButton.type = 'button';
                backButton.className = 'button';
                backButton.textContent = '← Oturumlara Geri Don';
                backButton.onclick = backToSessions;
                backButton.style.marginBottom = '16px';
                list.appendChild(backButton);

                const sessionTitle = document.createElement('h3');
                sessionTitle.style.marginBottom = '16px';
                sessionTitle.style.color = '#4338CA';
                sessionTitle.textContent = 'Oturum: ' + logsState.selectedSession;
                list.appendChild(sessionTitle);

                // Mesajları göster
                logsState.items.forEach(function (item) {
                    const entry = document.createElement('article');
                    entry.className = 'wpai-logs__item';
                    entry.style.marginBottom = '12px';

                    const timestamp = document.createElement('div');
                    timestamp.className = 'wpai-logs__item-timestamp';
                    timestamp.textContent = formatDatetime(item.created_at_iso || item.created_at_local);
                    entry.appendChild(timestamp);

                    const body = document.createElement('div');
                    body.className = 'wpai-logs__item-body';

                    const userBlock = document.createElement('div');
                    userBlock.className = 'wpai-logs__message wpai-logs__message--user';
                    const userLabel = document.createElement('strong');
                    userLabel.textContent = 'Kullanici';
                    userBlock.appendChild(userLabel);
                    const userText = document.createElement('p');
                    userText.textContent = item.user_message || '(bos mesaj)';
                    userBlock.appendChild(userText);
                    body.appendChild(userBlock);

                    const assistantBlock = document.createElement('div');
                    assistantBlock.className = 'wpai-logs__message wpai-logs__message--assistant';
                    const assistantLabel = document.createElement('strong');
                    assistantLabel.textContent = 'Asistan';
                    assistantBlock.appendChild(assistantLabel);
                    const assistantText = document.createElement('p');
                    assistantText.textContent = item.assistant_message || '(yanit yok)';
                    assistantBlock.appendChild(assistantText);
                    body.appendChild(assistantBlock);

                    if (item.usage && (item.usage.prompt_tokens || item.usage.completion_tokens || item.usage.total_tokens)) {
                        const usage = document.createElement('p');
                        usage.className = 'wpai-logs__usage';
                        const pieces = [];
                        if (item.usage.prompt_tokens) {
                            pieces.push('Prompt: ' + item.usage.prompt_tokens);
                        }
                        if (item.usage.completion_tokens) {
                            pieces.push('Cevap: ' + item.usage.completion_tokens);
                        }
                        if (item.usage.total_tokens) {
                            pieces.push('Toplam: ' + item.usage.total_tokens);
                        }
                        usage.textContent = pieces.join(' - ');
                        body.appendChild(usage);
                    }

                    entry.appendChild(body);
                    list.appendChild(entry);
                });
            }
            // Oturum listesi modu
            else {
                logsState.items.forEach(function (session) {
                    const sessionCard = document.createElement('div');
                    sessionCard.className = 'wpai-logs__session-card';
                    sessionCard.onclick = function () {
                        viewSession(session.session_id);
                    };

                    const header = document.createElement('div');
                    header.className = 'wpai-logs__session-card-header';

                    const title = document.createElement('h3');
                    title.className = 'wpai-logs__session-card-title';
                    title.textContent = 'Oturum: ' + (session.session_id || 'Bilinmeyen');
                    header.appendChild(title);

                    const badge = document.createElement('span');
                    badge.className = 'wpai-logs__session-badge';
                    badge.textContent = session.message_count + ' mesaj';
                    header.appendChild(badge);

                    sessionCard.appendChild(header);

                    const meta = document.createElement('div');
                    meta.className = 'wpai-logs__session-card-meta';
                    const providerLabel = session.provider || 'Bilinmeyen';
                    const lastDate = formatDatetime(session.last_message);
                    meta.textContent = providerLabel + ' • Son mesaj: ' + lastDate;
                    sessionCard.appendChild(meta);

                    list.appendChild(sessionCard);
                });
            }

            return list;
        }

        function renderLogsPagination() {
            const nav = document.createElement('div');
            nav.className = 'wpai-logs__pagination';

            const info = document.createElement('span');
            info.className = 'wpai-logs__pagination-info';
            const totalPages = Math.max(1, logsState.totalPages || 0);
            info.textContent = 'Sayfa ' + logsState.page + ' / ' + totalPages;
            nav.appendChild(info);

            const actions = document.createElement('div');
            actions.className = 'wpai-logs__pagination-buttons';

            const prev = document.createElement('button');
            prev.type = 'button';
            prev.className = 'button';
            prev.textContent = 'Onceki';
            prev.disabled = logsState.page <= 1 || logsState.isLoading;
            prev.addEventListener('click', function () {
                if (logsState.page > 1 && !logsState.isLoading) {
                    loadLogs(logsState.page - 1);
                }
            });
            actions.appendChild(prev);

            const next = document.createElement('button');
            next.type = 'button';
            next.className = 'button';
            next.textContent = 'Sonraki';
            next.disabled = logsState.page >= totalPages || logsState.isLoading;
            next.addEventListener('click', function () {
                if (logsState.page < totalPages && !logsState.isLoading) {
                    loadLogs(logsState.page + 1);
                }
            });
            actions.appendChild(next);

            nav.appendChild(actions);

            return nav;
        }

        function formatDatetime(value) {
            if (!value) {
                return '';
            }

            try {
                const date = new Date(value);
                if (!Number.isNaN(date.getTime())) {
                    return date.toLocaleString();
                }
            } catch (error) {}

            return value;
        }
        function renderSectionIntro(title, description) {
            const header = document.createElement('div');
            header.className = 'wpai-card__header';

            const heading = document.createElement('h2');
            heading.textContent = title;
            header.appendChild(heading);

            if (description) {
                const paragraph = document.createElement('p');
                paragraph.textContent = description;
                header.appendChild(paragraph);
            }

            return header;
        }

        function renderFieldGrid(items) {
            const grid = document.createElement('div');
            grid.className = 'wpai-field-grid';
            items.forEach(function (item) {
                grid.appendChild(item);
            });
            return grid;
        }

        function renderProviderFields() {
            const wrapper = document.createElement('div');
            wrapper.className = 'wpai-provider-fields';

            const active = state.provider.active;
            const providerConfig = state.provider.providers[active] || {};
            const models = modelsCache[active] || [];
            const loading = !!modelsLoading[active];

            switch (active) {
                case 'openai':
                    wrapper.appendChild(renderSecretField('API Key', 'wpai-openai-key', providerConfig.api_key, function (value) {
                        state.provider.providers.openai.api_key = value.trim();
                    }));
                    wrapper.appendChild(renderModelPicker('openai', providerConfig, models));
                    wrapper.appendChild(renderTextField({
                        id: 'wpai-openai-base',
                        label: 'Base URL',
                        value: providerConfig.base_url || 'https://api.openai.com/v1',
                        onChange: function (value) {
                            state.provider.providers.openai.base_url = value.trim();
                        }
                    }));
                    wrapper.appendChild(renderTextField({
                        id: 'wpai-openai-org',
                        label: 'Organization ID (opsiyonel)',
                        value: providerConfig.organization || '',
                        onChange: function (value) {
                            state.provider.providers.openai.organization = value.trim();
                        }
                    }));
                    break;
                case 'gemini':
                    wrapper.appendChild(renderSecretField('API Key', 'wpai-gemini-key', providerConfig.api_key, function (value) {
                        state.provider.providers.gemini.api_key = value.trim();
                    }));
                    wrapper.appendChild(renderModelPicker('gemini', providerConfig, models));
                    wrapper.appendChild(renderTextField({
                        id: 'wpai-gemini-endpoint',
                        label: 'Endpoint',
                        value: providerConfig.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models',
                        onChange: function (value) {
                            state.provider.providers.gemini.endpoint = value.trim();
                        }
                    }));
                    break;
                case 'groq':
                    wrapper.appendChild(renderSecretField('API Key', 'wpai-groq-key', providerConfig.api_key, function (value) {
                        state.provider.providers.groq.api_key = value.trim();
                    }));
                    wrapper.appendChild(renderModelPicker('groq', providerConfig, models));
                    wrapper.appendChild(renderTextField({
                        id: 'wpai-groq-base',
                        label: 'Base URL',
                        value: providerConfig.base_url || 'https://api.groq.com/openai/v1',
                        onChange: function (value) {
                            state.provider.providers.groq.base_url = value.trim();
                        }
                    }));
                    break;
                case 'openrouter':
                    wrapper.appendChild(renderSecretField('API Key', 'wpai-openrouter-key', providerConfig.api_key, function (value) {
                        state.provider.providers.openrouter.api_key = value.trim();
                    }));
                    wrapper.appendChild(renderModelPicker('openrouter', providerConfig, models));
                    wrapper.appendChild(renderTextField({
                        id: 'wpai-openrouter-base',
                        label: 'Base URL',
                        value: providerConfig.base_url || 'https://openrouter.ai/api/v1',
                        onChange: function (value) {
                            state.provider.providers.openrouter.base_url = value.trim();
                        }
                    }));
                    wrapper.appendChild(renderTextField({
                        id: 'wpai-openrouter-fallback',
                        label: 'Fallback model (opsiyonel)',
                        value: providerConfig.fallback_model || '',
                        onChange: function (value) {
                            state.provider.providers.openrouter.fallback_model = value.trim();
                        }
                    }));
                    break;
            }

            const refreshRow = document.createElement('div');
            refreshRow.className = 'wpai-provider-actions';

            const refreshButton = document.createElement('button');
            refreshButton.type = 'button';
            refreshButton.className = 'button';
            refreshButton.textContent = loading ? 'Modeller yukleniyor...' : 'Modelleri yenile';
            refreshButton.disabled = loading || !config.modelsPath;
            refreshButton.addEventListener('click', function () {
                loadModels(active);
            });
            refreshRow.appendChild(refreshButton);
            wrapper.appendChild(refreshRow);

            if (loading) {
                const loadingHint = document.createElement('div');
                loadingHint.className = 'wpai-provider-loading';
                loadingHint.textContent = 'Modeller yukleniyor...';
                wrapper.appendChild(loadingHint);
            } else if (!loading && (!models || !models.length)) {
                const emptyHint = document.createElement('div');
                emptyHint.className = 'wpai-provider-loading';
                emptyHint.textContent = config.modelsPath ? 'Modeller bulunamadi, el ile model giriniz.' : 'Model listesi endpointi tanimlanamadi.';
                wrapper.appendChild(emptyHint);
            }

            return wrapper;
        }

        function renderModelPicker(providerSlug, providerConfig, models) {
            const wrapper = document.createElement('div');
            wrapper.className = 'wpai-field-group';

            if (Array.isArray(models) && models.length) {
                wrapper.appendChild(renderSelectField({
                    id: 'wpai-' + providerSlug + '-model-select',
                    label: 'Model sec (listeden)',
                    value: providerConfig.model || '',
                    options: models.map(function (item) {
                        return {
                            value: item.id,
                            label: item.name || item.id
                        };
                    }),
                    placeholder: 'Model sec',
                    onChange: function (value) {
                        state.provider.providers[providerSlug].model = value;
                    }
                }));
            }

            wrapper.appendChild(renderTextField({
                id: 'wpai-' + providerSlug + '-model',
                label: 'Model (manuel)',
                value: providerConfig.model || '',
                onChange: function (value) {
                    state.provider.providers[providerSlug].model = value.trim();
                }
            }));

            return wrapper;
        }
        function renderFooter() {
            const footer = document.createElement('div');
            footer.className = 'wpai-admin-footer';

            const actions = document.createElement('div');
            actions.className = 'wpai-admin-footer__actions';

            const saveButton = document.createElement('button');
            saveButton.type = 'submit';
            saveButton.className = 'button button-primary';
            saveButton.textContent = isSaving ? 'Kaydediliyor...' : 'Ayarlarini Kaydet';
            saveButton.disabled = isSaving;
            actions.appendChild(saveButton);

            const hint = document.createElement('span');
            hint.className = 'wpai-admin-footer__hint';
            hint.textContent = 'Degisikliklerin aktif olmasi icin kaydedin.';
            actions.appendChild(hint);

            footer.appendChild(actions);

            if (notice) {
                const noticeEl = document.createElement('div');
                noticeEl.className = 'wpai-notice wpai-notice--' + notice.type;
                noticeEl.textContent = notice.message;
                footer.appendChild(noticeEl);
            }

            return footer;
        }

        function handleSubmit(event) {
            if (event) {
                event.preventDefault();
            }

            if (isSaving) {
                return;
            }

            isSaving = true;
            notice = { type: 'info', message: 'Kaydediliyor...' };
            render({ preserveFocus: false });

            apiFetch({
                path: config.apiPath,
                method: 'POST',
                data: state
            })
                .then(function (response) {
                    state = JSON.parse(JSON.stringify(response || {}));
                    ensureStateShape();
                    notice = { type: 'success', message: 'Ayarlar basariyla kaydedildi.' };
                })
                .catch(function (error) {
                    notice = { type: 'error', message: error && error.message ? error.message : 'Beklenmeyen bir hata olustu.' };
                })
                .finally(function () {
                    isSaving = false;
                    render({ preserveFocus: false });
                });
        }

        function renderCheckboxField(opts) {
            const field = document.createElement('div');
            field.className = 'wpai-field';

            const label = document.createElement('label');
            label.className = 'wpai-toggle';
            label.htmlFor = opts.id;

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = opts.id;
            input.checked = !!opts.checked;
            input.addEventListener('change', function (event) {
                opts.onChange(event.target.checked);
            });

            const span = document.createElement('span');
            span.textContent = opts.label;

            label.appendChild(input);
            label.appendChild(span);
            field.appendChild(label);

            return field;
        }

        function renderTextField(opts) {
            const field = document.createElement('div');
            field.className = 'wpai-field';

            const label = document.createElement('label');
            label.htmlFor = opts.id;
            label.textContent = opts.label;

            const input = document.createElement('input');
            input.type = opts.type || 'text';
            input.id = opts.id;
            input.value = opts.value || '';
            input.autocomplete = opts.autocomplete || 'off';
            if (typeof opts.placeholder === 'string') {
                input.placeholder = opts.placeholder;
            }
            input.addEventListener('input', function (event) {
                opts.onChange(event.target.value);
            });

            field.appendChild(label);
            field.appendChild(input);

            return field;
        }

        function renderSecretField(label, id, value, onChange) {
            return renderTextField({
                id: id,
                label: label,
                type: 'password',
                autocomplete: 'new-password',
                value: value || '',
                onChange: onChange
            });
        }

        function renderNumberField(opts) {
            const field = document.createElement('div');
            field.className = 'wpai-field';

            const label = document.createElement('label');
            label.htmlFor = opts.id;
            label.textContent = opts.label;

            const input = document.createElement('input');
            input.type = 'number';
            input.id = opts.id;
            if (typeof opts.min !== 'undefined') {
                input.min = opts.min;
            }
            if (typeof opts.max !== 'undefined') {
                input.max = opts.max;
            }
            if (typeof opts.step !== 'undefined') {
                input.step = opts.step;
            }
            if (typeof opts.placeholder === 'string') {
                input.placeholder = opts.placeholder;
            }
            input.value = typeof opts.value === 'number' ? opts.value : '';
            input.addEventListener('input', function (event) {
                const result = event.target.value === '' ? '' : Number(event.target.value);
                opts.onChange(result);
            });

            field.appendChild(label);
            field.appendChild(input);

            return field;
        }

        function renderTextareaField(opts) {
            const field = document.createElement('div');
            field.className = 'wpai-field';

            const label = document.createElement('label');
            label.htmlFor = opts.id;
            label.textContent = opts.label;

            const textarea = document.createElement('textarea');
            textarea.id = opts.id;
            textarea.rows = opts.rows || 4;
            textarea.value = opts.value || '';
            if (typeof opts.placeholder === 'string') {
                textarea.placeholder = opts.placeholder;
            }
            if (opts.readonly) {
                textarea.readOnly = true;
                textarea.style.backgroundColor = '#f5f5f5';
                textarea.style.cursor = 'not-allowed';
            }
            textarea.addEventListener('input', function (event) {
                opts.onChange(event.target.value);
            });

            field.appendChild(label);
            field.appendChild(textarea);

            return field;
        }

        function renderPersonaPresetCards() {
            const container = document.createElement('div');
            container.className = 'wpai-field';

            const label = document.createElement('label');
            label.textContent = 'Hazir Persona Sablonlari';
            label.style.marginBottom = '12px';
            label.style.display = 'block';

            const hint = document.createElement('p');
            hint.style.margin = '4px 0 12px 0';
            hint.style.fontSize = '12px';
            hint.style.color = '#64748b';
            hint.textContent = 'Bir sablon sec, sistem promptu ve selamlama otomatik dolacak. Sonra {{placeholder}} kisimlarini kendin duzenle.';

            const grid = document.createElement('div');
            grid.className = 'wpai-persona-preset-grid';

            personaPresets.forEach(function (preset) {
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'wpai-persona-preset-card';

                const icon = document.createElement('div');
                icon.className = 'wpai-persona-preset-icon';
                icon.textContent = preset.icon;

                const title = document.createElement('div');
                title.className = 'wpai-persona-preset-title';
                title.textContent = preset.label;

                const desc = document.createElement('div');
                desc.className = 'wpai-persona-preset-description';
                desc.textContent = preset.description;

                card.appendChild(icon);
                card.appendChild(title);
                card.appendChild(desc);

                card.addEventListener('click', function () {
                    const systemPromptField = document.getElementById('wpai-system-prompt');
                    const greetingField = document.getElementById('wpai-greeting');
                    
                    if (preset.id === 'custom') {
                        state.persona.system_prompt = '';
                        state.persona.greeting_message = '';
                        if (systemPromptField) systemPromptField.value = '';
                        if (greetingField) greetingField.value = '';
                    } else {
                        if (preset.systemPrompt) {
                            state.persona.system_prompt = preset.systemPrompt;
                            if (systemPromptField) systemPromptField.value = preset.systemPrompt;
                        }
                        if (preset.greeting) {
                            state.persona.greeting_message = preset.greeting;
                            if (greetingField) greetingField.value = preset.greeting;
                        }
                    }
                    
                    // Gorsel feedback
                    document.querySelectorAll('.wpai-persona-preset-card').forEach(function(c) {
                        c.classList.remove('is-selected');
                    });
                    card.classList.add('is-selected');
                });

                grid.appendChild(card);
            });

            container.appendChild(label);
            container.appendChild(hint);
            container.appendChild(grid);

            return container;
        }

        function renderThemePicker() {
            const field = document.createElement('div');
            field.className = 'wpai-field wpai-theme-picker';

            const label = document.createElement('label');
            label.htmlFor = 'wpai-theme-select';
            label.textContent = 'Tema';
            field.appendChild(label);

            const select = document.createElement('select');
            select.id = 'wpai-theme-select';
            select.className = 'wpai-theme-picker__select';

            themeOptions.forEach(function (option) {
                const optionEl = document.createElement('option');
                optionEl.value = option.value;
                optionEl.textContent = option.label;
                if (option.value === state.appearance.theme) {
                    optionEl.selected = true;
                }
                select.appendChild(optionEl);
            });

            select.addEventListener('change', function (event) {
                const value = event.target.value;
                const fallback = themeOptions[0] ? themeOptions[0].value : 'classic';
                const nextTheme = themeMap[value] ? value : fallback;

                state.appearance.theme = nextTheme;
                const paletteSource = themeMap[nextTheme] ? themeMap[nextTheme].colors : themeMap[fallback].colors;
                state.appearance.colors = Object.assign({}, paletteSource);

                render({ preserveFocus: false });
            });

            field.appendChild(select);

            const preview = document.createElement('div');
            preview.className = 'wpai-theme-preview';
            const selectedTheme = themeMap[state.appearance.theme] || themeOptions[0];

            const previewHeader = document.createElement('div');
            previewHeader.className = 'wpai-theme-preview__header';
            const title = document.createElement('span');
            title.className = 'wpai-theme-preview__title';
            title.textContent = selectedTheme ? selectedTheme.label : '';
            previewHeader.appendChild(title);

            if (selectedTheme && selectedTheme.description) {
                const desc = document.createElement('span');
                desc.className = 'wpai-theme-preview__description';
                desc.textContent = selectedTheme.description;
                previewHeader.appendChild(desc);
            }

            preview.appendChild(previewHeader);

            const swatches = document.createElement('div');
            swatches.className = 'wpai-theme-preview__swatches';

            const labelMap = { primary: 'Birincil', secondary: 'Ikincil', accent: 'Vurgu' };
            ['primary', 'secondary', 'accent'].forEach(function (key) {
                const swatch = document.createElement('div');
                swatch.className = 'wpai-theme-preview__swatch';

                const colorEl = document.createElement('span');
                colorEl.className = 'wpai-theme-preview__swatch-color';
                colorEl.style.backgroundColor = selectedTheme ? selectedTheme.colors[key] : '#ffffff';
                swatch.appendChild(colorEl);

                const nameEl = document.createElement('span');
                nameEl.className = 'wpai-theme-preview__swatch-name';
                nameEl.textContent = labelMap[key] || key;
                swatch.appendChild(nameEl);

                swatches.appendChild(swatch);
            });

            preview.appendChild(swatches);
            field.appendChild(preview);

            return field;
        }
        function renderSelectField(opts) {
            const field = document.createElement('div');
            field.className = 'wpai-field';

            const label = document.createElement('label');
            label.htmlFor = opts.id;
            label.textContent = opts.label;

            const select = document.createElement('select');
            select.id = opts.id;

            if (opts.placeholder) {
                const placeholder = document.createElement('option');
                placeholder.value = '';
                placeholder.textContent = opts.placeholder;
                placeholder.disabled = true;
                placeholder.selected = !opts.value;
                select.appendChild(placeholder);
            }

            opts.options.forEach(function (option) {
                const optionEl = document.createElement('option');
                optionEl.value = option.value;
                optionEl.textContent = option.label;
                if (option.value === opts.value) {
                    optionEl.selected = true;
                }
                select.appendChild(optionEl);
            });

            select.addEventListener('change', function (event) {
                opts.onChange(event.target.value);
            });

            field.appendChild(label);
            field.appendChild(select);
            return field;
        }

        function isObject(value) {
            return value && typeof value === 'object';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
})(window.wp || {});











