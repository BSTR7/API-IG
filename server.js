import express from "express";
import cors from "cors";
import fs from "fs";
import fetch from "node-fetch";
import sharp from "sharp";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

const IG_USERNAME = "fbackend9";
const IG_PASSWORD = "Degus_7777@#";
const TARGET_PROFILE = "fundaciondegus";
const COOKIES_PATH = "./cookies.json";

// Guardar cookies en archivo
async function saveCookies(page) {
  const cookies = await page.cookies();
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
}

// Cargar cookies desde archivo
async function loadCookies(page) {
  if (fs.existsSync(COOKIES_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH));
    await page.setCookie(...cookies);
    return true;
  }
  return false;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 📸 Scraping
app.get("/api/posts", async (req, res) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    let loggedIn = false;
    if (await loadCookies(page)) {
      await page.goto(`https://www.instagram.com/${TARGET_PROFILE}/`, {
        waitUntil: "networkidle2",
        timeout: 120000,
      });
      if (!(await page.$("input[name='username']"))) {
        loggedIn = true;
      }
    }

    if (!loggedIn) {
      await page.goto("https://www.instagram.com/accounts/login/", {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      await page.waitForSelector("input[name='username']", { timeout: 20000 });
      await page.type("input[name='username']", IG_USERNAME, { delay: 80 });
      await page.type("input[name='password']", IG_PASSWORD, { delay: 80 });

      await page.click("button[type='submit']");
      await delay(8000);

      await saveCookies(page);

      await page.goto(`https://www.instagram.com/${TARGET_PROFILE}/`, {
        waitUntil: "networkidle2",
        timeout: 120000,
      });
    }

    await page.waitForSelector("a._a6hd img", { timeout: 20000 });

    const posts = await page.evaluate(() => {
      const elements = document.querySelectorAll("a._a6hd");
      return Array.from(elements)
        .slice(0, 10)
        .map((el) => {
          const img = el.querySelector("img");
          return {
            url: "https://www.instagram.com" + el.getAttribute("href"),
            image: img ? img.src : null,
            alt: img ? img.alt : null,
          };
        });
    });

    res.json({ perfil: TARGET_PROFILE, publicaciones: posts });
  } catch (error) {
    console.error("❌ Error scraping Instagram:", error.message);
    res.status(500).json({ error: "Error obteniendo publicaciones", details: error.message });
  } finally {
    if (browser) await browser.close();
  }
});

// 🔄 Convertir imágenes a PNG
app.get("/api/image", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send("Falta parámetro url");

  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const pngBuffer = await sharp(Buffer.from(buffer)).png().toBuffer();

    res.set("Content-Type", "image/png");
    res.send(pngBuffer);
  } catch (err) {
    console.error("❌ Error convirtiendo imagen:", err.message);
    res.status(500).send("Error procesando imagen");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API corriendo en http://localhost:${PORT}`);
});
