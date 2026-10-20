import { createClient } from "@supabase/supabase-js";
import "./style.css";

// La URL y la llave se leen de .env al iniciar o construir la aplicación.
const supabase = createClient(
  import.meta.env.SUPABASE_URL,
  import.meta.env.SUPABASE_PUBLISHABLE_KEY,
);

const formulario = document.querySelector("#registro");
const boton = formulario.querySelector("button");
const estado = document.querySelector("#estado");
const filas = document.querySelector("#registros tbody");

// 2026-10-19 → 19/10/2026
const formatoFecha = (fecha) => fecha.split("-").reverse().join("/");

function mostrar(registros) {
  filas.replaceChildren();
  if (registros.length === 0) {
    const celda = filas.insertRow().insertCell();
    celda.colSpan = 5;
    celda.textContent = "🌱 Todavía no hay registros. ¡Guarda el primero!";
    return;
  }
  for (const r of registros) {
    const fila = filas.insertRow();
    for (const valor of [formatoFecha(r.fecha), r.parcela, r.cultivo, r.actividad, r.observaciones ?? ""]) {
      fila.insertCell().textContent = valor;
    }
  }
}

// Consultar los registros
async function consultar() {
  const { data, error } = await supabase
    .from("registros")
    .select("*")
    .order("fecha", { ascending: false });
  if (error) {
    console.error(error);
    estado.textContent = "No se pudieron cargar los registros.";
    estado.dataset.tipo = "error";
    return;
  }
  mostrar(data);
}

// Guardar un registro
async function guardar(evento) {
  evento.preventDefault();
  const { fecha, parcela, cultivo, actividad, observaciones } = Object.fromEntries(new FormData(formulario));

  boton.disabled = true;
  estado.textContent = "";
  delete estado.dataset.tipo;
  const { error } = await supabase
    .from("registros")
    .insert({ fecha, parcela, cultivo, actividad, observaciones });
  boton.disabled = false;

  if (error) {
    console.error(error);
    estado.textContent = "No se pudo guardar el registro.";
    estado.dataset.tipo = "error";
    return;
  }
  estado.textContent = "Registro guardado.";
  estado.dataset.tipo = "ok";
  formulario.observaciones.value = "";
  consultar();
}

// Fecha de hoy, en la zona horaria de la computadora.
formulario.fecha.value = new Date().toLocaleDateString("en-CA");
formulario.addEventListener("submit", guardar);
consultar();
