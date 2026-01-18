const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envMatch = envContent.match(/GEMINI_API_KEY=(.*)/);
const apiKey = envMatch ? envMatch[1].trim() : null;

async function main() {
    try {
        console.log("Key Found:", !!apiKey);
        if (!apiKey) throw new Error("API Key not found in .env.local");

        const genAI = new GoogleGenerativeAI(apiKey);

        // Testing models
        const modelsToTest = ["gemini-2.0-flash-exp", "gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro", "gemini-1.0-pro"];

        for (const modelName of modelsToTest) {
            process.stdout.write(`Testing ${modelName}... `);
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent("Say HI");
                console.log(`SUCCESS! ✅`);
                console.log(`Response: ${result.response.text()}`);
                break; // Found one that works!
            } catch (e) {
                console.log(`FAILED ❌`);
                console.log(e.message);
            }
        }
    } catch (error) {
        console.error("Fatal error:", error);
    }
}

main();
