import os
import pandas as pd
import numpy as np  # Agregado: Necesario para np.where en la condición PEP
from pymongo import MongoClient
from dotenv import load_dotenv
import json
from bson import ObjectId
from datetime import datetime, timezone

# Cargar variables de entorno desde el archivo .env
load_dotenv()

# Configuración de la conexión a MongoDB
MONGO_URI = os.getenv("MONGO_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME", "sistema_prevencion")

client = MongoClient(MONGO_URI)
db = client[DATABASE_NAME]

# Definición de las colecciones que actúan como catálogos de riesgo
# Nota: Asegúrate de definir esta lista 'colecciones' previamente en tu flujo real.
colecciones = [
    "paises", "nacionalidad", "divisa", "actividad-economica", 
    "tipo-persona", "origen-recursos", "detino-recursos", 
    "producto-servicio-sencible", "entidad-federativa"
]

# Carga masiva de catálogos desde MongoDB a DataFrames de Pandas
dataframes = {}
for nombre in colecciones:
    dataframes[nombre] = pd.DataFrame(list(db[nombre].find()))
    print(f"✓ {nombre}: {len(dataframes[nombre])} documentos")

# Carga de la colección principal que contiene los expedientes de clientes
dataframe_onboarding = pd.DataFrame(list(db["onboarding"].find()))

# Mapeo y asignación de catálogos a variables legibles
cat_paises               = dataframes["paises"]
cat_nacionalidad         = dataframes["nacionalidad"]
cat_divisa               = dataframes["divisa"]
cat_actividad_economica  = dataframes["actividad-economica"]
cat_tipo_persona         = dataframes["tipo-persona"]
cat_origen_recursos       = dataframes["origen-recursos"]
car_destino_recursos     = dataframes["detino-recursos"] # Ojo con el typo en la colección "detino-recursos"
cat_producto_servicio    = dataframes["producto-servicio-sencible"] # Ojo con el typo "sencible"
cat_entidad_federativa   = dataframes["entidad-federativa"]

## -----------------------------------------------------------------------------
## PONDERACIONES DE LA MATRIZ DE RIESGO
## Representan el peso relativo (porcentaje) de cada factor sobre el riesgo total.
## -----------------------------------------------------------------------------
PONDERACIONES = {
    "pais_nacionalidad":     0.05,
    "pais_residencia":       0.08,
    "pais_origen_recursos":  0.08,
    "pais_destino_recursos": 0.08,
    "nacionalidad":          0.08,
    "actividad_economica":   0.08,
    "tipo_persona":          0.05,
    "origen_recursos":       0.04,
    "destino_recursos":      0.02,
    "producto_servicio":     0.05,
    "entidad_federativa":    0.08,
}

# -----------------------------------------------------------------------------
# DICCIONARIOS DE MAPEO (LOOKUP TABLES)
# Transforman los códigos/claves directamente al score base asignado en la matriz.
# -----------------------------------------------------------------------------
map_paises                 = dict(zip(cat_paises["clave_pais"], cat_paises["score_pais"]))
map_paises_residencia      = dict(zip(cat_paises["clave_pais"], cat_paises["score_presidencia"]))
map_paises_origen_recursos = dict(zip(cat_paises["clave_pais"], cat_paises["score_pais_origen_recursos"]))
map_paises_destino_recursos= dict(zip(cat_paises["clave_pais"], cat_paises["score_pais_destino_recursos"]))

map_nacionalidad           = dict(zip(cat_nacionalidad["clave_nacionalidad"], cat_nacionalidad["score_nacionalidad"]))

# Estructura de mapeo especial con tupla (tipo_persona, actividad) para manejar la lógica compuesta
map_actividad = {
    (str(row["clave_tipopersona"]), str(row["clave_acteconomica"])): row["score_acteconomica"]
    for _, row in cat_actividad_economica.iterrows()
}

map_tipo_persona           = dict(zip(cat_tipo_persona["clave_tipopersona"], cat_tipo_persona["score_tper"]))
map_origen_recursos        = dict(zip(cat_origen_recursos["clave_origrecursos"], cat_origen_recursos["score_origrecursos"]))
map_destino_recursos       = dict(zip(car_destino_recursos["clave_desrecursos"], car_destino_recursos["score_desrecursos"]))
map_producto               = dict(zip(cat_producto_servicio["clave_prodser"], cat_producto_servicio["score_prodser"]))
map_entidad                = dict(zip(cat_entidad_federativa["clave_entidadfederativa"], cat_entidad_federativa["score_entidadfederativa"]))

# El valor máximo sobre el cual se normaliza el score (Escala de 1 a 5)
SCORE_MAXIMO = 5


## =============================================================================
## FUNCIONES DE CÁLCULO DE SCORES MATRICIALES
## Nota metodológica general: 
## Fórmula aplicada = (Score Base del Catálogo * Ponderación del Factor) / SCORE_MAXIMO
## =============================================================================

def calcular_score_tipo_persona(df):
    """Calcula el score ponderado según el tipo de persona (Física/Moral)."""
    df["score_tipo_persona"] = (
        df["clave_tipopersona"]
        .map(map_tipo_persona)
        .fillna(0)
        .mul(PONDERACIONES["tipo_persona"])
        .div(SCORE_MAXIMO)
    )
    return df["score_tipo_persona"]


def calcular_score_actividad_economica(df):
    """
    Calcula el score ponderado para la actividad económica.
    Utiliza una llave compuesta basada en (tipo_persona, actividad) debido a que 
    el riesgo de una actividad puede variar según la naturaleza jurídica.
    """
    df["score_actividad_economica"] = (
        df.apply(
            lambda row: map_actividad.get(
                (str(row["clave_tipopersona"]), str(row["clave_acteconomica"])),
                0  # Retorna score 0 si no se encuentra coincidencia en la matriz
            ), axis=1
        )
        .mul(PONDERACIONES["actividad_economica"])
        .div(SCORE_MAXIMO)
    )
    return df["score_actividad_economica"]


def calcular_score_pais_nacionalidad(df):
    """Calcula el score ponderado por el riesgo asociado al país de origen de la nacionalidad."""
    df["score_pais_nacionalidad"] = (
        df["clave_pais_nacionalidad"]
        .map(map_paises)
        .fillna(0)
        .mul(PONDERACIONES["pais_nacionalidad"])
        .div(SCORE_MAXIMO)
    )
    return df["score_pais_nacionalidad"]


def calcular_score_pais_residencia(df):
    """Calcula el score ponderado según el riesgo del país de residencia del cliente."""
    df["score_pais_residencia"] = (
        df["clave_pais_residencia"]
        .map(map_paises_residencia)
        .fillna(0)
        .mul(PONDERACIONES["pais_residencia"])
        .div(SCORE_MAXIMO)
    )
    return df["score_pais_residencia"]


def calcular_score_pais_origen_recursos(df):
    """Calcula el score ponderado del país desde donde se originan los fondos/recursos."""
    df["score_pais_origen_recursos"] = (
        df["clave_pais_origen_recursos"]
        .map(map_paises_origen_recursos)
        .fillna(0)
        .mul(PONDERACIONES["pais_origen_recursos"])
        .div(SCORE_MAXIMO)
    )
    return df["score_pais_origen_recursos"]


def calcular_score_pais_destino_recursos(df):
    """Calcula el score ponderado del país que recibirá los fondos/recursos."""
    df["score_pais_destino_recursos"] = (
        df["clave_pais_destino_recursos"]
        .map(map_paises_destino_recursos)
        .fillna(0)
        .mul(PONDERACIONES["pais_destino_recursos"])
        .div(SCORE_MAXIMO)
    )
    return df["score_pais_destino_recursos"]


def calcular_score_nacionalidad(df):
    """Calcula el score ponderado de la nacionalidad declarada por el usuario."""
    df["score_nacionalidad"] = (
        df["clave_nacionalidad"]
        .map(map_nacionalidad)
        .fillna(0)
        .mul(PONDERACIONES["nacionalidad"])
        .div(SCORE_MAXIMO)
    )
    return df["score_nacionalidad"]


def calcular_score_origen_recursos(df):
    """Calcula el score ponderado según la naturaleza del origen de los recursos (ej. nómina, ahorros)."""
    df["score_origen_recursos"] = (
        df["clave_origrecursos"]
        .map(map_origen_recursos)
        .fillna(0)
        .mul(PONDERACIONES["origen_recursos"])
        .div(SCORE_MAXIMO)
    )
    return df["score_origen_recursos"]


def calcular_score_destino_recursos(df):
    """Calcula el score ponderado según el destino que se le dará a los recursos en la cuenta."""
    df["score_destino_recursos"] = (
        df["clave_desrecursos"]
        .map(map_destino_recursos)
        .fillna(0)
        .mul(PONDERACIONES["destino_recursos"])
        .div(SCORE_MAXIMO)
    )
    return df["score_destino_recursos"]


def calcular_score_producto_servicio(df):
    """Calcula el score ponderado según el nivel de sensibilidad del producto/servicio contratado."""
    df["score_producto_servicio"] = (
        df["clave_prodser"]
        .map(map_producto)
        .fillna(0)
        .mul(PONDERACIONES["producto_servicio"])
        .div(SCORE_MAXIMO)
    )
    return df["score_producto_servicio"]


def calcular_score_entidad_federativa(df):
    """Calcula el score ponderado por riesgo geográfico estatal o provincial interno."""
    df["score_entidad_federativa"] = (
        df["clave_entidadfederativa"]
        .map(map_entidad)
        .fillna(0)
        .mul(PONDERACIONES["entidad_federativa"])
        .div(SCORE_MAXIMO)
    )
    return df["score_entidad_federativa"]


def score_edad_constitucion(df, clave_tper, feca_constitucion):
    """
    Calcula la base de score según la edad de la persona física o antigüedad de la persona moral.
    
    Parámetros:
    - df: DataFrame en evaluación.
    - clave_tper: Nombre de la columna de tipo de persona.
    - feca_constitucion: Nombre de la columna con la fecha de nacimiento o constitución.
    """
    fecha_constitucion = pd.to_datetime(df[feca_constitucion], errors='coerce')
    fecha_actual = pd.to_datetime("today")
    # Se calcula la diferencia en años basándose en años bisiestos estándar (365.25 días)
    edad_constitucion = (fecha_actual - fecha_constitucion).dt.days / 365.25

    # Lógica para Personas Físicas (Ej: 1 = Física, 2 = Física con Actividad Empresarial)
    # Corrección: Se requiere pasar una lista `.isin([1, 2])` en Pandas
    if df[clave_tper].isin([1, 2]).any():
        if edad_constitucion < 18:
            return 0
        elif edad_constitucion < 24:
            return 3
        elif edad_constitucion < 36:
            return 1
        elif edad_constitucion < 46:
            return 1
        elif edad_constitucion < 61:
            return 1
        elif edad_constitucion > 60:
            return 2
        else:
            return None
        
    # Lógica para Personas Morales / Empresas (Ej: 3 = Persona Moral)
    if df[clave_tper].isin([3]).any():
        if edad_constitucion < 1:
            return 0
        elif edad_constitucion < 3:
            return 4
        elif edad_constitucion < 11:
            return 2
        elif edad_constitucion > 11:
            return 1
        else:
            return None

# -----------------------------------------------------------------------------
# Evaluación de Personas Políticamente Expuestas (PEP)
# Si es PEP, se le asigna directamente el score transformado de riesgo alto,
# de lo contrario se le asigna una base mínima de riesgo.
# -----------------------------------------------------------------------------
dataframe_onboarding["score_pep"] = np.where(
    dataframe_onboarding['PEP'] == True, 
    0.12,  # Score mitigado/ponderado si es PEP
    0.024  # Score mitigado/ponderado si NO es PEP
)


# ── ORQUESTADORA PRINCIPAL ───────────────────────────────────────────────────
def calcular_score_total(df):
    """
    Ejecuta en cadena cada una de las funciones de scoring para poblar las columnas individuales
    y finalmente realiza la sumatoria lineal de todos los pesos calculados.
    """
    calcular_score_tipo_persona(df)
    calcular_score_actividad_economica(df)   
    calcular_score_pais_nacionalidad(df)
    calcular_score_pais_residencia(df)
    calcular_score_pais_origen_recursos(df)
    calcular_score_pais_destino_recursos(df)
    calcular_score_nacionalidad(df)
    calcular_score_origen_recursos(df)
    calcular_score_destino_recursos(df)
    calcular_score_producto_servicio(df)
    calcular_score_entidad_federativa(df)

    # Identifica dinámicamente todas las columnas que contienen scores parciales
    cols_score = [col for col in df.columns if col.startswith("score_")]
    
    # Genera la calificación de riesgo final unificada por fila
    df["score_total"] = df[cols_score].sum(axis=1)

    return df