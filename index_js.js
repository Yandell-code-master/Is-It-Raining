let temporizador = null;
let temporizadorMensaje = null;
let yaAvisado = false;
const UMBRAL_PROBABILIDAD = 50; // % de probabilidad para avisar
const UMBRAL_MM = 0.2;          // milímetros de lluvia para avisar
const CADA_MINUTOS = 10;
const MS_RESULTADO = 60 * 1000; // tiempo que se muestra el resultado antes de "Vigilando..."


function obtenerUbicacion() {

    // Creamos una promesa que tiene por dentro una función que devuelve ya sea la ubicación del usuario o un error segun sea el caso
    /* La función que le pasamos a el constructor de la promesa es un tipo de función llamada el ejecutador, esta función la ejecuta js por detras, y el 
    le pasa los parametros

    Es interesant ver como en vez de pasarle los atributos por parametros a la promesa lo que hacemos es pasarle un función que al estar dentro de el objeto
    puede modificar su estado entonces de esa forma podemos modificar varios datos pasando solamente un parametro y el codigo es mas compacto*/
    return new Promise((resolve, reject) => {

        // Obtenemos la latitud y longitud de los inputs del usuario
        const lat = parseFloat(document.getElementById('lat').value);
        const lon = parseFloat(document.getElementById('lon').value);

        // Comprobamos que sean valores numéricos y si lo son los devolvemos
        if (!isNaN(lat) && !isNaN(lon)) return resolve({ lat, lon });

        // Comprobamos si el navegador soporta geolocalización, si no lo hace devolvemos un error.
        if (!navigator.geolocation) return reject(new Error('Sin geolocalización'));
        
        // Esto manda el mensaje al usuario pidiéndole permiso para obtener su ubicación y si lo acepta devuelve la latitud y longitud
        /* Aquì se le dice al navegador que obtenga la ubicaciòn y que ejecute una de estas dos funciones dependiendo de si lo logrò o no */
        navigator.geolocation.getCurrentPosition(
            p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
            () => reject(new Error('No pude obtener tu ubicación. Escribe las coordenadas a mano.'))
        );
    });
}

/* Cuando decimos que una función es asincrona significa que esta funcion puede no completarse de forma inmediata sino que puede llevarse su tiempo, pero al decir que la 
puede tardar un tiempo la funciòn en vez de devovler el valor en ese instante lo que hace dar una promesa de que el valor si llegarà*/
async function revisar() {
    const estado = document.getElementById('estado');
    const detalle = document.getElementById('detalle');

    clearTimeout(temporizadorMensaje);
    estado.className = '';
    estado.textContent = 'Revisando...';

    try {
        const { lat, lon } = await obtenerUbicacion();
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
            + `&minutely_15=precipitation&hourly=precipitation_probability&current=precipitation`
            + `&forecast_hours=2&forecast_minutely_15=8&timezone=auto`;
        const apiResponse = await fetch(url);
        const d = await apiResponse.json();

        // Si se pulsó "Detener" mientras se consultaba, no sobrescribir el mensaje.
        if (!temporizador) return;

        const ahora = d.current ? d.current.precipitation : 0;
        const mmProximos = (d.minutely_15 ? d.minutely_15.precipitation : []).reduce((a, b) => a + (b || 0), 0);
        const probs = d.hourly ? d.hourly.precipitation_probability : [];
        const probMax = probs.length ? Math.max(...probs.slice(0, 2)) : 0;

        const lloviendo = ahora > 0;
        const vaALlover = mmProximos >= UMBRAL_MM || probMax >= UMBRAL_PROBABILIDAD;

        if (lloviendo || vaALlover) {
            estado.className = 'lluvia';
            estado.textContent = lloviendo ? '🌧️ ¡Está lloviendo! Mete la ropa.' : '⚠️ Va a llover pronto. ¡Mete la ropa!';
            if (!yaAvisado) { avisar(estado.textContent); yaAvisado = true; }
        } else {
            estado.className = 'seco';
            estado.textContent = '☀️ Sin lluvia cercana. La ropa está tranquila.';
            yaAvisado = false; // se reinicia para avisar en la próxima lluvia
        }
        detalle.textContent = `Ubicación: ${lat.toFixed(2)}, ${lon.toFixed(2)} · Prob. máx. próxima hora: ${probMax}% · Lluvia esperada: ${mmProximos.toFixed(1)} mm · Última revisión: ${new Date().toLocaleTimeString()}`;
        programarVigilando();
    } catch (e) {
        if (!temporizador) return;
        estado.className = '';
        estado.textContent = 'Error: ' + e.message;
        programarVigilando();
    }
}


function programarVigilando() {
    clearTimeout(temporizadorMensaje);
    if (!temporizador) return;
    temporizadorMensaje = setTimeout(mostrarVigilando, MS_RESULTADO);
}

function mostrarVigilando() {
    if (!temporizador) return;
    const estado = document.getElementById('estado');
    estado.className = 'vigilando';
    estado.textContent = 'Vigilando · te avisaremos si hay cambios.';
}



function avisar(texto) {
    if (Notification.permission === 'granted') new Notification('🧺 Alerta de lluvia', { body: texto });
    try {
        const contexto = new (window.AudioContext || window.webkitAudioContext)();
        const o = contexto.createOscillator();
        o.connect(contexto.destination);
        o.frequency.value = 880;
        o.start();
        setTimeout(() => o.stop(), 700);
    } catch (e) { }
}

async function activar() {
    if ('Notification' in window && Notification.permission !== 'granted') {
        await Notification.requestPermission();
    }
    
    yaAvisado = false;

    // si temporizador es null entonce clearInverval no hace nada y puede ser null la primera vez que se llama a activar
    clearInterval(temporizador);
    clearTimeout(temporizadorMensaje);

    // Se arranca el intervalo antes de revisar para que revisar sepa que la vigilancia está activa
    temporizador = setInterval(revisar, CADA_MINUTOS * 60 * 1000);
    revisar();
}

function detener() {
    clearInterval(temporizador);
    clearTimeout(temporizadorMensaje);
    temporizador = null;
    temporizadorMensaje = null;
    document.getElementById('estado').className = '';
    document.getElementById('estado').textContent = 'Vigilancia detenida.';
}
