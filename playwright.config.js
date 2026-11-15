// ブラウザでの動作確認(Playwright)。npm test とは別に、npm run test:e2e で動かす。
module.exports = {
  testDir: "test-e2e",
  timeout: 180000,
  use: { baseURL: "http://localhost:8080" },
  webServer: {
    command: "npm run serve",
    url: "http://localhost:8080",
    reuseExistingServer: true,
    timeout: 120000,
  },
};
