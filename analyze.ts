import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function analyze() {
  for (let i = 12; i <= 22; i++) {
    const file = path.join(process.cwd(), "public/images", `capitulo${i}.jpeg`);
    if (fs.existsSync(file)) {
      try {
        const imagePart = {
            inlineData: {
                data: Buffer.from(fs.readFileSync(file)).toString("base64"),
                mimeType: "image/jpeg"
            }
        };
        const response = await ai.models.generateContent({
            model: "gemini-3.1-flash",
            contents: [
              "Describe briefly what this image represents (e.g. wall, cannon, train, civil war, Game of thrones, Leona statue).",
              imagePart
            ],
        });
        console.log(`capitulo${i}.jpeg:`, response.text);
      } catch (e) {
        console.error("Error for", i, e.message);
      }
    }
  }
}

analyze();
