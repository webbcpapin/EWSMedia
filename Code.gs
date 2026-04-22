// ===================== CONFIG =====================
const SPREADSHEET_ID = "ISI_ID_SPREADSHEET_ANDA";
const SHEET_NAME = "DATA_MEDIA";
const WA_PHONE = "628xxxxxxxxxx";
const WA_APIKEY = "ISI_APIKEY_CALLMEBOT";

const KEYWORDS = [
  "bea cukai pangkalpinang",
  "bea cukai bangka",
  "beacukai babel",
  "rokok ilegal bangka",
  "rokok ilegal pangkalpinang",
  "ekspor impor bangka"
];

const LOCAL_DOMAINS = [
  "bangkapos.com",
  "babelpos.com",
  "detik.com",
  "kompas.com",
  "tribunnews.com",
  "antaranews.com",
  "liputan6.com",
  "cnnindonesia.com"
];

const KATEGORI_LIST = ["Penindakan", "Layanan Publik", "Kebijakan Cukai", "Opini Negatif", "Lainnya"];

// ===================== SHEET UTILS =====================
function getSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "ID", "Timestamp", "Judul", "Link", "Sumber", "Tanggal",
      "Keyword", "Ringkasan", "Sentimen", "Kategori", "Risiko",
      "Framing", "Rekomendasi", "Status", "Engagement"
    ]);
    sheet.getRange(1, 1, 1, 15).setFontWeight("bold").setBackground("#4285f4").setFontColor("white");
  }
  return sheet;
}

// ===================== WEB APP API =====================
function doGet(e) {
  const action = e.parameter.action;

  if (action == "getData") {
    return json(getData());
  }

  if (action == "getStats") {
    return json(getStats());
  }

  if (action == "scrapeNews") {
    return json(scrapeNews());
  }

  if (action == "sendAlert") {
    return json(sendAlert());
  }

  if (action == "getRecommendations") {
    return json(getRecommendations());
  }

  return json({ success: false, message: "Action tidak dikenal" });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action == "submit") {
      return json(submit(body.data));
    }

    if (action == "updateStatus") {
      return json(updateStatus(body.id, body.status));
    }

    if (action == "updateRekomendasi") {
      return json(updateRekomendasi(body.id, body.rekomendasi));
    }

    if (action == "deleteData") {
      return json(deleteData(body.id));
    }

    return json({ success: false, message: "Action tidak dikenal" });
  } catch (err) {
    return json({ success: false, message: "Error: " + err.toString() });
  }
}

// ===================== DATA CRUD =====================
function getData() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  let res = [];
  for (let i = 1; i < data.length; i++) {
    res.push({
      id: data[i][0],
      timestamp: data[i][1],
      judul: data[i][2],
      link: data[i][3],
      sumber: data[i][4],
      tanggal: data[i][5],
      keyword: data[i][6],
      ringkasan: data[i][7],
      sentimen: data[i][8],
      kategori: data[i][9],
      risiko: data[i][10],
      framing: data[i][11],
      rekomendasi: data[i][12],
      status: data[i][13],
      engagement: data[i][14]
    });
  }
  return { success: true, data: res, total: res.length };
}

function getStats() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  let total = 0, open = 0, closed = 0, negatif = 0, positif = 0, netral = 0;
  let kritis = 0, waspada = 0;

  for (let i = 1; i < data.length; i++) {
    total++;
    const status = data[i][13];
    const sentimen = data[i][8];
    const risiko = data[i][10];

    if (status == "Open") open++;
    if (status == "Closed") closed++;
    if (sentimen == "Negatif") negatif++;
    if (sentimen == "Positif") positif++;
    if (sentimen == "Netral") netral++;
    if (risiko == "Tinggi") kritis++;
    if (risiko == "Sedang") waspada++;
  }

  return {
    success: true,
    stats: { total, open, closed, negatif, positif, netral, kritis, waspada }
  };
}

function submit(d) {
  const sheet = getSheet();
  const id = Utilities.getUuid();
  const timestamp = new Date();

  // AI Analysis
  const ai = analyzeContent(d.judul + " " + (d.ringkasan || ""));

  // Generate recommendation
  const rec = generateRecommendation(ai.sentimen, ai.risiko, d.kategori);

  sheet.appendRow([
    id, timestamp, d.judul, d.link, d.sumber, d.tanggal || timestamp,
    d.keyword, d.ringkasan, ai.sentimen, d.kategori || ai.kategori,
    d.risiko || ai.risiko, ai.framing, d.rekomendasi || rec, d.status || "Open", ""
  ]);

  // Check EWS after submit
  checkAlert();

  return { success: true, id: id, message: "Data berhasil disimpan" };
}

function updateStatus(id, status) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      sheet.getRange(i + 1, 14).setValue(status);
      return { success: true, message: "Status diupdate" };
    }
  }
  return { success: false, message: "Data tidak ditemukan" };
}

function updateRekomendasi(id, rekomendasi) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      sheet.getRange(i + 1, 13).setValue(rekomendasi);
      return { success: true, message: "Rekomendasi diupdate" };
    }
  }
  return { success: false, message: "Data tidak ditemukan" };
}

function deleteData(id) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      sheet.deleteRow(i + 1);
      return { success: true, message: "Data dihapus" };
    }
  }
  return { success: false, message: "Data tidak ditemukan" };
}

// ===================== AI ANALYSIS =====================
function analyzeContent(text) {
  text = text.toLowerCase();

  // Sentiment Analysis
  let sentimen = "Netral";
  const negWords = ["ilegal", "penyelundupan", "korupsi", "keluhan", "protes", "marak", "beredar", "bermasalah", "lambat", "rumit", "sulit"];
  const posWords = ["berhasil", "gagalkan", "prestasi", "terbaik", "inovasi", "membantu", "mudah", "cepat", "apresiasi"];

  let negCount = 0, posCount = 0;
  negWords.forEach(w => { if (text.includes(w)) negCount++; });
  posWords.forEach(w => { if (text.includes(w)) posCount++; });

  if (negCount > posCount) sentimen = "Negatif";
  else if (posCount > negCount) sentimen = "Positif";

  // Risk Assessment
  let risiko = "Rendah";
  if (sentimen == "Negatif") {
    if (text.includes("krisis") || text.includes("skandal") || text.includes("korupsi") || negCount >= 3) {
      risiko = "Tinggi";
    } else {
      risiko = "Sedang";
    }
  }

  // Category Classification
  let kategori = "Lainnya";
  if (text.includes("penyelundupan") || text.includes("ilegal") || text.includes("narkoba") || text.includes("penindakan")) kategori = "Penindakan";
  else if (text.includes("layanan") || text.includes("pelayanan") || text.includes("ekspor") || text.includes("impor")) kategori = "Layanan Publik";
  else if (text.includes("kebijakan") || text.includes("cukai") || text.includes("tarif") || text.includes("aturan")) kategori = "Kebijakan Cukai";
  else if (text.includes("keluhan") || text.includes("protes") || text.includes("kritik")) kategori = "Opini Negatif";

  // Framing Detection
  let framing = "Netral";
  if (text.includes("pemerintah lambat") || text.includes("instansi lemah")) framing = "Pemerintah Dikritik";
  else if (text.includes("industri korban") || text.includes("pengusaha dirugikan")) framing = "Industri Dikorbankan";
  else if (text.includes("berhasil") || text.includes("prestasi")) framing = "Pemerintah Diapresiasi";

  return { sentimen, risiko, kategori, framing };
}

function generateRecommendation(sentimen, risiko, kategori) {
  if (sentimen == "Negatif") {
    if (risiko == "Tinggi") {
      return "[KRISIS] Segera koordinasi dengan Kepala Kantor. Siapkan siaran pers resmi dalam 2 jam. Ajukan hak jawab/koreksi ke media. Lakukan Media Visit dalam 24 jam. Monitor perkembangan setiap 30 menit.";
    }
    return "[WASPADA] Buat konten edukasi/infografis tandingan. Lakukan media briefing untuk klarifikasi. Monitor perkembangan isu setiap 2 jam. Siapkan FAQ untuk call center.";
  }
  if (sentimen == "Positif") {
    return "[APRESIASI] Share ke media sosial resmi @beacukaipapin. Berikan apresiasi ke media/sumber. Jadikan bahan laporan kinerja bulanan. Pertimbangkan untuk media gathering.";
  }
  return "[MONITORING] Lakukan monitoring pasif. Catat untuk evaluasi berkala. Update database mingguan.";
}

// ===================== SCRAPING =====================
function scrapeNews() {
  const sheet = getSheet();
  let newCount = 0;

  KEYWORDS.forEach(keyword => {
    try {
      const url = "https://news.google.com/rss/search?q=" + encodeURIComponent(keyword) + "&hl=id&gl=ID&ceid=ID:id";
      const xml = UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText();
      const doc = XmlService.parse(xml);
      const items = doc.getRootElement().getChild("channel").getChildren("item");

      items.forEach(item => {
        const title = item.getChildText("title");
        const link = item.getChildText("link");
        const pubDate = item.getChildText("pubDate");

        if (!isLocal(link)) return;
        if (isDuplicate(link)) return;

        const content = fetchContent(link);
        const ai = analyzeContent(title + " " + content);
        const rec = generateRecommendation(ai.sentimen, ai.risiko, ai.kategori);

        sheet.appendRow([
          Utilities.getUuid(), new Date(), title, link, extractDomain(link),
          pubDate ? new Date(pubDate) : new Date(), keyword, content.substring(0, 500),
          ai.sentimen, ai.kategori, ai.risiko, ai.framing, rec, "Open", ""
        ]);

        newCount++;
      });
    } catch (e) {
      console.error("Scrape error for keyword " + keyword + ": " + e);
    }
  });

  checkAlert();
  return { success: true, count: newCount, message: newCount + " artikel baru ditemukan" };
}

function fetchContent(url) {
  try {
    const html = UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText();
    const paragraphs = html.match(/<p[^>]*>(.*?)<\/p>/gi);
    if (!paragraphs) return "";
    return paragraphs.map(p => p.replace(/<[^>]+>/g, "")).join(" ").substring(0, 1000);
  } catch (e) {
    return "";
  }
}

function isLocal(url) {
  return LOCAL_DOMAINS.some(d => url.includes(d));
}

function isDuplicate(link) {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  const data = sheet.getRange(2, 4, lastRow - 1, 1).getValues();
  return data.some(r => r[0] == link);
}

function extractDomain(url) {
  try {
    const match = url.match(/https?:\/\/([^\/]+)/);
    return match ? match[1] : "Unknown";
  } catch (e) {
    return "Unknown";
  }
}

// ===================== EWS ALERT =====================
function checkAlert() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  let negatifCount = 0;
  let kritisCount = 0;

  // Count negative issues in last 24 hours
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  for (let i = 1; i < data.length; i++) {
    const timestamp = new Date(data[i][1]);
    if (timestamp >= oneDayAgo) {
      if (data[i][8] == "Negatif") negatifCount++;
      if (data[i][10] == "Tinggi") kritisCount++;
    }
  }

  if (kritisCount >= 1 || negatifCount >= 3) {
    const msg = "ALERT EWS BC Pangkalpinang: " + negatifCount + " isu negatif terdeteksi dalam 24 jam terakhir. " + kritisCount + " di antaranya level KRITIS. Segera cek dashboard!";
    sendWA(msg);
    return { alert: true, level: kritisCount >= 1 ? "KRITIS" : "WASPADA", negatifCount, kritisCount };
  }

  return { alert: false, negatifCount, kritisCount };
}

function sendAlert() {
  return checkAlert();
}

// ===================== WHATSAPP =====================
function sendWA(msg) {
  try {
    const url = "https://api.callmebot.com/whatsapp.php?phone=" + WA_PHONE + "&text=" + encodeURIComponent(msg) + "&apikey=" + WA_APIKEY;
    UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    return { success: true, message: "WhatsApp terkirim" };
  } catch (e) {
    return { success: false, message: "Gagal kirim WA: " + e.toString() };
  }
}

// ===================== RECOMMENDATIONS =====================
function getRecommendations() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  let recs = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][13] != "Closed" && data[i][12]) {
      recs.push({
        id: data[i][0],
        judul: data[i][2],
        sentimen: data[i][8],
        kategori: data[i][9],
        risiko: data[i][10],
        rekomendasi: data[i][12],
        status: data[i][13]
      });
    }
  }

  return { success: true, data: recs };
}

// ===================== UTILS =====================
function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===================== TRIGGERS =====================
function createTrigger() {
  // Delete existing triggers
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() == "scrapeNews") ScriptApp.deleteTrigger(t);
  });

  // Create new trigger every hour
  ScriptApp.newTrigger("scrapeNews")
    .timeBased()
    .everyHours(1)
    .create();

  return "Trigger dibuat: scrapeNews setiap 1 jam";
}

function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() == "scrapeNews") ScriptApp.deleteTrigger(t);
  });
  return "Trigger dihapus";
}
