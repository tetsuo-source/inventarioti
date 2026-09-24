const express = require('express');
const multer = require('multer');
const csv = require('csvtojson');
const fs = require('fs');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Bases de datos locales
const dbPath = path.join(__dirname, 'data', 'inventory.json');
const glpiDbPath = path.join(__dirname, 'data', 'glpi.json');
const instDbPath = path.join(__dirname, 'data', 'instalaciones.json');
const avayaDbPath = path.join(__dirname, 'data', 'avaya.json'); 
const avayaNuevosDbPath = path.join(__dirname, 'data', 'avaya_nuevos.json'); // Nueva BD Stock Avaya

// === BASE DE DATOS DE USUARIOS ===
const usuariosDbPath = path.join(__dirname, 'data', 'usuarios.json');

// Si no existe el archivo de usuarios, creamos el "admin" maestro automáticamente
if (!fs.existsSync(usuariosDbPath)) {
    // Si la carpeta data no existe, la creamos por si acaso
    if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
    
    fs.writeFileSync(usuariosDbPath, JSON.stringify([
        { id: 1, user: 'admin', pass: 'soporte123', rol: 'admin' }
    ], null, 2));
}

// === CONFIGURACIÓN DE SESIONES Y SEGURIDAD ===
app.use(session({
    secret: 'it-dashboard-secreto-2026',
    resave: false,
    saveUninitialized: false
}));

// El "Guardián" que revisa cada petición
app.use((req, res, next) => {
    // 1. Permitir acceso libre al login
    if (req.path === '/login.html' || req.path === '/api/login') return next();

    // 2. Si hay sesión activa
    if (req.session.usuario) {
        
        // Lista de páginas que SOLO el admin puede ver
        const paginasAdmin = ['/usuarios.html', '/inventario.html', '/glpi.html', '/instalaciones.html'];
        
        // Si es técnico e intenta entrar a una página de admin, lo pateamos al inicio
        if (req.session.rol !== 'admin' && paginasAdmin.includes(req.path)) {
            return res.redirect('/index.html'); 
        }
        
        return next(); 
    }

    // 3. Bloquear todo lo demás si no hay sesión
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'No autorizado' });
    res.redirect('/login.html');
});

// === RUTAS DE LOGIN Y LOGOUT ===
app.post('/api/login', (req, res) => {
    const { user, pass } = req.body;
    let usuarios = JSON.parse(fs.readFileSync(usuariosDbPath, 'utf-8'));
    
    // Buscar el usuario en la base de datos JSON
    const match = usuarios.find(u => u.user === user && u.pass === pass);
    
    if (match) { 
        req.session.usuario = match.user;
        req.session.rol = match.rol; // Guardamos si es "admin" o "tecnico"
        res.json({ success: true, rol: match.rol });
    } else {
        res.status(401).json({ success: false });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// === RUTA PARA OBTENER MIS DATOS DE SESIÓN ===
app.get('/api/me', (req, res) => {
    if (!req.session.usuario) return res.status(401).json({ error: 'No autorizado' });
    res.json({ user: req.session.usuario, rol: req.session.rol });
});

// === RUTAS DE GESTIÓN DE USUARIOS ===
app.get('/api/usuarios', (req, res) => {
    if (req.session.rol !== 'admin') return res.status(403).json([]);
    let usuarios = JSON.parse(fs.readFileSync(usuariosDbPath, 'utf-8'));
    // Devolvemos la lista pero sin las contraseñas por seguridad
    res.json(usuarios.map(u => ({ id: u.id, user: u.user, rol: u.rol }))); 
});

app.post('/api/usuarios', (req, res) => {
    if (req.session.rol !== 'admin') return res.status(403).json({error: 'Denegado'});
    const { user, pass, rol } = req.body;
    let usuarios = JSON.parse(fs.readFileSync(usuariosDbPath, 'utf-8'));
    
    // Evitar usuarios duplicados
    if(usuarios.some(u => u.user.toLowerCase() === user.toLowerCase())) {
        return res.status(400).json({error: 'El usuario ya existe'});
    }
    
    usuarios.push({ id: Date.now(), user, pass, rol });
    fs.writeFileSync(usuariosDbPath, JSON.stringify(usuarios, null, 2));
    res.json({ success: true });
});
app.put('/api/usuarios/:id', (req, res) => {
    if (req.session.rol !== 'admin') return res.status(403).json({error: 'Denegado'});
    
    const id = parseInt(req.params.id);
    const { user, pass, rol } = req.body;
    let usuarios = JSON.parse(fs.readFileSync(usuariosDbPath, 'utf-8'));
    
    const index = usuarios.findIndex(u => u.id === id);
    if (index === -1) return res.status(404).json({error: 'Usuario no encontrado'});

    // Evitar duplicados si le estás cambiando el nombre al usuario
    if (usuarios.some(u => u.user.toLowerCase() === user.toLowerCase() && u.id !== id)) {
        return res.status(400).json({error: 'El nombre de usuario ya está en uso por otra persona'});
    }

    // Evitar que tú mismo (como admin) te quites tu rol de administrador por accidente
    if (usuarios[index].user === req.session.usuario && rol !== 'admin') {
        return res.status(400).json({error: 'No puedes quitarte tu propio rol de administrador'});
    }

    // Actualizar datos
    usuarios[index].user = user;
    usuarios[index].rol = rol;
    // Solo actualizamos la contraseña si escribiste algo en el cuadro de texto
    if (pass && pass.trim() !== '') {
        usuarios[index].pass = pass;
    }

    fs.writeFileSync(usuariosDbPath, JSON.stringify(usuarios, null, 2));
    res.json({ success: true });
});

app.delete('/api/usuarios/:id', (req, res) => {
    if (req.session.rol !== 'admin') return res.status(403).json({error: 'Denegado'});
    const id = parseInt(req.params.id);
    let usuarios = JSON.parse(fs.readFileSync(usuariosDbPath, 'utf-8'));
    
    // Evitar que el admin se borre a sí mismo por accidente
    const usuarioABorrar = usuarios.find(u => u.id === id);
    if(usuarioABorrar && usuarioABorrar.user === req.session.usuario) {
        return res.status(400).json({error: 'No puedes borrar tu propia cuenta'});
    }

    usuarios = usuarios.filter(u => u.id !== id);
    fs.writeFileSync(usuariosDbPath, JSON.stringify(usuarios, null, 2));
    res.json({ success: true });
});

// (Asegúrate de que la línea `app.use(express.static(path.join(__dirname, 'public')));` siga estando aquí abajo)

// 👇 ASEGÚRATE DE QUE LA CARPETA PUBLIC ESTÉ DESPUÉS DEL GUARDIÁN 👇
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.static('public'));
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

// === RUTAS: INVENTARIO CUA ===
app.get('/api/inventario', (req, res) => {
    if (!fs.existsSync(dbPath)) return res.json([]);
    res.json(JSON.parse(fs.readFileSync(dbPath, 'utf-8')));
});
app.post('/api/upload', upload.single('archivo'), async (req, res) => {
    if (!req.file) return res.status(400).send('Falta el archivo.');
    try {
        let fileContent = fs.readFileSync(req.file.path, 'utf8');
        let lines = fileContent.split(/\r?\n/);
        if (lines[0] && lines[0].includes('ListSchema')) lines.shift(); 
        const jsonArray = await csv({ delimiter: ',', trim: true }).fromString(lines.join('\n'));
        fs.writeFileSync(dbPath, JSON.stringify(jsonArray, null, 2));
        fs.unlinkSync(req.file.path);
        res.json({ message: 'Inventario actualizado', data: jsonArray });
    } catch (error) { res.status(500).send('Error procesando CSV CUA'); }
});

// === RUTAS: GLPI ===
app.get('/api/glpi', (req, res) => {
    if (!fs.existsSync(glpiDbPath)) return res.json([]);
    res.json(JSON.parse(fs.readFileSync(glpiDbPath, 'utf-8')));
});
app.post('/api/upload-glpi', upload.single('archivo'), async (req, res) => {
    if (!req.file) return res.status(400).send('Falta el archivo.');
    try {
        const jsonArray = await csv({ delimiter: 'auto', trim: true }).fromFile(req.file.path);
        fs.writeFileSync(glpiDbPath, JSON.stringify(jsonArray, null, 2));
        fs.unlinkSync(req.file.path);
        res.json({ message: 'GLPI actualizado', data: jsonArray });
    } catch (error) { res.status(500).send('Error procesando CSV GLPI'); }
});

// === RUTAS: INSTALACIONES PENDIENTES ===
app.get('/api/instalaciones', (req, res) => {
    if (!fs.existsSync(instDbPath)) return res.json([]);
    res.json(JSON.parse(fs.readFileSync(instDbPath, 'utf-8')));
});

app.post('/api/upload-instalaciones', upload.single('archivo'), async (req, res) => {
    if (!req.file) return res.status(400).send('Falta el archivo.');
    try {
        let fileContent = fs.readFileSync(req.file.path, 'latin1');
        
        // ¡LA SOLUCIÓN MAGICA CONTRA LOS CUELGUES!
        // Eliminamos las comillas sueltas (ej: Monitor 24") que vuelven loco al sistema
        fileContent = fileContent.replace(/"/g, ''); 

        let lines = fileContent.split(/\r?\n/);
        
        // Limpiamos basura inicial (SharePoint, punto y comas sueltos o comas)
        while (lines.length > 0 && (
            lines[0].includes('ListSchema') || 
            lines[0].startsWith(';') || 
            lines[0].startsWith(',') || 
            lines[0].trim() === ''
        )) {
            lines.shift();
        } 
        
        // Limpiamos basura final (saltos de línea vacíos que deja Excel al final)
        while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
            lines.pop();
        }

        const jsonArray = await csv({ 
            delimiter: 'auto', // Volvemos a auto para que sea más inteligente
            trim: true,
            ignoreEmpty: true
        }).fromString(lines.join('\n'));
        
        fs.writeFileSync(instDbPath, JSON.stringify(jsonArray, null, 2));
        fs.unlinkSync(req.file.path);
        res.json({ message: 'Instalaciones actualizadas', data: jsonArray });
    } catch (error) { 
        console.error("Error en instalaciones:", error);
        res.status(500).send('Error procesando CSV'); 
    }
});

// === RUTAS: FALLAS AVAYA ===
app.get('/api/avaya', (req, res) => {
    if (!fs.existsSync(avayaDbPath)) return res.json([]);
    res.json(JSON.parse(fs.readFileSync(avayaDbPath, 'utf-8')));
});
app.post('/api/avaya', (req, res) => {
    const { mac, falla, tecnico } = req.body; 
    let data = fs.existsSync(avayaDbPath) ? JSON.parse(fs.readFileSync(avayaDbPath, 'utf-8')) : [];
    const newEntry = {
        id: Date.now(), mac, falla: falla.substring(0, 100), tecnico,
        fecha: new Date().toLocaleString('es-CL'), enviado: false
    };
    data.push(newEntry);
    fs.writeFileSync(avayaDbPath, JSON.stringify(data, null, 2));
    res.json(newEntry);
});
app.delete('/api/avaya/:id', (req, res) => {
    const id = parseInt(req.params.id);
    if (!fs.existsSync(avayaDbPath)) return res.json({ success: false });
    let data = JSON.parse(fs.readFileSync(avayaDbPath, 'utf-8'));
    fs.writeFileSync(avayaDbPath, JSON.stringify(data.filter(item => item.id !== id), null, 2));
    res.json({ success: true });
});
app.post('/api/avaya/marcar-enviados', (req, res) => {
    if (!fs.existsSync(avayaDbPath)) return res.json([]);
    let data = JSON.parse(fs.readFileSync(avayaDbPath, 'utf-8'));
    data = data.map(item => ({ ...item, enviado: true }));
    fs.writeFileSync(avayaDbPath, JSON.stringify(data, null, 2));
    res.json({ message: 'Marcados como enviados' });
});

// === RUTAS: STOCK AVAYA (NUEVOS) ===
app.get('/api/avaya-nuevos', (req, res) => {
    if (!fs.existsSync(avayaNuevosDbPath)) return res.json([]);
    res.json(JSON.parse(fs.readFileSync(avayaNuevosDbPath, 'utf-8')));
});
app.post('/api/avaya-nuevos', (req, res) => {
    const { mac, tecnico, ticket, utilizado } = req.body; 
    let data = fs.existsSync(avayaNuevosDbPath) ? JSON.parse(fs.readFileSync(avayaNuevosDbPath, 'utf-8')) : [];
    const newEntry = {
        id: Date.now(), mac, tecnico: tecnico || 'N/A', ticket: ticket || 'N/A', utilizado,
        fecha: new Date().toLocaleString('es-CL')
    };
    data.push(newEntry);
    fs.writeFileSync(avayaNuevosDbPath, JSON.stringify(data, null, 2));
    res.json(newEntry);
});
app.delete('/api/avaya-nuevos/:id', (req, res) => {
    const id = parseInt(req.params.id);
    if (!fs.existsSync(avayaNuevosDbPath)) return res.json({ success: false });
    let data = JSON.parse(fs.readFileSync(avayaNuevosDbPath, 'utf-8'));
    fs.writeFileSync(avayaNuevosDbPath, JSON.stringify(data.filter(item => item.id !== id), null, 2));
    res.json({ success: true });
});
// Bases de datos para Bodega
const devolucionesDbPath = path.join(__dirname, 'data', 'devoluciones.json');
const recepcionesDbPath = path.join(__dirname, 'data', 'recepciones.json');

// === RUTAS: DEVOLUCIONES A BODEGA ===
app.get('/api/devoluciones', (req, res) => {
    if (!fs.existsSync(devolucionesDbPath)) return res.json([]);
    res.json(JSON.parse(fs.readFileSync(devolucionesDbPath, 'utf-8')));
});
app.post('/api/devoluciones', (req, res) => {
    const { tecnico, equipo, serie, motivo } = req.body; 
    let data = fs.existsSync(devolucionesDbPath) ? JSON.parse(fs.readFileSync(devolucionesDbPath, 'utf-8')) : [];
    const newEntry = {
        id: Date.now(), tecnico, equipo, serie, motivo, 
        fecha: new Date().toLocaleString('es-CL'), enviado: false
    };
    data.push(newEntry);
    fs.writeFileSync(devolucionesDbPath, JSON.stringify(data, null, 2));
    res.json(newEntry);
});
app.delete('/api/devoluciones/:id', (req, res) => {
    const id = parseInt(req.params.id);
    if (!fs.existsSync(devolucionesDbPath)) return res.json({ success: false });
    let data = JSON.parse(fs.readFileSync(devolucionesDbPath, 'utf-8'));
    fs.writeFileSync(devolucionesDbPath, JSON.stringify(data.filter(item => item.id !== id), null, 2));
    res.json({ success: true });
});
app.post('/api/devoluciones/marcar-enviados', (req, res) => {
    if (!fs.existsSync(devolucionesDbPath)) return res.json([]);
    let data = JSON.parse(fs.readFileSync(devolucionesDbPath, 'utf-8'));
    data = data.map(item => ({ ...item, enviado: true }));
    fs.writeFileSync(devolucionesDbPath, JSON.stringify(data, null, 2));
    res.json({ message: 'Marcados como enviados' });
});

// === RUTAS: RECEPCIONES DESDE BODEGA ===
app.get('/api/recepciones', (req, res) => {
    if (!fs.existsSync(recepcionesDbPath)) return res.json([]);
    res.json(JSON.parse(fs.readFileSync(recepcionesDbPath, 'utf-8')));
});
app.post('/api/recepciones', (req, res) => {
    const { tecnico, equipo, serie, ticket } = req.body; 
    let data = fs.existsSync(recepcionesDbPath) ? JSON.parse(fs.readFileSync(recepcionesDbPath, 'utf-8')) : [];
    const newEntry = {
        id: Date.now(), tecnico, equipo, serie, ticket: ticket || 'S/T', 
        fecha: new Date().toLocaleString('es-CL')
    };
    data.push(newEntry);
    fs.writeFileSync(recepcionesDbPath, JSON.stringify(data, null, 2));
    res.json(newEntry);
});
app.delete('/api/recepciones/:id', (req, res) => {
    const id = parseInt(req.params.id);
    if (!fs.existsSync(recepcionesDbPath)) return res.json({ success: false });
    let data = JSON.parse(fs.readFileSync(recepcionesDbPath, 'utf-8'));
    fs.writeFileSync(recepcionesDbPath, JSON.stringify(data.filter(item => item.id !== id), null, 2));
    res.json({ success: true });
});

// === RUTAS PARA EDITAR REGISTROS (PUT) ===
app.put('/api/avaya/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!fs.existsSync(avayaDbPath)) return res.json({ success: false });
        let data = JSON.parse(fs.readFileSync(avayaDbPath, 'utf-8'));
        const index = data.findIndex(item => item.id === id);
        if (index !== -1) {
            data[index] = { ...data[index], ...req.body };
            fs.writeFileSync(avayaDbPath, JSON.stringify(data, null, 2));
            res.json({ success: true });
        } else res.json({ success: false });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.put('/api/devoluciones/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!fs.existsSync(devolucionesDbPath)) return res.json({ success: false });
        let data = JSON.parse(fs.readFileSync(devolucionesDbPath, 'utf-8'));
        const index = data.findIndex(item => item.id === id);
        if (index !== -1) {
            data[index] = { ...data[index], ...req.body };
            fs.writeFileSync(devolucionesDbPath, JSON.stringify(data, null, 2));
            res.json({ success: true });
        } else res.json({ success: false });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.put('/api/recepciones/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!fs.existsSync(recepcionesDbPath)) return res.json({ success: false });
        let data = JSON.parse(fs.readFileSync(recepcionesDbPath, 'utf-8'));
        const index = data.findIndex(item => item.id === id);
        if (index !== -1) {
            data[index] = { ...data[index], ...req.body };
            fs.writeFileSync(recepcionesDbPath, JSON.stringify(data, null, 2));
            res.json({ success: true });
        } else res.json({ success: false });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.listen(PORT, () => console.log(`Servidor de inventario corriendo en http://localhost:${PORT}`));