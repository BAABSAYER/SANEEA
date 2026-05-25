const appJson = require("./app.json");

const apiBaseUrl = (process.env.EXPO_PUBLIC_API_URL || "https://sannea-3npcj.ondigitalocean.app").replace(/\/+$/, "");

module.exports = {
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    apiBaseUrl,
    privacyPolicyUrl: `${apiBaseUrl}/privacy-policy`,
  },
};
