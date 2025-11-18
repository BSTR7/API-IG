import express from 'express';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors'; // Agregado para CORS, instala con npm install cors
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000; // Render usa PORT env, fallback a 3000
// Middleware para parsear JSON y CORS (permite acceso desde cualquier origen)
app.use(express.json());
app.use(cors({
  origin: '*', // Cambia a tu dominio si quieres restringir (ej: 'https://tudominio.com')
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));
// Servir archivos estáticos de la carpeta ../Frontend
app.use('/Frontend', express.static(path.join(__dirname, '../Frontend')));
// Servir novedades.html directamente en /novedades
app.get('/novedades', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/novedades.html'));
});
// Configurar cliente Axios con headers para simular navegador
const client = axios.create({
  headers: {
    'x-ig-app-id': '936619743392459',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept': '*/*'
  }
});
async function scrapeUser(username) {
  try {
    const response = await client.get(
      https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}
    );
    const userData = response.data.data.user;
    return userData;
  } catch (error) {
    console.error('Error al scrapear usuario:', error.message);
    throw new Error(Error al obtener datos: ${error.message});
  }
}
function parseUser(userData) {
  const totalPosts = (userData.edge_owner_to_timeline_media ? userData.edge_owner_to_timeline_media.count : 0) +
                     (userData.edge_felix_video_timeline ? userData.edge_felix_video_timeline.count : 0);
 
  // Extraer posts del timeline (imágenes y videos)
  const timelineMedia = userData.edge_owner_to_timeline_media?.edges || [];
  const videoTimeline = userData.edge_felix_video_timeline?.edges || [];
  const allEdges = [...timelineMedia, ...videoTimeline];
 
  const postsArray = allEdges.map(edge => {
    const node = edge.node;
    const captionEdge = node.edge_media_to_caption?.edges[0]?.node?.text || '';
    return {
      description: captionEdge,
      photo: node.display_url || '',
      link: https://www.instagram.com/p/${node.shortcode}/
    };
  }).filter(post => post.photo);
 
  return {
    username: userData.username,
    fullName: userData.full_name || 'No disponible',
    bio: userData.biography || 'No disponible',
    posts: totalPosts.toString(),
    followers: userData.edge_followed_by.count.toString(),
    following: userData.edge_follow.count.toString(),
    postsArray
  };
}
// Endpoint original /scrape
app.get('/scrape', async (req, res) => {
  const { username } = req.query;
 
  if (!username) {
    return res.status(400).json({ error: 'Falta el parámetro "username". Ejemplo: /scrape?username=tuusuario' });
  }
  try {
    const userData = await scrapeUser(username);
    const parsedData = parseUser(userData);
    res.json({ success: true, data: parsedData });
  } catch (error) {
    console.error('Error en scraping:', error);
    res.status(500).json({ error: 'Error al scrapear: ' + error.message });
  }
});
// Endpoint /api/posts (username de env o hardcoded)
app.get('/api/posts', async (req, res) => {
  const username = process.env.IG_USERNAME || 'fundaciondegus'; // Usa env si lo configuras en Render
 
  try {
    console.log(Scraping posts para: ${username}); // Log para debug
    const userData = await scrapeUser(username);
    const parsedData = parseUser(userData);
    const publicaciones = parsedData.postsArray.map(post => ({
      image: post.photo,
      alt: post.description || 'Publicación de Fundación Degus',
      url: post.link
    }));
    res.json({ publicaciones });
  } catch (error) {
    console.error('Error en /api/posts:', error);
    res.status(500).json({ error: 'Error al cargar publicaciones: ' + error.message });
  }
});
// Endpoint proxy /api/image
app.get('/api/image', async (req, res) => {
  const { url } = req.query;
 
  if (!url) {
    return res.status(400).json({ error: 'Falta el parámetro "url" para la imagen.' });
  }
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36'
      }
    });
    const contentType = response.headers['content-type'] || 'image/jpeg';
   
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600'
    });
   
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error('Error en proxy de imagen:', error.message);
    res.status(500).send('Error al cargar imagen');
  }
});
// Raíz redirige a novedades
app.get('/', (req, res) => {
  res.redirect('/novedades');
});
app.listen(port, () => {
  console.log(Servidor corriendo en puerto ${port});
  console.log(Accede a: http://localhost:${port}/novedades (local) o tu URL de Render.);
});