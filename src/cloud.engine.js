import enigma from "enigma.js";
const schema = require("enigma.js/schemas/12.1306.0.json");

export default class EngineService {
  constructor(engineUri) {
    this.engineUri = engineUri;
  }

  openEngineSession(headers) {
    const params = Object.keys(headers)
      .map((key) => `${key}=${headers[key]}`)
      .join("&");
    const session = enigma.create({
      schema,
      url: `${this.engineUri}?${params}`,
    });
    session.on("traffic:sent", (data) => console.log("sent:", data));
    session.on("traffic:received", (data) => console.log("received:", data));
    return session;
  }

  async closeEngineSession(session) {
    if (session) {
      await session.close();
      console.log("session closed");
    }
  }

  async getOpenDoc(appId, headers) {
    let session = this.openEngineSession(headers);
    let global = await session.open();

    let doc = await global.openDoc(appId);
    return doc;
  }
}