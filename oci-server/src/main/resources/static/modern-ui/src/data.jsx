// Region catalog + field-accessor helpers (no business mock fixtures)

// Regions — strictly aligned with Oracle Cloud official commercial realm list
// Source: https://docs.oracle.com/en-us/iaas/Content/General/Concepts/regions.htm
const REGIONS = [
  // ── Asia Pacific ─────────────────────────────────────────
  { code: 'ap-tokyo-1',       cn: '日本东部(东京)',       en: 'Tokyo, Japan',                flag: '🇯🇵', continent: 'asia',     released: true, firstAt: '2026-08-23 16:11:07', totalGrabs: 57,  todayGrabs: 32, lastAt: '2026-08-30 16:02:11', hot: true, name: '亚太-日本东部东京', simpleName: '东京', endpoint: 'https://objectstorage.ap-tokyo-1.oraclecloud.com', flagCode: 'jp', arch: 'ARM', },
  { code: 'ap-osaka-1',       cn: '日本中部(大阪)',       en: 'Osaka, Japan',                flag: '🇯🇵', continent: 'asia',     released: true, firstAt: '2026-05-15 14:22:11', totalGrabs: 84,  todayGrabs: 1,  lastAt: '2026-05-19 08:12:44', hot: false, name: '亚太-日本中部大阪', simpleName: '大阪', endpoint: 'https://objectstorage.ap-osaka-1.oraclecloud.com', flagCode: 'jp', arch: 'ARM', },
  { code: 'ap-chuncheon-1',   cn: '韩国北部(春川)',       en: 'Chuncheon, South Korea',      flag: '🇰🇷', continent: 'asia',     released: true, firstAt: '2026-08-27 08:57:53', totalGrabs: 122, todayGrabs: 2,  lastAt: '2026-06-15 23:35:09', hot: true, name: '亚太-韩国北部春川', simpleName: '春川', endpoint: 'https://objectstorage.ap-chuncheon-1.oraclecloud.com', flagCode: 'kr', arch: 'ARM', },
  { code: 'ap-seoul-1',       cn: '韩国中部(首尔)',       en: 'Seoul, South Korea',          flag: '🇰🇷', continent: 'asia',     released: true, firstAt: '2026-06-29 11:40:22', totalGrabs: 38,  todayGrabs: 0,  lastAt: '2026-05-21 20:37:31', hot: false, name: '亚太-韩国中部首尔', simpleName: '首尔', endpoint: 'https://objectstorage.ap-seoul-1.oraclecloud.com', flagCode: 'kr', arch: 'ARM', },
  { code: 'ap-singapore-1',   cn: '新加坡',               en: 'Singapore',                    flag: '🇸🇬', continent: 'asia',     released: true, firstAt: '2026-08-15 09:22:41', totalGrabs: 88,  todayGrabs: 2,  lastAt: '2026-08-29 22:14:33', hot: true, name: '亚太-新加坡', simpleName: '新加坡', endpoint: 'https://objectstorage.ap-singapore-1.oraclecloud.com', flagCode: 'sg', arch: 'ARM', },
  { code: 'ap-singapore-2',   cn: '新加坡西',              en: 'Singapore West',               flag: '🇸🇬', continent: 'asia',     released: true, firstAt: '2026-08-27 16:12:21', totalGrabs: 197, todayGrabs: 5,  lastAt: '2026-05-29 21:03:09', hot: true, name: '亚太-新加坡西', simpleName: '新加坡西', endpoint: 'https://objectstorage.ap-singapore-2.oraclecloud.com', flagCode: 'sg', arch: 'ARM', },
  { code: 'ap-kulai-2',       cn: '马来西亚西2(古来)',    en: 'Kulai, Malaysia',             flag: '🇲🇾', continent: 'asia',     released: true, firstAt: '2026-07-14 10:05:16', totalGrabs: 16,  todayGrabs: 0,  lastAt: '2026-05-22 09:25:37', hot: false, name: '亚太-马来西亚古来', simpleName: '古来', endpoint: 'https://objectstorage.ap-kulai-2.oraclecloud.com', flagCode: 'my', arch: 'ARM', },
  { code: 'ap-batam-1',       cn: '印度尼西亚北部(巴淡)',  en: 'Batam, Indonesia',            flag: '🇮🇩', continent: 'asia',     released: true, firstAt: '2026-07-20 11:33:22', totalGrabs: 4,   todayGrabs: 0,  lastAt: '2026-07-20 11:33:22', hot: false, name: '亚太-印度尼西亚巴淡', simpleName: '巴淡', endpoint: 'https://objectstorage.ap-batam-1.oraclecloud.com', flagCode: 'id', arch: 'ARM', },
  { code: 'ap-mumbai-1',      cn: '印度西部(孟买)',       en: 'Mumbai, India',               flag: '🇮🇳', continent: 'asia',     released: true, firstAt: '2026-06-30 16:33:22', totalGrabs: 42,  todayGrabs: 0,  lastAt: '2026-07-22 12:41:19', hot: false, name: '亚太-印度西部孟买', simpleName: '孟买', endpoint: 'https://objectstorage.ap-mumbai-1.oraclecloud.com', flagCode: 'in', arch: 'ARM', },
  { code: 'ap-hyderabad-1',   cn: '印度南部(海得拉巴)',   en: 'Hyderabad, India',            flag: '🇮🇳', continent: 'asia',     released: true, firstAt: '2026-07-05 20:14:41', totalGrabs: 18,  todayGrabs: 0,  lastAt: '2026-07-05 20:14:41', hot: false, name: '亚太-印度南部海得拉巴', simpleName: '海得拉巴', endpoint: 'https://objectstorage.ap-hyderabad-1.oraclecloud.com', flagCode: 'in', arch: 'ARM', },
  { code: 'ap-melbourne-1',   cn: '澳大利亚东南部(墨尔本)', en: 'Melbourne, Australia',      flag: '🇦🇺', continent: 'asia',     released: true, firstAt: '2026-05-20 22:31:14', totalGrabs: 11,  todayGrabs: 0,  lastAt: '2026-05-20 22:31:14', hot: false, name: '亚太-澳大利亚东南部墨尔本', simpleName: '墨尔本', endpoint: 'https://objectstorage.ap-melbourne-1.oraclecloud.com', flagCode: 'au', arch: 'ARM', },
  { code: 'ap-sydney-1',      cn: '澳大利亚东部(悉尼)',   en: 'Sydney, Australia',           flag: '🇦🇺', continent: 'asia',     released: true, firstAt: '2026-05-24 04:12:32', totalGrabs: 22,  todayGrabs: 0,  lastAt: '2026-05-24 04:12:32', hot: false, name: '亚太-澳大利亚东部悉尼', simpleName: '悉尼', endpoint: 'https://objectstorage.ap-sydney-1.oraclecloud.com', flagCode: 'au', arch: 'ARM', },

  // ── Europe ───────────────────────────────────────────────
  { code: 'eu-frankfurt-1',   cn: '德国中部(法兰克福)',   en: 'Frankfurt, Germany',          flag: '🇩🇪', continent: 'europe',   released: true, firstAt: '2026-05-08 21:14:22', totalGrabs: 63,  todayGrabs: 3,  lastAt: '2026-08-28 15:08:11', hot: false, name: '欧洲-德国中部法兰克福', simpleName: '法兰克福', endpoint: 'https://objectstorage.eu-frankfurt-1.oraclecloud.com', flagCode: 'de', arch: 'ARM', },
  { code: 'uk-london-1',      cn: '英国南部(伦敦)',       en: 'London, United Kingdom',      flag: '🇬🇧', continent: 'europe',   released: true, firstAt: '2026-07-06 04:25:40', totalGrabs: 57,  todayGrabs: 0,  lastAt: '2026-05-22 10:39:34', hot: false, name: '欧洲-英国南部伦敦', simpleName: '伦敦', endpoint: 'https://objectstorage.uk-london-1.oraclecloud.com', flagCode: 'gb', arch: 'ARM', },
  { code: 'uk-cardiff-1',     cn: '英国西部(纽波特)',     en: 'Newport, United Kingdom',     flag: '🇬🇧', continent: 'europe',   released: true, firstAt: '2026-06-05 11:12:14', totalGrabs: 2,   todayGrabs: 0,  lastAt: '2026-06-05 11:12:14', hot: false, name: '欧洲-英国西部加的夫', simpleName: '纽波特', endpoint: 'https://objectstorage.uk-cardiff-1.oraclecloud.com', flagCode: 'gb', arch: 'ARM', },
  { code: 'eu-amsterdam-1',   cn: '荷兰西北部(阿姆斯特丹)', en: 'Amsterdam, Netherlands',    flag: '🇳🇱', continent: 'europe',   released: true, firstAt: '2026-05-12 14:22:33', totalGrabs: 24,  todayGrabs: 0,  lastAt: '2026-06-11 09:04:15', hot: false, name: '欧洲-荷兰西北部阿姆斯特丹', simpleName: '阿姆斯特丹', endpoint: 'https://objectstorage.eu-amsterdam-1.oraclecloud.com', flagCode: 'nl', arch: 'ARM', },
  { code: 'eu-paris-1',       cn: '法国中部(巴黎)',       en: 'Paris, France',               flag: '🇫🇷', continent: 'europe',   released: true, firstAt: '2026-06-18 20:22:11', totalGrabs: 15,  todayGrabs: 0,  lastAt: '2026-06-18 20:22:11', hot: false, name: '欧洲-法国中部巴黎', simpleName: '巴黎', endpoint: 'https://objectstorage.eu-paris-1.oraclecloud.com', flagCode: 'fr', arch: 'ARM', },
  { code: 'eu-marseille-1',   cn: '法国南部(马赛)',       en: 'Marseille, France',           flag: '🇫🇷', continent: 'europe',   released: true, firstAt: '2026-06-14 09:11:52', totalGrabs: 7,   todayGrabs: 0,  lastAt: '2026-06-14 09:11:52', hot: false, name: '欧洲-法国南部马赛', simpleName: '马赛', endpoint: 'https://objectstorage.eu-marseille-1.oraclecloud.com', flagCode: 'fr', arch: 'ARM', },
  { code: 'eu-milan-1',       cn: '意大利西北部(米兰)',    en: 'Milan, Italy',                flag: '🇮🇹', continent: 'europe',   released: true, firstAt: '2026-07-01 16:01:07', totalGrabs: 9,   todayGrabs: 0,  lastAt: '2026-06-30 04:43:48', hot: false, name: '欧洲-意大利西北部米兰', simpleName: '米兰', endpoint: 'https://objectstorage.eu-milan-1.oraclecloud.com', flagCode: 'it', arch: 'ARM', },
  { code: 'eu-turin-1',       cn: '意大利北部(都灵)',     en: 'Turin, Italy',                flag: '🇮🇹', continent: 'europe',   released: true, firstAt: '2026-07-11 12:22:14', totalGrabs: 3,   todayGrabs: 0,  lastAt: '2026-07-11 12:22:14', hot: false, name: '欧洲-意大利西北部都灵', simpleName: '都灵', endpoint: 'https://objectstorage.eu-turin-1.oraclecloud.com', flagCode: 'it', arch: 'ARM', },
  { code: 'eu-madrid-1',      cn: '西班牙中部(马德里)',   en: 'Madrid, Spain',               flag: '🇪🇸', continent: 'europe',   released: true, firstAt: '2026-06-16 13:41:29', totalGrabs: 3,   todayGrabs: 0,  lastAt: '2026-06-16 13:41:29', hot: false, name: '欧洲-西班牙中部马德里-1', simpleName: '马德里', endpoint: 'https://objectstorage.eu-madrid-1.oraclecloud.com', flagCode: 'es', arch: 'ARM', },
  { code: 'eu-madrid-3',      cn: '西班牙中部(马德里 3)', en: 'Madrid 3, Spain',             flag: '🇪🇸', continent: 'europe',   released: true, firstAt: '2026-08-01 09:12:41', totalGrabs: 1,   todayGrabs: 0,  lastAt: '2026-08-01 09:12:41', hot: false, name: '欧洲-西班牙中部马德里-3', simpleName: '马德里 3', endpoint: 'https://objectstorage.eu-madrid-3.oraclecloud.com', flagCode: 'es', arch: 'ARM', },
  { code: 'eu-zurich-1',      cn: '瑞士北部(苏黎世)',     en: 'Zurich, Switzerland',         flag: '🇨🇭', continent: 'europe',   released: true, firstAt: '2026-06-19 07:15:44', totalGrabs: 6,   todayGrabs: 0,  lastAt: '2026-06-19 07:15:44', hot: false, name: '欧洲-瑞士北部苏黎世', simpleName: '苏黎世', endpoint: 'https://objectstorage.eu-zurich-1.oraclecloud.com', flagCode: 'ch', arch: 'ARM', },
  { code: 'eu-stockholm-1',   cn: '瑞典中部(斯德哥尔摩)', en: 'Stockholm, Sweden',           flag: '🇸🇪', continent: 'europe',   released: true, firstAt: '2026-06-13 11:22:14', totalGrabs: 4,   todayGrabs: 0,  lastAt: '2026-06-13 11:22:14', hot: false, name: '欧洲-瑞典中部斯德哥尔摩', simpleName: '斯德哥尔摩', endpoint: 'https://objectstorage.eu-stockholm-1.oraclecloud.com', flagCode: 'se', arch: 'ARM', },
  { code: 'eu-jovanovac-1',   cn: '塞尔维亚中部(约万诺瓦茨)', en: 'Jovanovac, Serbia',      flag: '🇷🇸', continent: 'europe',   released: true, firstAt: '2026-08-05 15:22:14', totalGrabs: 1,   todayGrabs: 0,  lastAt: '2026-08-05 15:22:14', hot: false, name: '欧洲-塞尔维亚中部乔万诺瓦茨', simpleName: '约万诺瓦茨', endpoint: 'https://objectstorage.eu-jovanovac-1.oraclecloud.com', flagCode: 'rs', arch: 'ARM', },
  { code: 'il-jerusalem-1',   cn: '以色列中部(耶路撒冷)', en: 'Jerusalem, Israel',           flag: '🇮🇱', continent: 'europe',   released: true, firstAt: '2026-07-25 10:12:33', totalGrabs: 2,   todayGrabs: 0,  lastAt: '2026-07-25 10:12:33', hot: false, name: '欧洲-以色列中部耶路撒冷', simpleName: '耶路撒冷', endpoint: 'https://objectstorage.il-jerusalem-1.oraclecloud.com', flagCode: 'il', arch: 'ARM', },

  // ── Middle East / Africa ─────────────────────────────────
  { code: 'me-jeddah-1',      cn: '沙特西部(吉达)',       en: 'Jeddah, Saudi Arabia',        flag: '🇸🇦', continent: 'africa',   released: true, firstAt: '2026-06-22 18:12:14', totalGrabs: 8,   todayGrabs: 0,  lastAt: '2026-06-22 18:12:14', hot: false, name: '中东-沙特阿拉伯西部吉达', simpleName: '吉达', endpoint: 'https://objectstorage.me-jeddah-1.oraclecloud.com', flagCode: 'sa', arch: 'ARM', },
  { code: 'me-riyadh-1',      cn: '沙特中部(利雅得)',     en: 'Riyadh, Saudi Arabia',        flag: '🇸🇦', continent: 'africa',   released: true, firstAt: '2026-07-02 14:22:33', totalGrabs: 4,   todayGrabs: 0,  lastAt: '2026-07-02 14:22:33', hot: false, name: '中东-沙特阿拉伯首都利雅得', simpleName: '利雅得', endpoint: 'https://objectstorage.me-riyadh-1.oraclecloud.com', flagCode: 'sa', arch: 'ARM', },
  { code: 'me-dubai-1',       cn: '阿联酋东部(迪拜)',     en: 'Dubai, UAE',                  flag: '🇦🇪', continent: 'africa',   released: true, firstAt: '2026-06-24 15:41:22', totalGrabs: 12,  todayGrabs: 0,  lastAt: '2026-06-24 15:41:22', hot: false, name: '中东-阿联酋迪拜', simpleName: '迪拜', endpoint: 'https://objectstorage.me-dubai-1.oraclecloud.com', flagCode: 'ae', arch: 'ARM', },
  { code: 'me-abudhabi-1',    cn: '阿联酋中部(阿布扎比)', en: 'Abu Dhabi, UAE',              flag: '🇦🇪', continent: 'africa',   released: true, firstAt: '2026-06-25 12:22:11', totalGrabs: 5,   todayGrabs: 0,  lastAt: '2026-06-25 12:22:11', hot: false, name: '中东-阿联酋阿布扎比', simpleName: '阿布扎比', endpoint: 'https://objectstorage.me-abudhabi-1.oraclecloud.com', flagCode: 'ae', arch: 'ARM', },
  { code: 'af-casablanca-1',  cn: '摩洛哥西部(卡萨布兰卡)', en: 'Casablanca, Morocco',       flag: '🇲🇦', continent: 'africa',   released: true, firstAt: '2026-06-02 23:25:45', totalGrabs: 9,   todayGrabs: 0,  lastAt: '2026-05-24 00:35:47', hot: false, name: '中东非洲-摩洛哥卡萨布兰卡', simpleName: '卡萨布兰卡', endpoint: 'https://objectstorage.af-casablanca-1.oraclecloud.com', flagCode: 'ma', arch: 'ARM', },
  { code: 'af-johannesburg-1',cn: '南非中部(约翰内斯堡)', en: 'Johannesburg, South Africa',  flag: '🇿🇦', continent: 'africa',   released: true, firstAt: '2026-06-28 09:14:22', totalGrabs: 3,   todayGrabs: 0,  lastAt: '2026-06-28 09:14:22', hot: false, name: '中东非洲-南非中部约翰内斯堡', simpleName: '约翰内斯堡', endpoint: 'https://objectstorage.af-johannesburg-1.oraclecloud.com', flagCode: 'za', arch: 'ARM', },

  // ── Americas ─────────────────────────────────────────────
  { code: 'us-ashburn-1',     cn: '美东(阿什本)',         en: 'Ashburn, USA',                flag: '🇺🇸', continent: 'americas', released: true, firstAt: '2026-04-15 03:12:19', totalGrabs: 178, todayGrabs: 0,  lastAt: '2026-07-14 11:22:03', hot: false, name: '北美-美国东部阿什本', simpleName: '阿什本', endpoint: 'https://objectstorage.us-ashburn-1.oraclecloud.com', flagCode: 'us', arch: 'ARM', },
  { code: 'us-phoenix-1',     cn: '美西(凤凰城)',         en: 'Phoenix, USA',                flag: '🇺🇸', continent: 'americas', released: true, firstAt: '2026-07-10 12:11:32', totalGrabs: 290, todayGrabs: 0,  lastAt: '2026-06-28 07:01:20', hot: true, name: '北美-美国西部凤凰城', simpleName: '凤凰城', endpoint: 'https://objectstorage.us-phoenix-1.oraclecloud.com', flagCode: 'us', arch: 'ARM', },
  { code: 'us-sanjose-1',     cn: '美西(圣何塞)',         en: 'San Jose, USA',               flag: '🇺🇸', continent: 'americas', released: true, firstAt: '2026-04-20 09:32:14', totalGrabs: 412, todayGrabs: 8,  lastAt: '2026-08-29 20:41:02', hot: true, name: '北美-美国西部圣何塞', simpleName: '圣何塞', endpoint: 'https://objectstorage.us-sanjose-1.oraclecloud.com', flagCode: 'us', arch: 'ARM', },
  { code: 'us-chicago-1',     cn: '美国中西部(芝加哥)',   en: 'Chicago, USA',                flag: '🇺🇸', continent: 'americas', released: true, firstAt: '2026-07-04 17:41:52', totalGrabs: 21,  todayGrabs: 0,  lastAt: '2026-07-04 17:41:52', hot: false, name: '北美-美国中西部芝加哥', simpleName: '芝加哥', endpoint: 'https://objectstorage.us-chicago-1.oraclecloud.com', flagCode: 'us', arch: 'ARM', },
  { code: 'ca-toronto-1',     cn: '加拿大东南部(多伦多)', en: 'Toronto, Canada',             flag: '🇨🇦', continent: 'americas', released: true, firstAt: '2026-07-07 08:12:23', totalGrabs: 17,  todayGrabs: 0,  lastAt: '2026-07-07 08:12:23', hot: false, name: '北美-加拿大东南部多伦多', simpleName: '多伦多', endpoint: 'https://objectstorage.ca-toronto-1.oraclecloud.com', flagCode: 'ca', arch: 'ARM', },
  { code: 'ca-montreal-1',    cn: '加拿大东南部(蒙特利尔)', en: 'Montreal, Canada',         flag: '🇨🇦', continent: 'americas', released: true, firstAt: '2026-07-10 06:42:11', totalGrabs: 9,   todayGrabs: 0,  lastAt: '2026-07-10 06:42:11', hot: false, name: '北美-加拿大东南部蒙特利尔', simpleName: '蒙特利尔', endpoint: 'https://objectstorage.ca-montreal-1.oraclecloud.com', flagCode: 'ca', arch: 'ARM', },
  { code: 'mx-queretaro-1',   cn: '墨西哥中部(克雷塔罗)', en: 'Queretaro, Mexico',           flag: '🇲🇽', continent: 'americas', released: true, firstAt: '2026-07-15 22:14:44', totalGrabs: 7,   todayGrabs: 0,  lastAt: '2026-07-15 22:14:44', hot: false, name: '北美-墨西哥中部克雷塔罗', simpleName: '克雷塔罗', endpoint: 'https://objectstorage.mx-queretaro-1.oraclecloud.com', flagCode: 'mx', arch: 'ARM', },
  { code: 'mx-monterrey-1',   cn: '墨西哥东北部(蒙特雷)', en: 'Monterrey, Mexico',           flag: '🇲🇽', continent: 'americas', released: true, firstAt: '2026-08-02 14:12:44', totalGrabs: 3,   todayGrabs: 0,  lastAt: '2026-08-02 14:12:44', hot: false, name: '北美-墨西哥东北部蒙特雷', simpleName: '蒙特雷', endpoint: 'https://objectstorage.mx-monterrey-1.oraclecloud.com', flagCode: 'mx', arch: 'ARM', },
  { code: 'sa-saopaulo-1',    cn: '巴西东部(圣保罗)',     en: 'São Paulo, Brazil',           flag: '🇧🇷', continent: 'americas', released: true, firstAt: '2026-06-02 09:15:14', totalGrabs: 14,  todayGrabs: 0,  lastAt: '2026-07-02 18:14:21', hot: false, name: '南美-巴西东部圣保罗', simpleName: '圣保罗', endpoint: 'https://objectstorage.sa-saopaulo-1.oraclecloud.com', flagCode: 'br', arch: 'ARM', },
  { code: 'sa-vinhedo-1',     cn: '巴西东南部(维尼耶多)', en: 'Vinhedo, Brazil',             flag: '🇧🇷', continent: 'americas', released: true, firstAt: '2026-05-28 12:20:00', totalGrabs: 8,   todayGrabs: 0,  lastAt: '2026-05-28 12:20:00', hot: false, name: '南美-巴西南部维涅杜', simpleName: '维尼耶多', endpoint: 'https://objectstorage.sa-vinhedo-1.oraclecloud.com', flagCode: 'br', arch: 'ARM', },
  { code: 'sa-santiago-1',    cn: '智利中部(圣地亚哥)',   en: 'Santiago, Chile',             flag: '🇨🇱', continent: 'americas', released: true, firstAt: '2026-06-11 08:33:42', totalGrabs: 5,   todayGrabs: 0,  lastAt: '2026-06-11 08:33:42', hot: false, name: '南美-智利中部圣地亚哥', simpleName: '圣地亚哥', endpoint: 'https://objectstorage.sa-santiago-1.oraclecloud.com', flagCode: 'cl', arch: 'ARM', },
  { code: 'sa-valparaiso-1',  cn: '智利西部(瓦尔帕莱索)', en: 'Valparaiso, Chile',           flag: '🇨🇱', continent: 'americas', released: true, firstAt: '2026-08-08 10:22:11', totalGrabs: 2,   todayGrabs: 0,  lastAt: '2026-08-08 10:22:11', hot: false, name: '南美-智利西部瓦尔帕莱索', simpleName: '瓦尔帕莱索', endpoint: 'https://objectstorage.sa-valparaiso-1.oraclecloud.com', flagCode: 'cl', arch: 'ARM', },
  { code: 'sa-bogota-1',      cn: '哥伦比亚中部(波哥大)', en: 'Bogota, Colombia',            flag: '🇨🇴', continent: 'americas', released: true, firstAt: '2026-06-04 07:11:32', totalGrabs: 6,   todayGrabs: 0,  lastAt: '2026-06-04 07:11:32', hot: false, name: '南美-哥伦比亚中部波哥大', simpleName: '波哥大', endpoint: 'https://objectstorage.sa-bogota-1.oraclecloud.com', flagCode: 'co', arch: 'ARM', },
];

const REGION_MAP = REGIONS.reduce((m, r) => (m[r.code] = r, m), {});


// ═══════════════════════════════════════════════════════════════════════
// 字段访问器 helpers · Phase 1(数据字段对齐原项目 doubleDimple/oci-start)
// ─────────────────────────────────────────────────────────────────────
// 前端 mock 数据现在同时携带两组字段:
//   · 旧字段(如 cpu / mem / name / status / custom / days / task) — 现有 UI 引用
//   · 原项目 entity 字段(如 ocpu / memory / remark / statusInt / tenancyName / activeDays / openInsFlag)
//
// 后续新代码请优先用这些 helper(以后接后端时只改 helper 一处):
// ═══════════════════════════════════════════════════════════════════════

// ── Instance / BootInstance ──────────────────────────────────────────
window.getInstanceCpu     = i => i?.ocpu ?? i?.cpu;
window.getInstanceMem     = i => i?.memory ?? i?.mem;
// arch:优先返回前端 UI 用的 'ARM'/'AMD'/'x86_64';原项目 architecture 是 'aarch64'/'x86_64'
window.getInstanceArch    = i => {
  if (i?.arch) return i.arch;                                     // UI 值('ARM'/'AMD')
  const a = i?.architecture;
  if (a === 'aarch64') return 'ARM';
  if (a === 'x86_64')  return 'AMD';
  return a || 'ARM';
};
window.getInstanceArchRaw = i => i?.architecture ?? i?.arch;      // 原始 'aarch64' 用于后端提交
window.getInstanceName    = i => i?.remark ?? i?.name;
window.getInstanceIp      = i => i?.publicIp ?? i?.ipv4;
window.getInstanceStatus  = i => {
  // 优先取字符串状态(前端用);statusInt 是原项目 int
  if (i?.status && typeof i.status === 'string') return i.status;
  const s = i?.statusInt;
  return ['stopped', 'pending', 'running', 'failed', 'paused'][s] ?? 'unknown';
};

// ── Tenant ────────────────────────────────────────────────────────────
window.getTenantDbId      = t => {
  const value = [t?._ui?.id, t?.idStr, t?.id, t?.tenantDbId, t?.tenant_id, t?.tenantId]
    .find(v => v !== null && v !== undefined && String(v) !== '');
  return value == null ? '' : String(value);
};
window.getTenantName      = t => {
  const value = [t?._ui?.name, t?.tenancyName, t?.userName, t?.name, t?.custom]
    .find(v => v !== null && v !== undefined && String(v) !== '');
  return value == null ? '' : String(value);
};
window.getTenantAlias     = t => {
  const value = [t?._ui?.alias, t?.defName, t?.custom]
    .find(v => v !== null && v !== undefined && String(v) !== '');
  return value == null ? '' : String(value);
};   // 自定义显示名
window.getTenantDays      = t => {
  const v = t?._ui?.activeDays ?? t?.activeDays ?? t?.days;
  return (v === null || v === undefined || v === '') ? '0' : String(v);
};
window.getTenantHasTask   = t => t?._ui?.hasBootTask ?? (t?.openBootFlag === true || t?.openInsFlag === '1' || t?.task === 'running');
window.getTenantActive    = t => t?._ui?.isActive ?? (typeof t?.isActive === 'boolean' ? t.isActive : t?.status === 'active');
window.getTenantRegion    = t => t?._ui?.regionCode ?? t?.region ?? t?.mainRegion;

// 自定义名称显示截断 · 与原项目 tlTruncateName 一致(ASCII 算 1 宽,其它算 2 宽,上限 14)
window.truncateDisplayName = (str, maxVisualLen = 14) => {
  if (!str) return '';
  let len = 0;
  let i = 0;
  for (; i < str.length; i++) {
    len += str.charCodeAt(i) > 0x7F ? 2 : 1;
    if (len > maxVisualLen) break;
  }
  return i < str.length ? str.slice(0, i) + '...' : str;
};

// ── GrabTask(与 Instance 共用 BootInstance)────────────────────────
window.getGrabAttempts    = g => g?.addCount ?? g?.totalAttempts;
window.getGrabFailed      = g => g?.failCount ?? g?.failed;
window.getGrabSucceeded   = g => g?.successCount ?? g?.succeeded;
window.getGrabToday       = g => g?.currentAttemptCount ?? g?.todayAttempts;
window.getGrabYesterday   = g => g?.yesterdayAttemptCount ?? g?.yesterdayAttempts;

// ── Region ────────────────────────────────────────────────────────────
window.getRegionFullName  = r => r?.name ?? r?.cn;
window.getRegionSimpleName = r => r?.simpleName ?? r?.cn;
window.getRegionEndpoint  = r => r?.endpoint;
window.getRegionFlagCode  = r => r?.flagCode ?? 'xx';   // ISO 2-char

// ── Proxy / VpnProxyRecord ────────────────────────────────────────────
window.getProxyName       = p => p?.customName ?? p?.name;
window.getProxyType       = p => p?.proxyType ?? p?.type;
window.getProxyHost       = p => p?.proxyHost ?? p?.host;
window.getProxyPort       = p => p?.proxyPort ?? p?.port;
window.getProxyAvailable  = p => (typeof p?.availableStatus === 'number' ? p.availableStatus === 1 : p?.status !== 'error');
window.getProxyForce      = p => p?.forceProxy === 1;

// ── Status Int ↔ String 转换(BootInstance/GrabTask 用)──────────────
//   原项目定义:0 未开机 · 1 开机中 · 2 已开机
//   我们扩展:3 failed · 4 paused(前端常用状态)
window.statusInt2Str = n => ['stopped', 'pending', 'running', 'failed', 'paused'][n] ?? 'unknown';
window.statusStr2Int = s => ({ stopped: 0, pending: 1, running: 2, paused: 4, idle: 0 })[s] ?? 0;

// ─── Auth 相关的运行时配置 ───────────────────────────────────
// 对齐原项目 LoginController.validateAdditionalFactors 的决策逻辑:
//   messageEnabled = tg.enabled || dd.enabled || bark.enabled
//   mfaEnabled     = mfaConfig.isEnabled()
// 目前从 localStorage 读(mock 场景 · 未来接后端时改成 GET /api/config/*-enabled)
//
// 写入方 · NotifyMgmtPage(page-tools.jsx) 的 saveChannel + SysSettingPage(page-misc.jsx) 的 MFA 保存
// 读取方 · AuthPage(page-auth.jsx) 决定登录流程,以及登录成功后回主界面

window.OCIP_AUTH_KEYS = {
  tg:   'ocip-notify-tg-enabled',
  dd:   'ocip-notify-dd-enabled',
  bark: 'ocip-notify-bark-enabled',
  mfa:  'ocip-mfa-enabled',
};

window.getAuthConfig = () => {
  const K = window.OCIP_AUTH_KEYS;
  const read = k => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };
  const tg = read(K.tg), dd = read(K.dd), bark = read(K.bark);
  return {
    channels: { tg, dd, bark },
    messageEnabled: tg || dd || bark,
    mfaEnabled: read(K.mfa),
  };
};

window.setAuthConfigFlag = (key, on) => {
  const storageKey = window.OCIP_AUTH_KEYS[key];
  if (!storageKey) return;
  try {
    if (on) localStorage.setItem(storageKey, '1');
    else    localStorage.removeItem(storageKey);
  } catch {}
  // 广播给同页面的其他组件监听(比如未来若有实时联动)
  window.dispatchEvent(new CustomEvent('ocip-auth-config-change', { detail: { key, on } }));
};

Object.assign(window, {
  REGIONS, REGION_MAP,
});
