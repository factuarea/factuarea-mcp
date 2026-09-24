<p align="center">
  <a href="https://factuarea.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://docs.factuarea.com/logo/factuarea-logo-dark.svg">
      <img src="https://docs.factuarea.com/logo/factuarea-logo.svg" alt="Factuarea" width="260">
    </picture>
  </a>
</p>

<h1 align="center">Factuarea MCP</h1>

<p align="center">
  <strong>Toda tu gestión, a un servidor MCP de distancia.</strong><br>
  Facturación con VeriFactu, compras, catálogo, modelos fiscales, control horario y automatizaciones<br>
  para empresas y autónomos en España — como herramientas para Claude, ChatGPT, Cursor, VS Code y cualquier cliente MCP.
</p>

<p align="center">
  <a href="README.md">English</a> · <strong>Español</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@factuarea/mcp"><img src="https://img.shields.io/npm/v/@factuarea/mcp?color=465FFF&label=npm" alt="npm"></a>
  <a href="https://github.com/factuarea/factuarea-mcp/actions/workflows/ci.yml"><img src="https://github.com/factuarea/factuarea-mcp/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://registry.modelcontextprotocol.io/v0/servers?search=com.factuarea/mcp"><img src="https://img.shields.io/badge/MCP_Registry-com.factuarea%2Fmcp-465FFF" alt="MCP Registry"></a>
  <a href="https://docs.factuarea.com/es/mcp/tools"><img src="https://img.shields.io/badge/tools-450%2B-465FFF" alt="Más de 450 tools"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/licencia-MIT-465FFF" alt="Licencia MIT"></a>
</p>

<p align="center">
  <a href="https://cursor.com/en/install-mcp?name=factuarea&config=eyJ1cmwiOiJodHRwczovL21jcC5mYWN0dWFyZWEuY29tIn0="><img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Añadir Factuarea a Cursor" height="32"></a>
  <a href="https://insiders.vscode.dev/redirect/mcp/install?name=factuarea&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.factuarea.com%22%7D"><img src="https://img.shields.io/badge/VS_Code-Instalar_Factuarea-0098FF?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Instalar Factuarea en VS Code" height="32"></a>
</p>

---

| +450  |    29    |       9        |       5        |            2             |
| :---: | :------: | :------------: | :------------: | :----------------------: |
| tools | dominios | guías fiscales | flujos guiados | entornos: real y sandbox |

[Factuarea](https://factuarea.com) es una plataforma de facturación y gestión para empresas y
autónomos en España. Este es su servidor oficial de
[Model Context Protocol](https://modelcontextprotocol.io): el mismo servicio que el equipo de
Factuarea mantiene en producción, no un envoltorio construido encima. Lo que puedes hacer en
el panel de Factuarea o con su API REST, tu agente lo hace conversando: desde emitir una
factura VeriFactu hasta comprobar quién ha fichado esta mañana.

## Conectar

El servidor está en **`https://mcp.factuarea.com`**. Añádelo a tu cliente e inicia sesión con
tu cuenta de Factuarea: sin instalar nada y sin copiar claves. En la pantalla de
consentimiento eliges la empresa, el entorno (**real** o **test**) y exactamente qué permisos
concedes.

| Cliente                       | Configuración                                                                                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude** (web y escritorio) | En _Conectores_, añade un conector personalizado y pega la URL                                                                                                                      |
| **Claude Code**               | `claude mcp add --transport http factuarea https://mcp.factuarea.com`, después `/mcp` → _Authenticate_ — o instala el [plugin oficial](https://github.com/factuarea/claude-plugins) |
| **ChatGPT**                   | Añade un conector personalizado (modo desarrollador) con la URL y OAuth                                                                                                             |
| **Cursor**                    | El botón _Add to Cursor_, o `{ "mcpServers": { "factuarea": { "url": "https://mcp.factuarea.com" } } }` en `~/.cursor/mcp.json`                                                     |
| **VS Code**                   | El botón _Instalar_, o `{ "servers": { "factuarea": { "type": "http", "url": "https://mcp.factuarea.com" } } }` en `.vscode/mcp.json`                                               |
| **Cualquier otro cliente**    | Streamable HTTP con OAuth 2.1 (registro dinámico de clientes y PKCE)                                                                                                                |

El acceso MCP está **incluido en todos los planes de Factuarea**, también durante la prueba.

<details>
<summary><strong>¿Sin navegador?</strong> Usa una API key (tareas programadas, CI, servidores)</summary>

<br>

Crea una clave en [Ajustes → Desarrolladores → API keys](https://app.factuarea.com/settings/developers/api-keys),
eligiendo sus permisos, y envíala como token bearer:

```bash
claude mcp add --transport http factuarea https://mcp.factuarea.com \
  --header "Authorization: Bearer fact_test_xxxxxxxxxxxxxxxxxxxxxxxx"
```

Las claves `fact_test_…` trabajan sobre el sandbox; las `fact_live_…`, sobre la empresa real.

</details>

<details>
<summary><strong>¿Tu cliente solo ejecuta servidores locales?</strong> Usa el paquete de npm</summary>

<br>

`@factuarea/mcp` es un pequeño servidor stdio que reenvía cada petición a
`https://mcp.factuarea.com` con tu API key. Es la opción para el fichero de configuración de
Claude Desktop, los frameworks de agentes y cualquier cliente sin soporte de servidores
remotos. Requiere Node 20 o superior.

```json
{
  "mcpServers": {
    "factuarea": {
      "command": "npx",
      "args": ["-y", "@factuarea/mcp"],
      "env": { "FACTUAREA_API_KEY": "fact_test_xxxxxxxxxxxxxxxxxxxxxxxx" }
    }
  }
}
```

| Variable                       | Significado                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `FACTUAREA_API_KEY`            | Tu API key. Sin ella el servidor arranca igualmente y cada llamada responde cómo crear una.                   |
| `FACTUAREA_MCP_URL`            | Dirección del servidor. Por defecto `https://mcp.factuarea.com`; fuera de `localhost` solo admite `https://`. |
| `FACTUAREA_REQUEST_TIMEOUT_MS` | Tiempo máximo por llamada. Por defecto `120000`.                                                              |

El paquete no contiene lógica de negocio propia: las herramientas, las reglas y los permisos
son siempre los del servidor, así que la conexión local y la remota se comportan igual. Las
versiones se publican desde CI con [procedencia de npm](https://docs.npmjs.com/generating-provenance-statements).

</details>

## Pídele cosas como

> _«Factura a Talleres Ruiz el albarán de ayer y envíaselo por email.»_
>
> _«¿Qué facturas de este trimestre siguen sin cobrar? Manda un recordatorio a cada cliente.»_
>
> _«Convierte el presupuesto 2026-014 en factura, pero con vencimiento el día 30.»_
>
> _«Registra esta factura de proveedor y márcala como pagada por transferencia.»_
>
> _«Sube un 5 % todos los precios de la tarifa de mayoristas.»_
>
> _«Prepara el libro del Modelo 303 del tercer trimestre.»_
>
> _«¿Por qué el pedido #1042 de WooCommerce no generó factura?»_
>
> _«¿Quién del equipo no ha fichado hoy?»_

## Qué cubre

|                       |                                                                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🧾 **Ventas**         | Facturas de borrador a cobrada — envío, programación, recordatorios, cobros, anulación y rectificativas — además de presupuestos, proformas, albaranes firmados y facturas recurrentes |
| 📥 **Compras**        | Facturas de proveedor con adjuntos, pagos y listados de pendientes y vencidas                                                                                                          |
| 📦 **Catálogo**       | Contactos que son clientes, proveedores o ambos; productos con variantes, presentaciones y stock; ofertas de proveedor; tarifas; series de numeración; impuestos                       |
| 🏛️ **Cumplimiento**   | Registros, eventos y certificados de VeriFactu; FacturaE a administraciones públicas a través de FACe; modelos 303, 347 y 130                                                          |
| ⏱️ **Equipo**         | Empleados, horarios, el registro de jornada del RD-ley 8/2019, ausencias, presencia y festivos                                                                                         |
| ⚙️ **Automatización** | Webhooks y eventos, un motor de reglas con simulación, tiendas WooCommerce y Shopify, autofacturación de Stripe                                                                        |
| 🏢 **Gestorías**      | Empresas gestionadas, API keys, registros de emails y de peticiones                                                                                                                    |

Cada herramienta, su dominio y el permiso que necesita: **[docs.factuarea.com/es/mcp/tools](https://docs.factuarea.com/es/mcp/tools)**.

Junto a las herramientas, el servidor publica **9 guías fiscales** como resources
(`factuarea://guardrails/…`: emisión, anular o rectificar, tipos de factura, líneas e
importes, claves de régimen, series, identificación del comprador, requisitos de VeriFactu y
multiempresa) y **5 flujos guiados** como prompts: emitir una factura, arreglar una fallida,
dar de alta un cliente por NIF, conectar una tienda online y rastrear un pedido que no se
facturó.

## Pensado para un agente que maneja dinero de verdad

**No rompe el registro fiscal.** Hay errores que no se deshacen cuando la factura ya existe
para Hacienda: borrar una factura emitida en lugar de anularla, editar una que ya no es
borrador o anular una rectificativa. El servidor rechaza esas llamadas antes de ejecutar
nada, y el rechazo (`mcp_guardrail_violation`) indica la regla incumplida (`rule_id`) y la
guía que explica el camino correcto (`guardrail_uri`), para que el agente se corrija solo.

**Un reintento nunca crea una segunda factura.** Las operaciones que no se pueden deshacer
aceptan un `idempotency_key`. Si el agente repite la llamada tras un timeout, recibe el
resultado original, marcado como repetición, en lugar de un documento duplicado.

**Solo ve lo que has permitido.** Cada credencial lista únicamente las herramientas que sus
permisos autorizan, y cada llamada se vuelve a comprobar. Las aplicaciones de terceros
conectadas por OAuth reciben un catálogo seleccionado; las operaciones más sensibles
—escrituras de VeriFactu, borrado RGPD, pagos, API keys y empresas gestionadas— exigen la API
key del titular. Ninguna credencial llega a datos de una empresa que no se le haya concedido.

**Practica antes con una copia.** Una credencial de test trabaja sobre un gemelo sandbox de
tu empresa que hereda su plan: nada se envía a la AEAT, ningún email llega a tus clientes,
no sale ningún webhook y los envíos a FACe se simulan.

## Seguridad y privacidad

OAuth 2.1 con PKCE y tokens de refresco rotatorios; API keys que se muestran una sola vez, se
guardan como hash, con caducidad y lista de IPs opcionales; las aplicaciones
conectadas se revocan desde el panel. Política de privacidad:
[factuarea.com/privacidad](https://factuarea.com/privacidad). Vulnerabilidades: sigue
[SECURITY.md](SECURITY.md).

## Más de Factuarea para desarrolladores

- **[Documentación](https://docs.factuarea.com/es)** — referencia de la API REST, guías, códigos de error y [`llms.txt`](https://docs.factuarea.com/llms.txt)
- **SDKs** — [TypeScript](https://github.com/factuarea/factuarea-node) y [PHP](https://github.com/factuarea/factuarea-php)
- **[CLI](https://github.com/factuarea/factuarea-cli)** — la API desde tu terminal
- **[Plugins de Claude Code](https://github.com/factuarea/claude-plugins)** — este servidor y skills para construir una integración
- **Integraciones** — [n8n](https://github.com/factuarea/factuarea-n8n-nodes) y [WooCommerce](https://github.com/factuarea/factuarea-woocommerce)

## Preguntas

<details>
<summary>¿Necesito saber programar?</summary>

No. Conecta el servidor en Claude o ChatGPT y pide las cosas con tus palabras. La API key y el
paquete de npm solo hacen falta para configuraciones automatizadas.

</details>

<details>
<summary>¿Las facturas creadas así valen para VeriFactu?</summary>

Son las mismas facturas que crearías desde el panel. Si tu empresa tiene VeriFactu activado,
Factuarea las registra en la AEAT exactamente igual que cualquier otra.

</details>

<details>
<summary>¿Puedo probarlo sin tocar mis datos reales?</summary>

Sí: elige _test_ en la pantalla de consentimiento o usa una clave `fact_test_`. El agente
trabajará sobre una empresa sandbox aislada.

</details>

<details>
<summary>¿El agente puede ver otras empresas a las que tengo acceso?</summary>

Solo la que elegiste al conectar. Para trabajar con otra, vuelve a conectar y selecciónala.

</details>

<details>
<summary>He encontrado un fallo o echo en falta una herramienta.</summary>

[Abre una issue](https://github.com/factuarea/factuarea-mcp/issues/new/choose): es el sitio
adecuado aunque el problema esté en el servidor alojado. Para dudas de tu cuenta, escribe a
[soporte](https://docs.factuarea.com/es/support).

</details>

## Contribuir

Este repositorio contiene el paquete de npm y los manifiestos de registro; el servidor en sí
se ejecuta en la plataforma de Factuarea. Lee [CONTRIBUTING.md](CONTRIBUTING.md) para
preparar el proyecto (y [AGENTS.md](AGENTS.md) si trabajas con un agente de código), y el
[Código de conducta](CODE_OF_CONDUCT.md) antes de participar. Los cambios se recogen en el
[CHANGELOG](CHANGELOG.md).

## Licencia

El código de este repositorio es [MIT](LICENSE). El uso del servidor alojado y de Factuarea
se rige por las condiciones de servicio de Factuarea.
