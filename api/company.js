const CH_BASE = "https://api.company-information.service.gov.uk";

async function chFetch(path, apiKey) {
  const auth = Buffer.from(apiKey + ":").toString("base64");
  const res = await fetch(CH_BASE + path, {
    headers: { "Authorization": "Basic " + auth }
  });
  if (!res.ok) throw new Error("CH " + res.status);
  return res.json();
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = process.env.CH_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "CH_API_KEY not set" });

  const number = req.query.number;
  if (!number) return res.status(400).json({ error: "Provide ?number=XXXXXXXX" });

  try {
    const [profile, officersData, filingData] = await Promise.all([
      chFetch("/company/" + number, apiKey),
      chFetch("/company/" + number + "/officers?items_per_page=20", apiKey),
      chFetch("/company/" + number + "/filing-history?items_per_page=10", apiKey)
    ]);

    return res.status(200).json({
      number,
      name: profile.company_name,
      status: profile.company_status,
      type: profile.type,
      incorporated: profile.date_of_creation,
      sic_codes: profile.sic_codes || [],
      registered_address: profile.registered_office_address,
      accounts: profile.accounts,
      officers: (officersData.items || []).map(o => ({
        name: o.name,
        role: o.officer_role,
        appointed: o.appointed_on,
        resigned: o.resigned_on || null,
        nationality: o.nationality || null,
        occupation: o.occupation || null
      })),
      recent_filings: (filingData.items || []).map(f => ({
        type: f.type,
        date: f.date,
        description: f.description
      })),
      ch_url: "https://find-and-update.company-information.service.gov.uk/company/" + number
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
