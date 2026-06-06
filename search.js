const CH_BASE = "https://api.companieshouse.gov.uk";

const SIC_SCORES = {
  "53200": 3,
  "49410": 3,
  "52290": 2,
  "52100": 2,
  "47910": 2,
  "49320": 2,
  "46900": 1,
  "47190": 1,
};

const EXCLUDE = ["HOLDINGS","DORMANT","NOMINEE","TRUSTEE","PENSION","CHARITY","FOUNDATION"];

function scoreCompany(company, officers) {
  let score = 0;
  const signals = [];
  const sics = company.sic_codes || [];
  const sicScore = Math.max(0, ...sics.map(s => SIC_SCORES[s] || 0));
  if (sicScore > 0) { score += sicScore; signals.push("SIC match (" + sics[0] + ")"); }

  const activeDirs = (officers || []).filter(o => o.officer_role === "director" && !o.resigned_on);
  const dirCount = activeDirs.length;
  if (dirCount >= 2 && dirCount <= 5) { score += 2; signals.push("Lean board (" + dirCount + " dirs)"); }
  else if (dirCount === 1) { score += 1; signals.push("Solo director"); }
  else if (dirCount > 5) { score -= 1; }

  const lastFiled = company.accounts && company.accounts.last_accounts && company.accounts.last_accounts.made_up_to;
  if (lastFiled) {
    const monthsAgo = (Date.now() - new Date(lastFiled)) / (1000 * 60 * 60 * 24 * 30);
    if (monthsAgo < 12) { score += 1; signals.push("Recent accounts"); }
  }

  const inc = company.date_of_creation;
  if (inc) {
    const yrs = (Date.now() - new Date(inc)) / (1000 * 60 * 60 * 24 * 365);
    if (yrs >= 3 && yrs <= 20) { score += 1; signals.push("Prime growth age"); }
  }

  const name = (company.company_name || company.title || "").toUpperCase();
  if (EXCLUDE.some(kw => name.includes(kw))) score = -99;
  if (company.company_status !== "active") score = -99;

  const grade = score >= 6 ? "A+" : score >= 4 ? "A" : score >= 2 ? "B" : "C";
  return { score, grade, signals, dirCount, activeDirs };
}

async function chFetch(path, apiKey) {
  const auth = Buffer.from(apiKey + ":").toString("base64");
  const res = await fetch(CH_BASE + path, {
    headers: { "Authorization": "Basic " + auth }
  });
  if (!res.ok) throw new Error("CH " + res.status + " " + path);
  return res.json();
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = process.env.CH_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "CH_API_KEY environment variable not set in Vercel" });
  }

  const q = req.query.q || "logistics";
  const maxResults = Math.min(parseInt(req.query.maxResults) || 20, 100);

  try {
    const searchData = await chFetch(
      "/search/companies?q=" + encodeURIComponent(q) + "&items_per_page=" + maxResults,
      apiKey
    );

    const items = (searchData.items || []).filter(c => {
      const n = (c.title || "").toUpperCase();
      return !EXCLUDE.some(kw => n.includes(kw));
    }).slice(0, 12);

    const enriched = await Promise.all(items.map(async c => {
      const num = c.company_number;
      let profile = c, officersData = { items: [] };
      try {
        [profile, officersData] = await Promise.all([
          chFetch("/company/" + num, apiKey),
          chFetch("/company/" + num + "/officers?items_per_page=20", apiKey)
        ]);
      } catch (_) {}

      const officers = officersData.items || [];
      const merged = Object.assign({}, c, profile);
      const { score, grade, signals, dirCount, activeDirs } = scoreCompany(merged, officers);
      if (score < 0) return null;

      const addr = profile.registered_office_address || {};
      const location = [addr.locality, addr.region, addr.postal_code].filter(Boolean).join(", ") || c.address_snippet || "";

      return {
        company_number: num,
        name: profile.company_name || c.title || "",
        status: profile.company_status || c.company_status || "",
        incorporated: profile.date_of_creation || c.date_of_creation || "",
        sic_codes: profile.sic_codes || [],
        location,
        directors: dirCount,
        active_directors: activeDirs.slice(0, 5).map(o => ({ name: o.name, appointed: o.appointed_on })),
        accounts_made_up: (profile.accounts && profile.accounts.last_accounts && profile.accounts.last_accounts.made_up_to) || null,
        score,
        grade,
        signals,
        ch_url: "https://find-and-update.company-information.service.gov.uk/company/" + num
      };
    }));

    const results = enriched.filter(Boolean).sort((a, b) => b.score - a.score);

    return res.status(200).json({
      total_found: searchData.total_results || 0,
      returned: results.length,
      query: q,
      results
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
