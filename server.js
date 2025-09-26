import express from "express";
import puppeteer from "puppeteer";
import cors from "cors";
import fs from "fs";
import sharp from "sharp";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// 🔑 Credenciales de test
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

// Utilidad: esperar X milisegundos
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 📸 Scraping de publicaciones
app.get("/api/posts", async (req, res) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    // Intentar con cookies guardadas
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

    // Si no está logueado → login manual
    if (!loggedIn) {
      console.log("🔑 Iniciando sesión en Instagram...");
      await page.goto("https://www.instagram.com/accounts/login/", {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      // 🔹 Aceptar cookies si aparece
      try {
        const cookieButton = await page.$x("//button[contains(text(), 'Aceptar')]");
        if (cookieButton.length > 0) {
          await cookieButton[0].click();
          console.log("🍪 Cookies aceptadas");
          await delay(2000);
        }
      } catch {
        console.log("No apareció banner de cookies");
      }

      // 🔹 Inputs de login
      await page.waitForSelector("input[name='username']", { timeout: 20000 });
      await page.type("input[name='username']", IG_USERNAME, { delay: 80 });
      await page.type("input[name='password']", IG_PASSWORD, { delay: 80 });

      // 🔹 Login
      await page.click("button[type='submit']");
      await delay(8000); // esperar carga de sesión

      await saveCookies(page);

      // Ir al perfil ya logueado
      await page.goto(`https://www.instagram.com/${TARGET_PROFILE}/`, {
        waitUntil: "networkidle2",
        timeout: 120000,
      });
    }

    // 📸 Extraer posts reales
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

// 🔄 Endpoint para convertir imágenes a PNG
app.get("/api/image", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send("Falta parámetro url");

  try {
    const response = await fetch(url); // 👈 usamos fetch nativo
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
