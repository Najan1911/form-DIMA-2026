import { createClient } from "@supabase/supabase-js";
import "./style.css";

// La URL y la llave se leen de .env al iniciar o construir la aplicación.
const supabase = createClient(
  import.meta.env.SUPABASE_URL,
  import.meta.env.SUPABASE_PUBLISHABLE_KEY,
);

// Cada cuántos milisegundos se vuelven a consultar los registros.
const INTERVALO = 20000;

const formulario = document.querySelector("#registro");
const boton = document.querySelector("#guardar");
const estado = document.querySelector("#estado");
const lista = document.querySelector("#lista");
const vacio = document.querySelector("#vacio");
const filtros = document.querySelector("#filtros");
const vivo = document.querySelector("#vivo");
const botonActualizar = document.querySelector("#actualizar");

const EMOJI_CULTIVO = { "Maíz": "🌽", "Frijol": "🫘", "Haba": "🫛", "Avena": "🌾" };
const COLOR_CULTIVO = { "Maíz": "ambar", "Frijol": "coral", "Haba": "verde", "Avena": "violeta" };
const EMOJI_ACTIVIDAD = { "Observación": "👀", "Riego": "💧", "Fertilización": "🌱", "Muestreo": "🔬" };
const COLOR_ACTIVIDAD = { "Observación": "violeta", "Riego": "azul", "Fertilización": "verde", "Muestreo": "ambar" };

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

let registros = [];
let filtro = "Todos";
let ultimaCarga = null;
let cargando = false;
let idsConocidos = new Set();
let primeraCarga = true;
let primerPintado = true;

// Compara sin acentos ni mayúsculas, para que "fertilizacion" y "Fertilización" sean lo mismo.
const normalizar = (texto) =>
  String(texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Busca el valor del diccionario que corresponde al texto guardado en la base.
function claveDe(diccionario, valor) {
  return Object.keys(diccionario).find((clave) => normalizar(clave) === normalizar(valor));
}

const emojiCultivo = (cultivo) => EMOJI_CULTIVO[claveDe(EMOJI_CULTIVO, cultivo)] ?? "🌿";
const colorCultivo = (cultivo) => COLOR_CULTIVO[claveDe(COLOR_CULTIVO, cultivo)] ?? "verde";
const emojiActividad = (actividad) => EMOJI_ACTIVIDAD[claveDe(EMOJI_ACTIVIDAD, actividad)] ?? "📌";
const colorActividad = (actividad) => COLOR_ACTIVIDAD[claveDe(COLOR_ACTIVIDAD, actividad)] ?? "neutro";

// 2026-10-19 → 19 oct 2026
function formatoFecha(fecha) {
  const [anio, mes, dia] = String(fecha).split("-");
  const nombreMes = MESES[Number(mes) - 1];
  return nombreMes ? `${Number(dia)} ${nombreMes} ${anio}` : String(fecha);
}

// Marca de tiempo → "hace 5 min"
function haceCuanto(marca) {
  const tiempo = new Date(marca).getTime();
  if (!Number.isFinite(tiempo)) return "";
  const segundos = Math.max(0, Math.round((Date.now() - tiempo) / 1000));
  if (segundos < 45) return "hace un momento";
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.round(horas / 24)} d`;
}

const crear = (etiqueta, clase, texto) => {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== undefined) nodo.textContent = texto;
  return nodo;
};

// ── Tarjeta de un registro ──
function tarjetaRegistro(registro, animar) {
  const articulo = crear("article", "registro");
  articulo.dataset.color = colorActividad(registro.actividad);

  // Solo se anima lo que es nuevo; así la lista no "parpadea" al refrescarse sola.
  if (!idsConocidos.has(registro.id)) {
    articulo.classList.add("nuevo");
    if (!primerPintado) articulo.classList.add("entra");
  } else if (animar) {
    articulo.classList.add("entra");
  }

  const cabecera = crear("header", "registro-top");
  cabecera.append(
    crear("span", "chip chip--fecha", `📅 ${formatoFecha(registro.fecha)}`),
    crear("span", "etiqueta", `${emojiActividad(registro.actividad)} ${registro.actividad ?? "Sin actividad"}`),
  );

  const parcela = crear("h3", "registro-parcela", `📍 ${registro.parcela ?? "Sin parcela"}`);

  const cultivo = crear("span", `chip chip--${colorCultivo(registro.cultivo)}`, `${emojiCultivo(registro.cultivo)} ${registro.cultivo ?? "Sin cultivo"}`);
  const observaciones = registro.observaciones?.trim();
  const texto = crear("p", observaciones ? "registro-obs" : "registro-obs registro-obs--vacio", observaciones || "Sin observaciones");

  const pie = crear("footer", "registro-pie", `🕒 Guardado ${haceCuanto(registro.creado)}`);

  articulo.append(cabecera, parcela, cultivo, texto, pie);
  return articulo;
}

// ── Filtros por actividad ──
function pintarFiltros() {
  const actividades = [...new Set(registros.map((r) => r.actividad).filter(Boolean))];
  filtros.replaceChildren();

  const opciones = [["Todos", "🌈", "neutro"], ...actividades.map((a) => [a, emojiActividad(a), colorActividad(a)])];
  for (const [nombre, emoji, color] of opciones) {
    const botonFiltro = crear("button", "filtro", `${emoji} ${nombre}`);
    botonFiltro.type = "button";
    botonFiltro.dataset.color = color;
    botonFiltro.setAttribute("aria-pressed", String(filtro === nombre));
    botonFiltro.addEventListener("click", () => {
      filtro = nombre;
      pintar();
    });
    filtros.append(botonFiltro);
  }
  filtros.hidden = actividades.length === 0;
}

// ── Lista, contadores y resumen ──
function pintar() {
  const visibles = filtro === "Todos" ? registros : registros.filter((r) => r.actividad === filtro);

  lista.replaceChildren(...visibles.map((registro) => tarjetaRegistro(registro, !primerPintado)));
  vacio.hidden = visibles.length > 0;
  lista.hidden = visibles.length === 0;

  document.querySelector("#contador").textContent = String(visibles.length);
  document.querySelector("#total-registros").textContent = String(registros.length);
  document.querySelector("#total-parcelas").textContent = String(new Set(registros.map((r) => r.parcela)).size);
  document.querySelector("#total-cultivos").textContent = String(new Set(registros.map((r) => r.cultivo)).size);

  const fechas = registros.map((r) => r.fecha).filter(Boolean).sort();
  document.querySelector("#ultima-fecha").textContent = fechas.length ? formatoFecha(fechas.at(-1)).replace(/ \d{4}$/, "") : "—";

  document.querySelector("#resumen-registros").textContent = registros.length === 0
    ? "Aún no hay actividades"
    : filtro === "Todos"
      ? `${registros.length} ${registros.length === 1 ? "actividad guardada" : "actividades guardadas"}`
      : `${visibles.length} de ${registros.length} · ${filtro}`;

  pintarFiltros();
  actualizarReloj();
  idsConocidos = new Set(registros.map((r) => r.id));
  primerPintado = false;
}

// ── Texto del indicador "actualizado hace…" ──
function actualizarReloj() {
  if (cargando) {
    vivo.textContent = "🔄 Actualizando…";
    vivo.dataset.tipo = "cargando";
    return;
  }
  if (!ultimaCarga) {
    vivo.textContent = "🔄 Cargando registros…";
    vivo.dataset.tipo = "cargando";
    return;
  }
  const segundos = Math.round((Date.now() - ultimaCarga) / 1000);
  vivo.textContent = segundos < 5 ? "🟢 Al día" : `🟢 Al día · hace ${segundos} s`;
  vivo.dataset.tipo = "ok";
}

// ── Consultar los registros ──
async function consultar({ silencioso = false } = {}) {
  if (cargando) return;
  cargando = true;
  if (!silencioso) actualizarReloj();

  const { data, error } = await supabase
    .from("registros")
    .select("*")
    .order("fecha", { ascending: false })
    .order("id", { ascending: false });

  cargando = false;

  if (error) {
    console.error(error);
    vivo.textContent = "⚠️ No se pudo conectar";
    vivo.dataset.tipo = "error";
    if (!silencioso || primeraCarga) {
      estado.textContent = "😕 No se pudieron cargar los registros. Revisa tu conexión.";
      estado.dataset.tipo = "error";
    }
    primeraCarga = false;
    return;
  }

  const habia = registros.length;
  registros = data ?? [];
  primeraCarga = false;

  if (habia > 0 && registros.length > habia) {
    vivo.textContent = "✨ Nuevos registros";
    vivo.dataset.tipo = "nuevo";
  }

  ultimaCarga = Date.now();
  pintar();
}

// ── Guardar un registro ──
async function guardar(evento) {
  evento.preventDefault();
  const { fecha, parcela, cultivo, actividad, observaciones } = Object.fromEntries(new FormData(formulario));

  boton.disabled = true;
  boton.textContent = "⏳ Guardando…";
  estado.textContent = "";
  delete estado.dataset.tipo;

  const { error } = await supabase
    .from("registros")
    .insert({ fecha, parcela, cultivo, actividad, observaciones });

  boton.disabled = false;
  boton.textContent = "💾 Guardar registro";

  if (error) {
    console.error(error);
    estado.textContent = "😕 No se pudo guardar el registro. Intenta de nuevo.";
    estado.dataset.tipo = "error";
    return;
  }

  estado.textContent = "🎉 ¡Registro guardado! Ya aparece en la lista.";
  estado.dataset.tipo = "ok";
  formulario.observaciones.value = "";
  filtro = "Todos";
  await consultar({ silencioso: true });
}

// ── Arranque ──
formulario.fecha.value = new Date().toLocaleDateString("en-CA");
formulario.addEventListener("submit", guardar);
botonActualizar.addEventListener("click", () => consultar());
consultar();

// Se refresca sola cada 20 s, sin gastar datos cuando la pestaña está oculta.
setInterval(() => {
  if (!document.hidden) consultar({ silencioso: true });
}, INTERVALO);

setInterval(actualizarReloj, 1000);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) consultar({ silencioso: true });
});
