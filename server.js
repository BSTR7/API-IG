import express from 'express';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Servir frontend
app.use('/Frontend', express.static(path.join(__dirname, '../Frontend')));
app.get('/novedades', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/novedades.html'));
});

// Cliente Axios para Instagram
const client = axios.create({
  headers: {
    'x-ig-app-id': '936619743392459',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept': '*/*'
  }
});

// Scrapear perfil
async function scrapeUser(username) {
  try {
    const response = await client.get(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username.trim()}`
    );
    return response.data.data.user;
  } catch (error) {
    const msg = error.response?.status === 404
      ? `El usuario @${username} no existe o es privado.`
      : `Error al obtener datos de @${username}: ${error.message}`;
    throw new Error(msg);
  }
}

// Parsear datos
function parseUser(userData) {
  const totalPosts = (userData.edge_owner_to_timeline_media?.count || 0) +
                     (userData.edge_felix_video_timeline?.count || 0);

  const timelineMedia = userData.edge_owner_to_timeline_media?.edges || [];
  const videoTimeline = userData.edge_felix_video_timeline?.edges || [];
  const allEdges = [...timelineMedia, ...videoTimeline];

  const postsArray = allEdges.map(edge => {
    const node = edge.node;
    const caption = node.edge_media_to_caption?.edges[0]?.node?.text || '';
    return {
      description: caption,
      photo: node.display_url || '',
      link: `https://www.instagram.com/p/${node.shortcode}/`
    };
  }).filter(post => post.photo);

  return {
    username: userData.username,
    fullName: userData.full_name || 'No disponible',
    bio: userData.biography || 'No disponible',
    posts: totalPosts.toString(),
    followers: userData.edge_followed_by?.count?.toString() || '0',
    following: userData.edge_follow?.count?.toString() || '0',
    postsArray
  };
}

// ENDPOINT QUE TÚ QUERÍAS: /api/posts/:username
app.get('/api/posts/:username', async (req, res) => {
  const { username } = req.params;

  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'Falta el nombre de usuario en la URL' });
  }

  try {
    console.log(`Scraping Instagram para: @${username}`);
    const userData = await scrapeUser(username);
    const parsedData = parseUser(userData);

    const publicaciones = parsedData.postsArray.map(post => ({
      image: post.photo,
      alt: post.description.substring(0, 200) || `Publicación de ${parsedData.fullName}`,
      url: post.link
    }));

    res.json({
      success: true,
      username: parsedData.username,
      fullName: parsedData.fullName,
      bio: parsedData.bio,
      posts: parsedData.posts,
      followers: parsedData.followers,
      following: parsedData.following,
      publicaciones
    });

  } catch (error) {
    console.error('Error en /api/posts/:username →', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Proxy de imágenes (opcional pero útil)
app.get('/api/image', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Falta parámetro url' });

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.set({ 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' });
    res.send(Buffer.from(response.data));
  } catch (error) {
    res.status(500).send('Error al cargar imagen');
  }
});

// Raíz → novedades
app.get('/', (req, res) => {
  res.redirect('/novedades');
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
  console.log(`Ejemplo: http://localhost:${port}/api/posts/cristiano`);
  console.log(`Ejemplo: http://localhost:${port}/api/posts/nasa`);
});