module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    status: "ok",
    ch_key_set: !!process.env.CH_API_KEY,
    node: process.version,
    ts: new Date().toISOString()
  });
};
